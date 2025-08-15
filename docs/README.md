# DR_KeyboardTracker

[English](README.md) | [中文](README_zh-TW.md)

一個功能強大的 OBS Studio 插件，用於即時追蹤和顯示鍵盤與滑鼠的輸入狀態。專為實況主、內容創作者以及任何想要在直播或錄製過程中展示輸入操作的使用者而設計。

## 功能特色

- **即時輸入追蹤**：使用低階鉤子監控鍵盤和滑鼠輸入
- **動態視覺回饋**：顯示按下/未按下狀態的自訂圖片
- **彈性版面配置系統**：基於 JSON 的自訂按鍵排列配置
- **滑鼠支援**：追蹤滑鼠按鈕（左鍵、右鍵、中鍵、X1、X2）和滾輪
- **延伸按鍵支援**：處理延伸按鍵如方向鍵、數字鍵盤 Enter、右側修飾鍵
- **多語言支援**：內建本地化（英文、繁體中文、日文）
- **外部工具整合**：內建按鈕開啟編輯器和產生器工具

## 安裝說明

### 系統需求
- OBS Studio 28.0 或更新版本
- Windows 10/11 (64位元)
- Visual Studio 2022 (從原始碼建置時需要)

### 從原始碼建置

1. 複製儲存庫：
```bash
git clone https://github.com/Godpriest/DR_KeyboardTracker.git
cd DR_KeyboardTracker
```

2. 使用 CMake 建置：
```bash
mkdir build
cd build
cmake .. -G "Visual Studio 17 2022" -A x64
cmake --build . --config Release
```

3. 安裝到 OBS：
   - 複製 `DR_KeyboardTracker.dll` 到你的 OBS 插件目錄
   - 複製 `data` 資料夾內容到你的 OBS 資料目錄
   - 重新啟動 OBS Studio

### 快速建置腳本
使用提供的 `build.bat` 腳本（Windows）：
```bash
build.bat
```

## 使用方法

### 基本設定

1. 在 OBS Studio 中，新增來源：**來源** → **新增** → **鍵盤追蹤器**
2. 在插件屬性中選擇你的版面配置 JSON 檔案
3. 插件會自動載入圖片並根據你的配置顯示按鍵

### JSON 配置

插件讀取定義鍵盤版面配置的 JSON 檔案：

```json
{
  "canvas": {
    "width": 1920,
    "height": 1080
  },
  "keys": [
    {
      "id": "shift",
      "keyBinding": "shift",
      "vk": 16,
      "extended": false,
      "sprite": "shift.png",
      "x": 100,
      "y": 200,
      "w": 64,
      "h": 64
    }
  ]
}
```

### 按鍵屬性

- **id**：按鍵的唯一識別碼
- **keyBinding**：人類可讀的按鍵名稱（例如："shift"、"enter"、"space"）
- **vk**：虛擬按鍵碼（可選，如果未提供則自動偵測）
- **extended**：是否為延伸按鍵（例如：右側 Ctrl、方向鍵）
- **sprite**：圖片檔案路徑（相對於 JSON 檔案）
- **x, y**：位置座標
- **w, h**：寬度和高度
- **rotation**：旋轉角度（可選）

### 圖片需求

- **格式**：PNG、JPG、JPEG、WebP、BMP
- **結構**：每張圖片應包含兩種狀態：
  - 上半部：未按下狀態
  - 下半部：按下狀態
- **透明度**：完整 alpha 通道支援
- **命名**：使用描述性名稱或讓插件自動偵測副檔名

## 支援的輸入類型

### 鍵盤按鍵
- 所有標準按鍵（A-Z、0-9、功能鍵等）
- 修飾鍵（Shift、Ctrl、Alt）
- 特殊按鍵（Enter、Space、Backspace 等）
- 延伸按鍵（方向鍵、數字鍵盤按鍵、右側修飾鍵）

### 滑鼠事件
- **按鈕**：左鍵、右鍵、中鍵、X1（前進）、X2（後退）
- **滾輪**：上下滾動並提供視覺回饋

### 按鍵綁定範例

| 按鍵 | 綁定 | VK 碼 |
|------|------|--------|
| Shift | `shift` | 16 |
| Enter | `enter` | 13 |
| Space | `space` | 32 |
| 上箭頭 | `up` | 38 |
| 滑鼠左鍵 | `mouseleft` | 1 |
| 滾輪上 | `wheelup` | 0x0A01 |

## 外部工具

插件包含開啟外部工具的按鈕：

- **編輯器**：開啟鍵盤版面配置編輯器（`dr_kteditor/index.html`）
- **產生器**：開啟圖片產生器工具（`dr_ktgenerator/index.html`）

這些工具幫助你建立和修改版面配置，無需手動編輯 JSON 檔案。

## 本地化

插件支援多種語言：
- **英文 (en-US)**：預設語言
- **繁體中文 (zh-TW)**：繁體中文
- **日文 (ja-JP)**：日本語

語言選擇遵循你的 OBS Studio 語言設定。

## 疑難排解

### 常見問題

1. **沒有顯示**：檢查 JSON 檔案路徑和圖片檔案是否存在
2. **顏色錯誤**：確保圖片格式正確（建議使用帶透明度的 PNG）
3. **按鍵沒有反應**：驗證 JSON 中的 VK 碼和延伸標誌
4. **建置錯誤**：確保已正確安裝 Visual Studio 2022 和 CMake

### 除錯資訊

檢查 OBS Studio 日誌以獲取詳細錯誤訊息：
- **檔案**：`%APPDATA%\obs-studio\logs\`
- **尋找**："DR_KeyboardTracker" 條目

## 開發

### 專案結構
```
DR_KeyboardTracker/
├── src/                    # 原始碼
├── cmake/                  # CMake 配置
├── data/                   # 本地化檔案
├── dr_kteditor/           # 版面配置編輯器工具
├── dr_ktgenerator/        # 圖片產生器工具
└── CMakeLists.txt         # 建置配置
```

### 相依性
- **libobs**：OBS Studio 插件 API
- **nlohmann/json**：JSON 解析函式庫
- **Windows WIC**：圖片載入和處理
- **Windows Hooks**：輸入事件監控

### 建置
專案使用 CMake 配合 Visual Studio 2022 產生器。主要建置選項：
- **C++17**：需要現代 C++ 功能
- **UTF-8**：原始碼檔案以 UTF-8 編碼
- **MSVC**：Microsoft Visual C++ 編譯器

## 授權

版權所有 © 2025 Godpriest。保留所有權利。

## 貢獻

歡迎貢獻！請隨時提交問題、功能請求或拉取請求。

## 支援

如需支援和問題：
- 在 GitHub 上建立問題
- 檢查上方的疑難排解章節
- 檢視 OBS Studio 日誌以獲取錯誤詳細資訊

---

**注意**：此插件需要管理員權限來安裝低階輸入鉤子。確保 OBS Studio 以適當權限執行。
