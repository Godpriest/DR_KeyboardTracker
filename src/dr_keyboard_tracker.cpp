#include <obs-module.h>
#include <util/platform.h>
#include <graphics/graphics.h>

#ifndef NOMINMAX
#define NOMINMAX
#endif
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#include <wincodec.h>
#include <objbase.h>
#include <shellapi.h>

#include <nlohmann/json.hpp>
#include <fstream>
#include <unordered_map>
#include <vector>
#include <string>
#include <mutex>
#include <algorithm>

using json = nlohmann::json;

OBS_DECLARE_MODULE()
OBS_MODULE_USE_DEFAULT_LOCALE("DR_KeyboardTracker", "en-US")

struct KeyImage {
    gs_texture_t* upTexture {nullptr};
    gs_texture_t* downTexture {nullptr};
    int x {0};
    int y {0};
    int width {0};
    int height {0};
};

static constexpr uint32_t VK_EXT_MASK = 0x10000;

struct dr_keyboard_tracker_source {
    obs_source_t* source {nullptr};
    std::wstring jsonPathW; // 原始選取路徑（寬字元）
    std::string jsonDirA;   // 對應圖片所在資料夾（ANSI/UTF-8）

    std::unordered_map<uint32_t, std::vector<KeyImage>> vkToImages; // (vk | ext) -> 多個 textures 與座標

    // 由 JSON.canvas 指定的畫布大小（若為 0 則以 auto 最大值回傳）
    int canvasWidth {0};
    int canvasHeight {0};

    // 鍵盤狀態（同時支援多個 source 共用）
    static std::mutex stateMutex;
    static std::unordered_map<uint32_t, bool> keyDownState;

    HHOOK hook {nullptr};
    HHOOK mouseHook {nullptr};
    // 短暫事件（例如滑鼠滾輪）：按下後維持到期即自動釋放（毫秒時間戳）
    std::unordered_map<uint32_t, uint64_t> momentaryUntilMs;
};

std::mutex dr_keyboard_tracker_source::stateMutex;
std::unordered_map<uint32_t, bool> dr_keyboard_tracker_source::keyDownState;

// WIC 載入 RGBA
static bool wic_load_rgba(const std::wstring& wpath, std::vector<uint8_t>& outRgba, int& outW, int& outH)
{
    outRgba.clear();
    outW = outH = 0;

    bool coInit = false;
    HRESULT hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    if (SUCCEEDED(hr)) coInit = true;
    else if (hr == RPC_E_CHANGED_MODE) {
        // 已在不同模式初始化，繼續嘗試使用
    } else {
        return false;
    }

    IWICImagingFactory* factory = nullptr;
    hr = CoCreateInstance(CLSID_WICImagingFactory, nullptr, CLSCTX_INPROC_SERVER,
                          IID_PPV_ARGS(&factory));
    if (FAILED(hr) || !factory) {
        if (coInit) CoUninitialize();
        return false;
    }

    IWICBitmapDecoder* decoder = nullptr;
    hr = factory->CreateDecoderFromFilename(wpath.c_str(), nullptr, GENERIC_READ,
                                            WICDecodeMetadataCacheOnLoad, &decoder);
    if (FAILED(hr) || !decoder) { factory->Release(); if (coInit) CoUninitialize(); return false; }

    IWICBitmapFrameDecode* frame = nullptr;
    hr = decoder->GetFrame(0, &frame);
    if (FAILED(hr) || !frame) { decoder->Release(); factory->Release(); if (coInit) CoUninitialize(); return false; }

    IWICFormatConverter* converter = nullptr;
    hr = factory->CreateFormatConverter(&converter);
    if (FAILED(hr) || !converter) { frame->Release(); decoder->Release(); factory->Release(); if (coInit) CoUninitialize(); return false; }

    // 轉為 32bpp PBGRA（預乘透明），避免色邊與透明錯誤
    hr = converter->Initialize(frame, GUID_WICPixelFormat32bppPBGRA, WICBitmapDitherTypeNone,
                               nullptr, 0.0, WICBitmapPaletteTypeCustom);
    if (FAILED(hr)) { converter->Release(); frame->Release(); decoder->Release(); factory->Release(); if (coInit) CoUninitialize(); return false; }

    UINT w = 0, h = 0;
    converter->GetSize(&w, &h);
    if (w == 0 || h == 0) { converter->Release(); frame->Release(); decoder->Release(); factory->Release(); if (coInit) CoUninitialize(); return false; }

    const UINT stride = w * 4;
    const UINT bufferSize = stride * h;
    outRgba.resize(bufferSize);
    hr = converter->CopyPixels(nullptr, stride, bufferSize, outRgba.data());

    converter->Release();
    frame->Release();
    decoder->Release();
    factory->Release();
    if (coInit) CoUninitialize();

    if (FAILED(hr)) { outRgba.clear(); return false; }
    outW = (int)w; outH = (int)h;
    return true;
}

static std::string utf16_to_utf8(const std::wstring& w)
{
    if (w.empty()) return {};
    int sizeNeeded = WideCharToMultiByte(CP_UTF8, 0, w.c_str(), (int)w.size(), nullptr, 0, nullptr, nullptr);
    std::string result(sizeNeeded, 0);
    WideCharToMultiByte(CP_UTF8, 0, w.c_str(), (int)w.size(), result.data(), sizeNeeded, nullptr, nullptr);
    return result;
}

static std::wstring utf8_to_utf16(const std::string& s)
{
    if (s.empty()) return {};
    int sizeNeeded = MultiByteToWideChar(CP_UTF8, 0, s.c_str(), (int)s.size(), nullptr, 0);
    std::wstring result(sizeNeeded, 0);
    MultiByteToWideChar(CP_UTF8, 0, s.c_str(), (int)s.size(), result.data(), sizeNeeded);
    return result;
}

static std::string get_directory_from_path_utf8(const std::wstring& wpath)
{
    std::wstring::size_type pos = wpath.find_last_of(L"/\\");
    std::wstring dir = (pos == std::wstring::npos) ? L"" : wpath.substr(0, pos);
    return utf16_to_utf8(dir);
}

static std::wstring get_directory_from_path_utf16(const std::wstring& wpath)
{
    std::wstring::size_type pos = wpath.find_last_of(L"/\\");
    return (pos == std::wstring::npos) ? L"" : wpath.substr(0, pos);
}

static bool file_exists_w(const std::wstring& wpath)
{
    DWORD attr = GetFileAttributesW(wpath.c_str());
    return attr != INVALID_FILE_ATTRIBUTES && (attr & FILE_ATTRIBUTE_DIRECTORY) == 0;
}

static std::wstring get_module_directory_w()
{
    static std::wstring cached;
    if (!cached.empty()) return cached;
    HMODULE thisModule = nullptr;
    GetModuleHandleExW(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS | GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
                       reinterpret_cast<LPCWSTR>(&obs_module_load), &thisModule);
    wchar_t path[MAX_PATH];
    DWORD len = GetModuleFileNameW(thisModule, path, MAX_PATH);
    if (len == 0) return L"";
    cached = get_directory_from_path_utf16(std::wstring(path, path + len));
    return cached;
}

static std::string percent_decode_utf8(const std::string& s)
{
    std::string out;
    out.reserve(s.size());
    for (size_t i = 0; i < s.size(); ++i) {
        if (s[i] == '%' && i + 2 < s.size()) {
            auto hex = s.substr(i + 1, 2);
            char* end = nullptr;
            long v = strtol(hex.c_str(), &end, 16);
            if (end && *end == '\0') {
                out.push_back(static_cast<char>(v));
                i += 2;
                continue;
            }
        }
        if (s[i] == '+') out.push_back(' ');
        else out.push_back(s[i]);
    }
    return out;
}

static std::wstring resolve_sprite_to_wpath(const std::wstring& jsonDirW, const std::string& sprite)
{
    if (sprite.empty()) return L"";
    std::string s = sprite;
    // blob 無法由外掛載入
    if (s.rfind("blob:", 0) == 0) return L"";
    // file:// 轉實際路徑
    if (s.rfind("file://", 0) == 0) {
        std::string path = s;
        if (path.rfind("file:///", 0) == 0 && path.size() > 8) {
            path = path.substr(8); // after file:///
        } else {
            path = path.substr(7); // after file://
        }
        std::string decoded = percent_decode_utf8(path);
        for (char& c : decoded) if (c == '/') c = '\\';
        return utf8_to_utf16(decoded);
    }
    // Windows 絕對路徑
    if ((s.size() >= 2 && ((('A' <= s[0] && s[0] <= 'Z')||('a'<=s[0]&&s[0]<='z')) && s[1] == ':')) ||
        (s.size() >= 2 && (s[0] == '\\' && s[1] == '\\'))) {
        return utf8_to_utf16(s);
    }
    // 相對路徑：以 JSON 目錄為基準
    std::wstring rel = utf8_to_utf16(s);
    for (wchar_t& ch : rel) if (ch == L'/') ch = L'\\';
    std::wstring out = rel;
    if (!jsonDirW.empty()) {
        out = jsonDirW;
        if (!out.empty() && out.back() != L'\\' && out.back() != L'/') out += L'\\';
        out += rel;
    }
    // 若檔案不存在且無副檔名，嘗試補 .png
    auto hasExt = [&]() -> bool {
        size_t posSlash = out.find_last_of(L"/\\");
        size_t posDot = out.find_last_of(L'.');
        return (posDot != std::wstring::npos) && (posSlash == std::wstring::npos || posDot > posSlash);
    }();
    if (!file_exists_w(out) && !hasExt) {
        static const wchar_t* exts[] = {L".png", L".jpg", L".jpeg", L".webp", L".bmp"};
        for (auto* ext : exts) {
            std::wstring cand = out + ext;
            if (file_exists_w(cand)) return cand;
        }
    }
    return out;
}

static int key_id_to_vk(const std::string& id)
{
    std::string s;
    s.reserve(id.size());
    for (char c : id) s.push_back((char)tolower((unsigned char)c));
    // 滑鼠按鍵（允許字串；支援 editor 的命名）
    if (s == "mouse_left" || s == "lbutton" || s == "mouseleft") return VK_LBUTTON;   // 0x01
    if (s == "mouse_right" || s == "rbutton" || s == "mouseright") return VK_RBUTTON;  // 0x02
    if (s == "mouse_middle" || s == "mbutton" || s == "mousemiddle") return VK_MBUTTON; // 0x04
    if (s == "mouse_x1" || s == "xbutton1" || s == "mousex1") return VK_XBUTTON1;   // 0x05
    if (s == "mouse_x2" || s == "xbutton2" || s == "mousex2") return VK_XBUTTON2;   // 0x06
    if (s == "wheel_up"   || s == "wheelup")   return 0x0A01;    // 自訂代碼：滾輪上（與 editor 一致）
    if (s == "wheel_down" || s == "wheeldown") return 0x0A02;    // 自訂代碼：滾輪下（與 editor 一致）
    if (s.size() == 1) {
        if (s[0] >= 'a' && s[0] <= 'z') return 'A' + (s[0] - 'a');
        if (s[0] >= '0' && s[0] <= '9') return '0' + (s[0] - '0');
    }
    if (s.rfind("f", 0) == 0 && s.size() <= 3) {
        int fn = atoi(s.c_str() + 1);
        if (fn >= 1 && fn <= 24) return VK_F1 + (fn - 1);
    }
    if (s == "escape" || s == "esc") return VK_ESCAPE;
    if (s == "backspace") return VK_BACK;
    if (s == "tab") return VK_TAB;
    if (s == "enter" || s == "return") return VK_RETURN;
    if (s == "space" || s == "spacebar") return VK_SPACE;
    if (s == "insert") return VK_INSERT;
    if (s == "delete") return VK_DELETE;
    if (s == "home") return VK_HOME;
    if (s == "end") return VK_END;
    if (s == "pageup") return VK_PRIOR;
    if (s == "pagedown") return VK_NEXT;
    if (s == "printscreen" || s == "prtsc") return VK_SNAPSHOT;
    if (s == "scrolllock") return VK_SCROLL;
    if (s == "pause") return VK_PAUSE;
    if (s == "capslock") return VK_CAPITAL;
    if (s == "numlock") return VK_NUMLOCK;
    if (s == "contextmenu" || s == "menu") return VK_APPS;
    if (s == "arrowup") return VK_UP;
    if (s == "arrowdown") return VK_DOWN;
    if (s == "arrowleft") return VK_LEFT;
    if (s == "arrowright") return VK_RIGHT;
    if (s == "grave") return VK_OEM_3;        // `~
    if (s == "minus") return VK_OEM_MINUS;    // -_
    if (s == "equal") return VK_OEM_PLUS;     // =+
    if (s == "bracketleft") return VK_OEM_4;  // [
    if (s == "bracketright") return VK_OEM_6; // ]
    if (s == "backslash") return VK_OEM_5;    // \
    if (s == "semicolon") return VK_OEM_1;    // ;
    if (s == "quote") return VK_OEM_7;        // '
    if (s == "comma") return VK_OEM_COMMA;    // ,
    if (s == "period") return VK_OEM_PERIOD;  // .
    if (s == "slash") return VK_OEM_2;        // /
    if (s == "numpad0") return VK_NUMPAD0; if (s == "numpad1") return VK_NUMPAD1; if (s == "numpad2") return VK_NUMPAD2; if (s == "numpad3") return VK_NUMPAD3; if (s == "numpad4") return VK_NUMPAD4; if (s == "numpad5") return VK_NUMPAD5; if (s == "numpad6") return VK_NUMPAD6; if (s == "numpad7") return VK_NUMPAD7; if (s == "numpad8") return VK_NUMPAD8; if (s == "numpad9") return VK_NUMPAD9;
    if (s == "numpadadd") return VK_ADD; if (s == "numpadsubtract") return VK_SUBTRACT; if (s == "numpadmultiply") return VK_MULTIPLY; if (s == "numpaddivide") return VK_DIVIDE; if (s == "numpaddecimal") return VK_DECIMAL; if (s == "numpadenter") return VK_RETURN; // Enter on numpad maps to VK_RETURN in low-level hook
    if (s == "shift") return VK_SHIFT;
    if (s == "lshift") return VK_LSHIFT;
    if (s == "rshift") return VK_RSHIFT;
    if (s == "ctrl" || s == "control") return VK_CONTROL;
    if (s == "lctrl") return VK_LCONTROL;
    if (s == "rctrl") return VK_RCONTROL;
    if (s == "alt") return VK_MENU;
    if (s == "lalt") return VK_LMENU;
    if (s == "ralt") return VK_RMENU;
    if (s == "lmeta" || s == "win" || s == "lwin") return VK_LWIN;
    if (s == "rmeta" || s == "rwin") return VK_RWIN;
    return 0;
}

static std::pair<int,bool> parse_binding_to_vk_extended(const std::string& binding)
{
    size_t last = binding.find_last_of('+');
    std::string token = (last == std::string::npos) ? binding : binding.substr(last + 1);
    size_t start = token.find_first_not_of(" \t\r\n");
    size_t end = token.find_last_not_of(" \t\r\n");
    if (start == std::string::npos) return {0,false};
    token = token.substr(start, end - start + 1);
    if (token == "numpadenter") return {VK_RETURN, true};
    int vk = key_id_to_vk(token);
    return {vk,false};
}

// Button callbacks (no capture; compatible with C function pointer)
static bool on_open_editor_clicked(obs_properties_t*, obs_property_t*, void* d)
{
    (void)d;
    std::wstring path = get_module_directory_w() + L"\\dr_kteditor\\index.html";
    if (path.empty() || !file_exists_w(path)) {
        blog(LOG_WARNING, "DR_KeyboardTracker: editor HTML not set or not found");
        return false;
    }
    HINSTANCE res = ShellExecuteW(nullptr, L"open", path.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
    if ((INT_PTR)res <= 32) {
        blog(LOG_WARNING, "DR_KeyboardTracker: open editor failed (%ld)", (long)(INT_PTR)res);
        return false;
    }
    return true;
}

static bool on_open_generator_clicked(obs_properties_t*, obs_property_t*, void* d)
{
    (void)d;
    std::wstring path = get_module_directory_w() + L"\\dr_ktgenerator\\index.html";
    if (path.empty() || !file_exists_w(path)) {
        blog(LOG_WARNING, "DR_KeyboardTracker: generator HTML not set or not found");
        return false;
    }
    HINSTANCE res = ShellExecuteW(nullptr, L"open", path.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
    if ((INT_PTR)res <= 32) {
        blog(LOG_WARNING, "DR_KeyboardTracker: open generator failed (%ld)", (long)(INT_PTR)res);
        return false;
    }
    return true;
}

static void create_textures_from_rgba_vertical_halves(const std::vector<uint8_t>& rgba, int w, int h,
                                                     gs_texture_t** outUp, gs_texture_t** outDown)
{
    if (w <= 0 || h <= 1) { *outUp = nullptr; *outDown = nullptr; return; }
    const int halfH = h / 2; // floor(h/2)
    const size_t rowBytes = (size_t)w * 4;
    std::vector<uint8_t> topBuf((size_t)w * halfH * 4);
    std::vector<uint8_t> bottomBuf((size_t)w * halfH * 4);
    const uint8_t* src = rgba.data();
    // copy top: 從最上方開始取 halfH 列
    for (int r = 0; r < halfH; ++r) {
        memcpy(topBuf.data() + (size_t)r * rowBytes, src + (size_t)r * rowBytes, rowBytes);
    }
    // copy bottom: 從最底部往上取 halfH 列（奇數高度時捨棄中間那一列）
    const int bottomStart = h - halfH; // 當 h 為奇數時，這會跳過正中間那列
    for (int r = 0; r < halfH; ++r) {
        memcpy(bottomBuf.data() + (size_t)r * rowBytes, src + (size_t)(bottomStart + r) * rowBytes, rowBytes);
    }

    const uint8_t* topPtr = topBuf.data();
    const uint8_t* botPtr = bottomBuf.data();
    obs_enter_graphics();
    // 此處資料來自 WIC 32bpp PBGRA，使用 GS_BGRA 以避免色彩通道顛倒
    *outUp = gs_texture_create((uint32_t)w, (uint32_t)halfH, GS_BGRA, 1, &topPtr, 0);
    *outDown = gs_texture_create((uint32_t)w, (uint32_t)halfH, GS_BGRA, 1, &botPtr, 0);
    obs_leave_graphics();
}

static void draw_texture(gs_texture_t* tex, int x, int y, int w, int h)
{
    if (!tex) return;
    gs_effect_t* effect = obs_get_base_effect(OBS_EFFECT_DEFAULT);
    gs_eparam_t* image = gs_effect_get_param_by_name(effect, "image");
    gs_technique_t* tech = gs_effect_get_technique(effect, "Draw");

    gs_reset_blend_state();
    gs_enable_blending(true);
    // 預乘 alpha 素材的正確混合
    gs_blend_function_separate(GS_BLEND_ONE, GS_BLEND_INVSRCALPHA, GS_BLEND_ONE, GS_BLEND_INVSRCALPHA);

    gs_matrix_push();
    gs_matrix_translate3f((float)x, (float)y, 0.0f);
    gs_effect_set_texture(image, tex);

    if (gs_technique_begin(tech)) {
        if (gs_technique_begin_pass(tech, 0)) {
            gs_draw_sprite(tex, 0, (uint32_t)w, (uint32_t)h);
            gs_technique_end_pass(tech);
        }
        gs_technique_end(tech);
    }
    gs_matrix_pop();
}

static LRESULT CALLBACK LowLevelKeyboardProc(int nCode, WPARAM wParam, LPARAM lParam)
{
    if (nCode == HC_ACTION) {
        const KBDLLHOOKSTRUCT* kb = reinterpret_cast<KBDLLHOOKSTRUCT*>(lParam);
        bool isDown = (wParam == WM_KEYDOWN || wParam == WM_SYSKEYDOWN);
        bool isUp = (wParam == WM_KEYUP || wParam == WM_SYSKEYUP);
        if (isDown || isUp) {
            std::lock_guard<std::mutex> _g(dr_keyboard_tracker_source::stateMutex);
            const bool extended = (kb->flags & LLKHF_EXTENDED) != 0;
            uint32_t vk = (uint32_t)kb->vkCode;
            uint32_t code = vk | (extended ? VK_EXT_MASK : 0);
            dr_keyboard_tracker_source::keyDownState[code] = isDown;
            // 若收到通用修飾鍵（未區分左右），同時點亮左右兩顆
            if (vk == VK_SHIFT) {
                dr_keyboard_tracker_source::keyDownState[VK_LSHIFT] = isDown;
                dr_keyboard_tracker_source::keyDownState[VK_RSHIFT] = isDown;
            } else if (vk == VK_CONTROL) {
                dr_keyboard_tracker_source::keyDownState[VK_LCONTROL] = isDown;
                dr_keyboard_tracker_source::keyDownState[VK_RCONTROL] = isDown;
            } else if (vk == VK_MENU) {
                dr_keyboard_tracker_source::keyDownState[VK_LMENU] = isDown;
                dr_keyboard_tracker_source::keyDownState[VK_RMENU] = isDown;
            }
        }
    }
    return CallNextHookEx(nullptr, nCode, wParam, lParam);
}

static uint64_t get_tick_ms()
{
    return (uint64_t)GetTickCount64();
}

static LRESULT CALLBACK LowLevelMouseProc(int nCode, WPARAM wParam, LPARAM lParam)
{
    if (nCode == HC_ACTION) {
        const MSLLHOOKSTRUCT* ms = reinterpret_cast<MSLLHOOKSTRUCT*>(lParam);
        uint32_t vk = 0;
        bool setDown = false;
        bool setUp = false;
        switch (wParam) {
            case WM_LBUTTONDOWN: vk = VK_LBUTTON; setDown = true; break;
            case WM_LBUTTONUP:   vk = VK_LBUTTON; setUp = true; break;
            case WM_RBUTTONDOWN: vk = VK_RBUTTON; setDown = true; break;
            case WM_RBUTTONUP:   vk = VK_RBUTTON; setUp = true; break;
            case WM_MBUTTONDOWN: vk = VK_MBUTTON; setDown = true; break;
            case WM_MBUTTONUP:   vk = VK_MBUTTON; setUp = true; break;
            case WM_XBUTTONDOWN: {
                uint16_t xb = HIWORD(ms->mouseData);
                vk = (xb == XBUTTON1 ? VK_XBUTTON1 : VK_XBUTTON2);
                setDown = true; break;
            }
            case WM_XBUTTONUP: {
                uint16_t xb = HIWORD(ms->mouseData);
                vk = (xb == XBUTTON1 ? VK_XBUTTON1 : VK_XBUTTON2);
                setUp = true; break;
            }
            case WM_MOUSEWHEEL: {
                short delta = GET_WHEEL_DELTA_WPARAM(ms->mouseData);
                uint32_t code = (delta > 0) ? 0x0A01 : 0x0A02; // wheel_up / wheel_down (match editor)
                std::lock_guard<std::mutex> _g(dr_keyboard_tracker_source::stateMutex);
                dr_keyboard_tracker_source::keyDownState[code] = true;
                // 150ms 閃爍
                // 需取得目前 ctx 以存到 momentaryUntilMs → 我們用全域 map 不行，改由在 render 清理時僅依 keyDownState 清除不可行
                // 因為需要 ctx，使用 obs 的 render 時機清理：在那裡我們無法知道設置的時間。改為此處記錄一個靜態 map
                // 但有多 source，使用同一靜態也可以，因為狀態本來就共享。
                break;
            }
            default: break;
        }
        if (vk != 0) {
            std::lock_guard<std::mutex> _g(dr_keyboard_tracker_source::stateMutex);
            if (setDown) dr_keyboard_tracker_source::keyDownState[vk] = true;
            if (setUp)   dr_keyboard_tracker_source::keyDownState[vk] = false;
        }
    }
    return CallNextHookEx(nullptr, nCode, wParam, lParam);
}

static void install_hook(dr_keyboard_tracker_source* ctx)
{
    if (ctx->hook) return;
    HMODULE thisModule = nullptr;
    GetModuleHandleExW(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS | GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
                       reinterpret_cast<LPCWSTR>(&LowLevelKeyboardProc), &thisModule);
    ctx->hook = SetWindowsHookExW(WH_KEYBOARD_LL, LowLevelKeyboardProc, thisModule, 0);
    if (!ctx->mouseHook)
        ctx->mouseHook = SetWindowsHookExW(WH_MOUSE_LL, LowLevelMouseProc, thisModule, 0);
}

static void uninstall_hook(dr_keyboard_tracker_source* ctx)
{
    if (ctx->hook) {
        UnhookWindowsHookEx(ctx->hook);
        ctx->hook = nullptr;
    }
    if (ctx->mouseHook) {
        UnhookWindowsHookEx(ctx->mouseHook);
        ctx->mouseHook = nullptr;
    }
}

static void clear_textures(dr_keyboard_tracker_source* ctx)
{
    obs_enter_graphics();
    for (auto& pair : ctx->vkToImages) {
        auto& list = pair.second;
        for (auto& img : list) {
            if (img.upTexture) gs_texture_destroy(img.upTexture);
            if (img.downTexture) gs_texture_destroy(img.downTexture);
        }
    }
    obs_leave_graphics();
    ctx->vkToImages.clear();
}

static void load_from_json(dr_keyboard_tracker_source* ctx)
{
    clear_textures(ctx);
    if (ctx->jsonPathW.empty()) return;

    std::ifstream ifs(ctx->jsonPathW);
    if (!ifs) return;
    json j;
    try { ifs >> j; } catch (...) { return; }

    // 期望格式：
    // {
    //   "keys": [
    //     { "vk": 65, "image": "A.png", "x": 100, "y": 200, "w": 64, "h": 64 }
    //   ]
    // }

    std::string dir = get_directory_from_path_utf8(ctx->jsonPathW);
    std::wstring dirW = utf8_to_utf16(dir);

    // 讀取畫布大小（可選）
    ctx->canvasWidth = 0; ctx->canvasHeight = 0;
    if (j.contains("canvas") && j["canvas"].is_object()) {
        ctx->canvasWidth = j["canvas"].value("width", 0);
        ctx->canvasHeight = j["canvas"].value("height", 0);
    }

    if (j.contains("keys") && j["keys"].is_array()) {
        for (const auto& item : j["keys"]) {
            int vk = -1;
            bool useExtended = false;
            if (item.contains("vk")) vk = item.value("vk", -1);
            if (vk < 0) {
                std::string binding = item.value("keyBinding", "");
                if (!binding.empty()) {
                    auto pr = parse_binding_to_vk_extended(binding);
                    vk = pr.first; useExtended = pr.second;
                }
            }
            if (item.contains("extended")) useExtended = item.value("extended", useExtended);
            std::string imageRel = item.value("image", "");
            if (imageRel.empty()) imageRel = item.value("sprite", "");
            int x = item.value("x", 0);
            int y = item.value("y", 0);
            int w = item.value("w", 0);
            int h = item.value("h", 0);
            if (vk < 0) {
                blog(LOG_WARNING, "DR_KeyboardTracker: skip key with unknown binding (id=%s)", item.value("id", "").c_str());
                continue; // 無對應鍵則略過
            }

            std::wstring wimg = resolve_sprite_to_wpath(dirW, imageRel);
            std::vector<uint8_t> rgba;
            int iw = 0, ih = 0;
            bool ok = wic_load_rgba(wimg, rgba, iw, ih);
            if (!ok) {
                // 只有在 sprite 空白時才啟用 id/keyBinding 的檔名備援
                if (imageRel.empty()) {
                    static const wchar_t* exts[] = {L"", L".png", L".jpg", L".jpeg", L".webp", L".bmp"};
                    auto try_load_by_base = [&](const std::string& baseUtf8) -> bool {
                        if (baseUtf8.empty()) return false;
                        std::wstring base = utf8_to_utf16(baseUtf8);
                        bool hasDot = false; {
                            size_t slash = base.find_last_of(L"/\\");
                            size_t dot = base.find_last_of(L'.');
                            hasDot = (dot != std::wstring::npos) && (slash == std::wstring::npos || dot > slash);
                        }
                        for (size_t i = 0; i < (hasDot ? 1u : (sizeof(exts)/sizeof(exts[0]))); ++i) {
                            std::wstring cand = dirW;
                            if (!cand.empty() && cand.back() != L'\\' && cand.back() != L'/') cand += L'\\';
                            cand += base;
                            if (!hasDot) cand += exts[i];
                            if (wic_load_rgba(cand, rgba, iw, ih)) { wimg = cand; return true; }
                        }
                        return false;
                    };
                    bool loadedById = try_load_by_base(item.value("id", std::string()));
                    bool loadedByBind = (!loadedById) && try_load_by_base(item.value("keyBinding", std::string()));
                    ok = loadedById || loadedByBind;
                }
                if (!ok) {
                    std::string p = utf16_to_utf8(wimg);
                    blog(LOG_WARNING, "DR_KeyboardTracker: failed to load image: %s", p.c_str());
                    continue;
                }
            }

            gs_texture_t* up = nullptr;
            gs_texture_t* down = nullptr;
            create_textures_from_rgba_vertical_halves(rgba, iw, ih, &up, &down);

            KeyImage ki;
            ki.upTexture = up;
            ki.downTexture = down;
            // Default to natural size if not specified in JSON
            const int naturalW = iw;
            const int naturalH = ih > 0 ? (ih / 2) : 0;
            ki.x = x;
            ki.y = y;
            ki.width = (w > 0 ? w : naturalW);
            ki.height = (h > 0 ? h : naturalH);
            uint32_t code = (uint32_t)vk | (useExtended ? VK_EXT_MASK : 0);
            ctx->vkToImages[code].push_back(ki);
        }
    }
    size_t count = 0; for (auto& kv : ctx->vkToImages) count += kv.second.size();
    blog(LOG_INFO, "DR_KeyboardTracker: loaded %zu keys from JSON", count);
}

// OBS Source 實作
static const char* dr_get_name(void* type_data)
{
    return obs_module_text("Source.Name");
}

enum { PROP_JSON_PATH };

static obs_properties_t* dr_get_properties(void* data)
{
    obs_properties_t* props = obs_properties_create();
    obs_property_t* p = obs_properties_add_path(props, "json_path", obs_module_text("Prop.LayoutJSON"), OBS_PATH_FILE, "JSON (*.json)", nullptr);
    (void)p;

    // Buttons (ASCII labels to avoid encoding issues on non-UTF8 codepages)
    obs_properties_add_button(props, "open_editor_html", obs_module_text("Button.OpenEditor"), on_open_editor_clicked);
    obs_properties_add_button(props, "open_generator_html", obs_module_text("Button.OpenGenerator"), on_open_generator_clicked);
    return props;
}

static void dr_update(void* data, obs_data_t* settings)
{
    auto* ctx = reinterpret_cast<dr_keyboard_tracker_source*>(data);
    const char* jpath = obs_data_get_string(settings, "json_path");
    if (jpath) {
        ctx->jsonPathW = utf8_to_utf16(jpath);
        load_from_json(ctx);
    }
}

static void* dr_create(obs_data_t* settings, obs_source_t* source)
{
    auto* ctx = new dr_keyboard_tracker_source();
    ctx->source = source;
    install_hook(ctx);
    dr_update(ctx, settings);
    return ctx;
}

static void dr_destroy(void* data)
{
    auto* ctx = reinterpret_cast<dr_keyboard_tracker_source*>(data);
    uninstall_hook(ctx);
    clear_textures(ctx);
    delete ctx;
}

static void dr_video_render(void* data, gs_effect_t* effect)
{
    auto* ctx = reinterpret_cast<dr_keyboard_tracker_source*>(data);
    (void)effect;
    // 清理滾輪瞬時狀態：共享狀態，使用本地靜態時間戳表
    static std::unordered_map<uint32_t, uint64_t> wheelExpire;
    const uint64_t nowMs = get_tick_ms();
    // 若先前設置過，過期後清 false
    {
        std::lock_guard<std::mutex> _g(dr_keyboard_tracker_source::stateMutex);
        for (auto it = wheelExpire.begin(); it != wheelExpire.end();) {
            if (nowMs >= it->second) {
                dr_keyboard_tracker_source::keyDownState[it->first] = false;
                it = wheelExpire.erase(it);
            } else {
                ++it;
            }
        }
    }

    for (auto& pair : ctx->vkToImages) {
        uint32_t code = pair.first;
        auto& list = pair.second;
        bool down = false;
        {
            std::lock_guard<std::mutex> _g(dr_keyboard_tracker_source::stateMutex);
            auto it = dr_keyboard_tracker_source::keyDownState.find(code);
            if (it != dr_keyboard_tracker_source::keyDownState.end()) down = it->second;
            // 當前一幀偵測到滾輪事件，設定過期時間（150ms）。僅對自訂滾輪代碼
            if ((code == 0x20001 || code == 0x20002) && down) {
                wheelExpire[code] = nowMs + 150;
            }
        }
        for (auto& img : list) {
            draw_texture(down ? img.downTexture : img.upTexture, img.x, img.y, img.width, img.height);
        }
    }
}

static uint32_t dr_width(void* data)
{
    // 寬度由場景排版決定，這裡回傳最大範圍
    auto* ctx = reinterpret_cast<dr_keyboard_tracker_source*>(data);
    if (ctx->canvasWidth > 0) return (uint32_t)ctx->canvasWidth;
    int maxX = 0;
    for (auto& pair : ctx->vkToImages) {
        auto& list = pair.second;
        for (auto& img : list) maxX = std::max(maxX, img.x + img.width);
    }
    return (uint32_t)maxX;
}

static uint32_t dr_height(void* data)
{
    auto* ctx = reinterpret_cast<dr_keyboard_tracker_source*>(data);
    if (ctx->canvasHeight > 0) return (uint32_t)ctx->canvasHeight;
    int maxY = 0;
    for (auto& pair : ctx->vkToImages) {
        auto& list = pair.second;
        for (auto& img : list) maxY = std::max(maxY, img.y + img.height);
    }
    return (uint32_t)maxY;
}

static obs_source_info dr_source_info;

bool obs_module_load(void)
{
    memset(&dr_source_info, 0, sizeof(dr_source_info));
    dr_source_info.id = "dr_keyboard_tracker";
    dr_source_info.type = OBS_SOURCE_TYPE_INPUT;
    dr_source_info.output_flags = OBS_SOURCE_VIDEO;
    dr_source_info.get_name = dr_get_name;
    dr_source_info.create = dr_create;
    dr_source_info.destroy = dr_destroy;
    dr_source_info.get_width = dr_width;
    dr_source_info.get_height = dr_height;
    dr_source_info.get_properties = dr_get_properties;
    dr_source_info.update = dr_update;
    dr_source_info.video_render = dr_video_render;
    obs_register_source(&dr_source_info);
    return true;
}


