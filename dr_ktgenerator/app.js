/* DR Keyboard Tracker - Image Generator */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const SCALE_KEYS = ['1x','1.25x','1.5x','1.75x','2x','2.25x','2.75x','6.25x'];
  const fileInputs = {}; const btnPickers = {}; const hints = {};
  SCALE_KEYS.forEach(s => {
    fileInputs[s] = document.getElementById(`fileBase_${s}`);
    btnPickers[s] = document.getElementById(`btnPickBase_${s}`);
    hints[s] = document.getElementById(`baseHint_${s}`);
  });
  const previewCanvas = $('#previewCanvas');
  const previewMeta = $('#previewMeta');
  const selPreviewKey = $('#selPreviewKey');
  const keyList = document.getElementById('keyList');
  const selectedIds = new Set();
  const selPreviewScale = document.getElementById('selPreviewScale');
  const previewScale = $('#previewScale');
  const btnSelectAllKeys = document.getElementById('btnSelectAllKeys');
  // 上半
  const selFontTop = $('#selFontTop');
  const fontSizeTop = $('#fontSizeTop');
  const fontWeightTop = $('#fontWeightTop');
  const colorTop = $('#colorTop');
  const strokeSizeTop = $('#strokeSizeTop');
  const strokeColorTop = $('#strokeColorTop');
  // 下半
  const selFontBottom = $('#selFontBottom');
  const fontSizeBottom = $('#fontSizeBottom');
  const fontWeightBottom = $('#fontWeightBottom');
  const colorBottom = $('#colorBottom');
  const strokeSizeBottom = $('#strokeSizeBottom');
  const strokeColorBottom = $('#strokeColorBottom');
  const labelOverride = document.getElementById('labelOverride');
  const btnImportFont = document.getElementById('btnImportFont');
  const fileFont = document.getElementById('fileFont');
  const localFontHint = document.getElementById('localFontHint');
  const btnExport = $('#btnExport');
  const btnLangEn = document.getElementById('btnLangEn');
  const btnLangZh = document.getElementById('btnLangZh');
  const toolbarHint = document.getElementById('toolbarHint');
  const rightListTitle = document.getElementById('rightListTitle');

  const ctx = previewCanvas.getContext('2d');

  // 簡易多語系
  const i18n = {
    en: {
      toolbar_hint: 'Choose a base image and style, the right side previews the final two-frame sprite.',
      base_title: 'Base Images (scales)',
      default_unit: 'Default unit (1x width)',
      import_prefix: 'Import',
      hint_base: 'Any size is supported. Output is always two-frame (up/down).',
      basic_title: 'Basic Settings',
      top_title: 'Top Text & Style (Up state)',
      bottom_title: 'Bottom Text & Style (Down state)',
      export_title: 'Export',
      export_hint: 'Export images according to each key\'s scale and style. Prefer "Select folder" to write files; if unsupported by the browser, a ZIP will be downloaded.',
      key_list: 'Key List',
      select_all: 'Select All',
      key_label: 'Key',
      text_label: 'Text',
      use_image: 'Use Image',
      font_label: 'Font',
      size_px: 'Size (px)',
      weight: 'Weight',
      text_color: 'Text color',
      stroke_px: 'Stroke (px)',
      stroke_color: 'Stroke color',
      import_font: 'Import font(s)',
      export_btn: 'Export images',
      image_label: 'Image',
    },
    zh: {
      toolbar_hint: '選擇基底圖片與字體樣式後，右側將預覽單一鍵的最終兩段式拼合圖。',
      base_title: '基底圖片（多倍率）',
      default_unit: '預設單位 (1x 寬度)',
      import_prefix: '匯入',
      hint_base: '支援任意尺寸。輸出將固定為上下兩半（未按/按下）。',
      basic_title: '基本設定',
      top_title: '上半字體與樣式（未按）',
      bottom_title: '下半字體與樣式（按下）',
      export_title: '匯出',
      export_hint: '依各鍵設定的倍率與樣式輸出。優先使用「選擇資料夾」直接輸出；若瀏覽器不支援，將下載 ZIP。',
      key_list: '按鍵列表',
      select_all: '全選',
      key_label: '按鍵',
      text_label: '文字',
      use_image: '使用圖片',
      font_label: '字型',
      size_px: '大小(px)',
      weight: '字重',
      text_color: '文字色',
      stroke_px: '描邊(px)',
      stroke_color: '描邊色',
      import_font: '匯入字型檔',
      export_btn: '匯出圖片檔',
      image_label: '圖片',
    }
  };
  let currentLang = 'en';
  function t(key){ return (i18n[currentLang] && i18n[currentLang][key]) || key; }
  function applyLanguage(){
    document.documentElement.lang = (currentLang==='en'?'en':'zh-Hant');
    if (toolbarHint) toolbarHint.textContent = t('toolbar_hint');
    const baseH3 = document.querySelector('#basePanel .panel-header h3'); if (baseH3) baseH3.textContent = t('base_title');
    const basicH3 = document.querySelector('#previewCtrlPanel .panel-header h3'); if (basicH3) basicH3.textContent = t('basic_title');
    const topH3 = document.querySelector('#fontPanelTop .panel-header h3'); if (topH3) topH3.textContent = t('top_title');
    const bottomH3 = document.querySelector('#fontPanelBottom .panel-header h3'); if (bottomH3) bottomH3.textContent = t('bottom_title');
    const exportH3 = document.querySelector('#exportPanel .panel-header h3'); if (exportH3) exportH3.textContent = t('export_title');
    if (rightListTitle) rightListTitle.textContent = t('key_list');
    const lblKey = document.querySelector('label[for="selPreviewKey"]'); if (lblKey) lblKey.textContent = t('key_label');
    const lblText = document.querySelector('label[for="labelOverride"]'); if (lblText) lblText.textContent = t('text_label');
    const lblUseImg = document.querySelector('label[for="selPreviewScale"]'); if (lblUseImg) lblUseImg.textContent = t('use_image');
    const btnFont = document.getElementById('btnImportFont'); if (btnFont) btnFont.textContent = t('import_font');
    const btnExp = document.getElementById('btnExport'); if (btnExp) btnExp.textContent = t('export_btn');
    const btnAll = document.getElementById('btnSelectAllKeys'); if (btnAll) btnAll.textContent = t('select_all');

    // 左側表單內文字輸入的 placeholder 也調整
    if (labelOverride) labelOverride.placeholder = (currentLang==='en' ? 'Auto symbol (overrideable)' : '自動符號（可覆寫）');

    // Base panel labels and buttons
    const lblUnit = document.querySelector('label[for="defaultUnitSize"]'); if (lblUnit) lblUnit.textContent = t('default_unit');
    // Import buttons by scale
    SCALE_KEYS.forEach(s => {
      const btn = document.getElementById(`btnPickBase_${s}`);
      if (btn) btn.textContent = `${t('import_prefix')} ${s}`;
    });
    const baseHint = document.querySelector('#basePanel .empty'); if (baseHint) baseHint.textContent = t('hint_base');
    const exportHint = document.querySelector('#exportPanel .hint'); if (exportHint) exportHint.textContent = t('export_hint');

    // Top/bottom field labels
    const lblFontTop = document.querySelector('label[for="selFontTop"]'); if (lblFontTop) lblFontTop.textContent = t('font_label');
    const lblSizeTop = document.querySelector('label[for="fontSizeTop"]'); if (lblSizeTop) lblSizeTop.textContent = t('size_px');
    const lblWeightTop = document.querySelector('label[for="fontWeightTop"]'); if (lblWeightTop) lblWeightTop.textContent = t('weight');
    const lblColorTop = document.querySelector('label[for="colorTop"]'); if (lblColorTop) lblColorTop.textContent = t('text_color');
    const lblStrokeSizeTop = document.querySelector('label[for="strokeSizeTop"]'); if (lblStrokeSizeTop) lblStrokeSizeTop.textContent = t('stroke_px');
    const lblStrokeColorTop = document.querySelector('label[for="strokeColorTop"]'); if (lblStrokeColorTop) lblStrokeColorTop.textContent = t('stroke_color');

    const lblFontBottom = document.querySelector('label[for="selFontBottom"]'); if (lblFontBottom) lblFontBottom.textContent = t('font_label');
    const lblSizeBottom = document.querySelector('label[for="fontSizeBottom"]'); if (lblSizeBottom) lblSizeBottom.textContent = t('size_px');
    const lblWeightBottom = document.querySelector('label[for="fontWeightBottom"]'); if (lblWeightBottom) lblWeightBottom.textContent = t('weight');
    const lblColorBottom = document.querySelector('label[for="colorBottom"]'); if (lblColorBottom) lblColorBottom.textContent = t('text_color');
    const lblStrokeSizeBottom = document.querySelector('label[for="strokeSizeBottom"]'); if (lblStrokeSizeBottom) lblStrokeSizeBottom.textContent = t('stroke_px');
    const lblStrokeColorBottom = document.querySelector('label[for="strokeColorBottom"]'); if (lblStrokeColorBottom) lblStrokeColorBottom.textContent = t('stroke_color');
    // 重新繪製預覽以更新 meta 等語系字串
    try { renderPreview(); } catch {}
  }
  if (btnLangEn) btnLangEn.addEventListener('click', () => { currentLang='en'; applyLanguage(); });
  if (btnLangZh) btnLangZh.addEventListener('click', () => { currentLang='zh'; applyLanguage(); });
  applyLanguage();

  // 與編輯器一致的建議檔名對應
  function generateKeyFilenameMapping() {
    return {
      a:'a', b:'b', c:'c', d:'d', e:'e', f:'f', g:'g', h:'h', i:'i', j:'j', k:'k', l:'l', m:'m', n:'n', o:'o', p:'p', q:'q', r:'r', s:'s', t:'t', u:'u', v:'v', w:'w', x:'x', y:'y', z:'z',
      '0':'0','1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9',
      f1:'f1',f2:'f2',f3:'f3',f4:'f4',f5:'f5',f6:'f6',f7:'f7',f8:'f8',f9:'f9',f10:'f10',f11:'f11',f12:'f12',
      escape:'esc', backspace:'backspace', tab:'tab', enter:'enter', space:'space',
      insert:'insert', delete:'delete', home:'home', end:'end', pageup:'page_up', pagedown:'page_down',
      printscreen:'print_screen', scrolllock:'scroll_lock', pause:'pause', capslock:'caps_lock', numlock:'num_lock',
      arrowup:'arrow_up', arrowdown:'arrow_down', arrowleft:'arrow_left', arrowright:'arrow_right',
      lshift:'left_shift', rshift:'right_shift', lctrl:'left_ctrl', rctrl:'right_ctrl', lalt:'left_alt', ralt:'right_alt', lmeta:'left_win', rmeta:'right_win', contextmenu:'menu',
      grave:'grave', minus:'minus', equal:'equal', bracketleft:'bracket_left', bracketright:'bracket_right', backslash:'backslash',
      semicolon:'semicolon', quote:'quote', comma:'comma', period:'period', slash:'slash',
      numpad0:'numpad_0', numpad1:'numpad_1', numpad2:'numpad_2', numpad3:'numpad_3', numpad4:'numpad_4', numpad5:'numpad_5', numpad6:'numpad_6', numpad7:'numpad_7', numpad8:'numpad_8', numpad9:'numpad_9',
      numpadadd:'numpad_add', numpadsubtract:'numpad_subtract', numpadmultiply:'numpad_multiply', numpaddivide:'numpad_divide', numpaddecimal:'numpad_decimal', numpadenter:'numpad_enter'
    };
  }

  const keyMapping = generateKeyFilenameMapping();
  let keyIds = Object.keys(keyMapping || {});
  // 保險：若某些環境造成 keyMapping 取不到，仍提供預設鍵集合
  if (!Array.isArray(keyIds) || keyIds.length === 0) {
    keyIds = ['a','b','c','f1','f2','escape','enter','space','arrowup','arrowdown','arrowleft','arrowright'];
  }
  if (selPreviewKey) {
  selPreviewKey.innerHTML = keyIds.map(k => `<option value="${k}">${k}</option>`).join('');
  selPreviewKey.value = keyIds[0];
  }

  const baseImages = {}; // scale -> HTMLImageElement
  const perKeyConfig = new Map(); // keyId -> { scale, labelOverride, top:{...}, bottom:{...} }
  let baseW = 256, baseH = 512; // 由目前預覽倍率的圖片決定
  let DEFAULT_UNIT_W = 64;    // 1x 預設寬（單格）
  const defaultUnitSizeSelect = document.getElementById('defaultUnitSize');
  if (defaultUnitSizeSelect) {
    // 初始選項已預設 64；切換時更新並重繪
    defaultUnitSizeSelect.addEventListener('change', () => {
      const v = Number(defaultUnitSizeSelect.value || 64);
      DEFAULT_UNIT_W = Math.max(1, Math.round(v));
      fitCanvasToBase();
      renderPreview();
    });
  }

  const defaultTopStyle = {
    fontFamily: "Arial, 'Noto Sans TC', 'Microsoft JhengHei', system-ui, sans-serif",
    fontSize: 24,
    fontWeight: '600',
    color: '#ffffff',
    strokeSize: 4,
    strokeColor: '#000000',
  };
  const defaultBottomStyle = {
    fontFamily: "Arial, 'Noto Sans TC', 'Microsoft JhengHei', system-ui, sans-serif",
    fontSize: 24,
    fontWeight: '600',
    color: '#ffd54f',
    strokeSize: 4,
    strokeColor: '#000000',
  };

  function suggestedFontSizeForKey(keyId) {
    const id = String(keyId || '').toLowerCase();
    // 指定 20：Ins/Del/End + 短縮功能鍵
    const size20 = new Set(['insert','delete','end','home','pageup','pagedown','printscreen','scrolllock','pause']);
    if (size20.has(id)) return 20;
    // 指定 24：Backspace/Menu/NumpadEnter
    const size24 = new Set(['backspace','contextmenu','numpadenter']);
    if (size24.has(id)) return 24;
    // 其餘預設不超過 24
    return 24;
  }

  function defaultScaleForKey(keyId) {
    const id = String(keyId || '').toLowerCase();
    const oneTwoFive = new Set(['ctrl','lctrl','rctrl','alt','lalt','ralt','win','meta','lmeta','rmeta']);
    if (id === 'tab') return '1.5x';
    if (id === 'capslock') return '1.75x';
    if (id === 'backspace') return '2x';
    if (id === 'enter' || id === 'lshift' || id === 'left_shift' || id === 'shiftleft') return '2.25x';
    if (id === 'rshift' || id === 'right_shift' || id === 'shiftright') return '2.75x';
    if (id === 'space' || id === 'spacebar') return '6.25x';
    if (id === 'backslash') return '1.5x';
    if (id === 'contextmenu') return '1.25x';
    if (oneTwoFive.has(id)) return '1.25x';
    // 標準字母與大多數一般鍵
    return '1x';
  }

  function ensureKeyConfig(keyId) {
    if (!perKeyConfig.has(keyId)) {
      const size = suggestedFontSizeForKey(keyId);
      perKeyConfig.set(keyId, {
        scale: defaultScaleForKey(keyId),
        labelOverride: '',
        top: { ...defaultTopStyle, fontSize: size },
        bottom: { ...defaultBottomStyle, fontSize: size },
      });
    }
    return perKeyConfig.get(keyId);
  }

  function isTwoFrameSprite(image) {
    // 不論尺寸，輸出固定上下兩半。若來源非兩格，視為單張並在下半覆寫同圖（可加深）。
    return Math.abs(image.height - image.width * 2) <= 2;
  }

  function imageForScaleOrFallback(scale) {
    if (baseImages[scale]) return baseImages[scale];
    for (const s of SCALE_KEYS) { if (baseImages[s]) return baseImages[s]; }
    return null;
  }
  function imageForExactScale(scale) {
    return baseImages[scale] || null;
  }
  function currentPreviewImage() {
    const keyId = selPreviewKey.value;
    const cfg = ensureKeyConfig(keyId);
    return imageForScaleOrFallback(cfg.scale);
  }

  function parseScaleFactor(scaleKey) {
    if (!scaleKey) return 1;
    const m = String(scaleKey).toLowerCase().match(/([0-9]+(?:\.[0-9]+)?)x/);
    if (m) return Number(m[1]) || 1;
    return 1;
  }

  function fitCanvasToBase() {
    const img = currentPreviewImage();
    if (!img) {
      const keyId = selPreviewKey.value;
      const cfg = ensureKeyConfig(keyId);
      const factor = parseScaleFactor(cfg.scale);
      baseW = Math.max(1, Math.round(DEFAULT_UNIT_W * factor));
      baseH = DEFAULT_UNIT_W * 2;
      previewCanvas.width = baseW;
      previewCanvas.height = baseH;
      return;
    }
    baseW = img.width;
    // 固定上下兩半輸出：若來源是單張，輸出高度=2*原高
    baseH = isTwoFrameSprite(img) ? img.height : img.height * 2;
    previewCanvas.width = baseW;
    previewCanvas.height = baseH;
  }

  // 將目前鍵的設定載入到表單並預填自動符號
  function loadKeyConfigToForm(keyId) {
    const cfg = ensureKeyConfig(keyId);
    if (selPreviewScale) selPreviewScale.value = cfg.scale;
    if (labelOverride) labelOverride.value = (cfg.labelOverride && cfg.labelOverride.trim()) || autoLabelForKey(keyId);
    // 上半
    if (selFontTop) selFontTop.value = cfg.top.fontFamily;
    if (fontSizeTop) fontSizeTop.value = cfg.top.fontSize;
    if (fontWeightTop) fontWeightTop.value = cfg.top.fontWeight;
    if (colorTop) colorTop.value = cfg.top.color;
    if (strokeSizeTop) strokeSizeTop.value = cfg.top.strokeSize;
    if (strokeColorTop) strokeColorTop.value = cfg.top.strokeColor;
    // 下半
    if (selFontBottom) selFontBottom.value = cfg.bottom.fontFamily;
    if (fontSizeBottom) fontSizeBottom.value = cfg.bottom.fontSize;
    if (fontWeightBottom) fontWeightBottom.value = cfg.bottom.fontWeight;
    if (colorBottom) colorBottom.value = cfg.bottom.color;
    if (strokeSizeBottom) strokeSizeBottom.value = cfg.bottom.strokeSize;
    if (strokeColorBottom) strokeColorBottom.value = cfg.bottom.strokeColor;
    // 若目前預覽倍率無對應圖片，嘗試以此鍵預設倍率載入畫布尺寸
    fitCanvasToBase();
    renderPreview();
  }

  // 將表單內容儲存回目前鍵的設定
  function saveFormToKeyConfig(keyId) {
    const cfg = ensureKeyConfig(keyId);
    if (selPreviewScale && selPreviewScale.value) cfg.scale = selPreviewScale.value;
    if (labelOverride) cfg.labelOverride = labelOverride.value || '';
    // 上半
    if (selFontTop) cfg.top.fontFamily = selFontTop.value;
    if (fontSizeTop) cfg.top.fontSize = Number(fontSizeTop.value || cfg.top.fontSize);
    if (fontWeightTop) cfg.top.fontWeight = String(fontWeightTop.value || cfg.top.fontWeight);
    if (colorTop) cfg.top.color = colorTop.value || cfg.top.color;
    if (strokeSizeTop) cfg.top.strokeSize = Number(strokeSizeTop.value || cfg.top.strokeSize);
    if (strokeColorTop) cfg.top.strokeColor = strokeColorTop.value || cfg.top.strokeColor;
    // 下半
    if (selFontBottom) cfg.bottom.fontFamily = selFontBottom.value;
    if (fontSizeBottom) cfg.bottom.fontSize = Number(fontSizeBottom.value || cfg.bottom.fontSize);
    if (fontWeightBottom) cfg.bottom.fontWeight = String(fontWeightBottom.value || cfg.bottom.fontWeight);
    if (colorBottom) cfg.bottom.color = colorBottom.value || cfg.bottom.color;
    if (strokeSizeBottom) cfg.bottom.strokeSize = Number(strokeSizeBottom.value || cfg.bottom.strokeSize);
    if (strokeColorBottom) cfg.bottom.strokeColor = strokeColorBottom.value || cfg.bottom.strokeColor;
  }

  function autoLabelForKey(keyId) {
    const symbols = {
      grave: '~', minus: '-', equal: '=', bracketleft: '[', bracketright: ']', backslash: '\\',
      semicolon: ';', quote: "'", comma: ',', period: '.', slash: '/',
      // Numpad operator keys should show symbols by default
      numpadadd: '+', numpadsubtract: '-', numpadmultiply: '*', numpaddivide: '/', numpaddecimal: '.',
      numpadenter: 'Enter',
      // Arrow keys
      arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→',
    };
    const shortNames = {
      escape: 'Esc', backspace: 'Backspace', tab: 'Tab', enter: 'Enter', space: 'Space',
      insert: 'Ins', delete: 'Del', home: 'Home', end: 'End', pageup: 'PgUp', pagedown: 'PgDn',
      printscreen: 'PrtSc', scrolllock: 'ScrLk', pause: 'Pause', capslock: 'Caps', numlock: 'Num',
      contextmenu: 'Menu',
      ctrl: 'Ctrl', shift: 'Shift', alt: 'Alt', meta: 'Win',
      lctrl: 'Ctrl', rctrl: 'Ctrl', lshift: 'Shift', rshift: 'Shift', lalt: 'Alt', ralt: 'Alt', lmeta: 'Win', rmeta: 'Win',
    };
    if (shortNames[keyId]) return shortNames[keyId];
    const m = /^numpad([0-9])$/.exec(keyId || '');
    if (m) return m[1];
    const f = /^f(1[0-2]|[1-9])$/.exec(keyId || '');
    if (f) return `F${f[1]}`;
    if (symbols[keyId]) return symbols[keyId];
    if (/^[a-z0-9]$/.test(keyId)) return keyId.toUpperCase();
    return keyId;
  }
  function labelForKeyWithOverride(keyId) {
    const cfg = ensureKeyConfig(keyId);
    const v = (cfg.labelOverride || '').trim();
    return v ? v : autoLabelForKey(keyId);
  }

  function drawOutlinedText(context, text, x, y, fill, strokeW, strokeC) {
    if (strokeW > 0) {
      context.lineWidth = strokeW;
      context.strokeStyle = strokeC;
      context.strokeText(text, x, y);
    }
    context.fillStyle = fill;
    context.fillText(text, x, y);
  }

  async function importFontFile(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const blob = new Blob([arrayBuffer]);
      const url = URL.createObjectURL(blob);
      const family = file.name.replace(/\.[^.]+$/, '');
      const face = new FontFace(family, `url(${url})`);
      await face.load();
      document.fonts.add(face);
      const optionHtml = `<option value="${family}, 'Noto Sans TC', 'Microsoft JhengHei', system-ui, sans-serif">${family}</option>`;
      if (selFontTop) selFontTop.insertAdjacentHTML('beforeend', optionHtml);
      if (selFontBottom) selFontBottom.insertAdjacentHTML('beforeend', optionHtml);
      if (localFontHint) localFontHint.textContent = `已匯入字型：${family}`;
    } catch (e) {
      alert('匯入字型失敗：' + (e && e.message ? e.message : '未知錯誤'));
    }
  }

  function renderPreview() {
    ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    const img = currentPreviewImage();
    if (!img) {
      // 無基底時：以純色區塊表示上下半，避免全黑
      if (previewCanvas.width === 0 || previewCanvas.height === 0) {
        previewCanvas.width = 256; previewCanvas.height = 512;
      }
      const half = Math.floor(previewCanvas.height / 2);
      ctx.fillStyle = '#0b1220';
      ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, 0, previewCanvas.width, half);
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(0, half, previewCanvas.width, previewCanvas.height - half);
    } else {
      // 上半（未按）
      if (isTwoFrameSprite(img)) {
        ctx.drawImage(img, 0, 0, baseW, Math.floor(baseH/2), 0, 0, baseW, Math.floor(baseH/2));
        // 下半（按下）
        ctx.drawImage(img, 0, Math.floor(baseH/2), baseW, Math.floor(baseH/2), 0, Math.floor(baseH/2), baseW, Math.floor(baseH/2));
      } else {
        // 單張：上下同圖
        ctx.drawImage(img, 0, 0, baseW, Math.floor(baseH/2));
        ctx.drawImage(img, 0, Math.floor(baseH/2), baseW, Math.floor(baseH/2));
      }
    }

    const keyId = selPreviewKey.value;
    // 確保文字輸入框有預設值（第一次載入或為空時）
    if (labelOverride && (!labelOverride.value || !labelOverride.value.trim())) {
      labelOverride.value = autoLabelForKey(keyId);
    }
    const label = labelForKeyWithOverride(keyId);
    // 上半樣式
    const fsTop = Math.max(6, Number(fontSizeTop.value || 64));
    const fwTop = String(fontWeightTop.value || '600');
    const fontFamilyTop = selFontTop.value || "'Noto Sans TC', system-ui, sans-serif";
    const strokeWTop = Math.max(0, Number(strokeSizeTop.value || 0));
    const strokeCTop = String(strokeColorTop.value || '#000');
    const fillTop = String(colorTop.value || '#fff');
    // 下半樣式
    const fsBottom = Math.max(6, Number(fontSizeBottom.value || 64));
    const fwBottom = String(fontWeightBottom.value || '600');
    const fontFamilyBottom = selFontBottom.value || "'Noto Sans TC', system-ui, sans-serif";
    const strokeWBottom = Math.max(0, Number(strokeSizeBottom.value || 0));
    const strokeCBottom = String(strokeColorBottom.value || '#000');
    const fillBottom = String(colorBottom.value || '#ffd54f');

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${fwTop} ${fsTop}px ${fontFamilyTop}`;
    drawOutlinedText(ctx, label, Math.floor(baseW/2), Math.floor(baseH/4), fillTop, strokeWTop, strokeCTop);
    ctx.font = `${fwBottom} ${fsBottom}px ${fontFamilyBottom}`;
    drawOutlinedText(ctx, label, Math.floor(baseW/2), Math.floor(baseH*3/4), fillBottom, strokeWBottom, strokeCBottom);

    const cfg = ensureKeyConfig(keyId);
    previewMeta.textContent = `${baseW} x ${baseH} | Key: ${keyId} → ${keyMapping[keyId]}.png | ${t('image_label')}: ${cfg.scale}`;

    // 預覽縮放已移除，維持原始尺寸
    previewCanvas.style.width = '';
    previewCanvas.style.height = '';
  }

  function readImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    });
  }

  function refineFileName(baseName) {
    return String(baseName).replace(/[^a-z0-9_\-]+/gi, '_');
  }

  async function exportAllImages() {
    const hasAnyImage = SCALE_KEYS.some(k => !!baseImages[k]);
    let includeDefaults = false;
    if (!hasAnyImage) {
      const ok = window.confirm('目前未匯入任何圖片。將以預設空白底（依倍率套寬，固定上下兩半）輸出所有鍵。是否繼續？');
      if (!ok) return;
      includeDefaults = true;
    } else {
      // 檢查是否有鍵使用了尚未匯入的倍率圖片
      const missing = [];
      keyIds.forEach(id => {
        const cfg = ensureKeyConfig(id);
        if (!imageForExactScale(cfg.scale)) missing.push(`${id} (${cfg.scale})`);
      });
      if (missing.length > 0) {
        const ok1 = window.confirm(`下列按鍵尚未匯入對應倍率的圖片：\n\n- ${missing.join('\n- ')}\n\n是否繼續？`);
        if (!ok1) return;
        includeDefaults = window.confirm('是否同時輸出這些「未匯入圖片」的預設空白底圖檔？\n是：全部鍵都輸出（匯入的用圖片，未匯入的用預設）。\n否：僅輸出有匯入圖片的按鍵。');
      }
    }
    // 先渲染一張通用畫布，逐鍵覆蓋文字後輸出
    const canvas = document.createElement('canvas');
    const c2d = canvas.getContext('2d');
    async function canvasToPngBlob(cnv) {
      return new Promise((resolve) => {
        cnv.toBlob((b) => {
          if (b) return resolve(b);
          // 極端情況備援：轉 dataURL 再還原 blob
          const dataUrl = cnv.toDataURL('image/png');
          fetch(dataUrl).then(r => r.blob()).then(resolve).catch(() => resolve(new Blob()));
        }, 'image/png');
      });
    }

    // 嘗試使用 File System Access API 直接輸出到資料夾
    const canUseFS = 'showDirectoryPicker' in window;
    let dirHandle = null;
    if (canUseFS) {
      try {
        dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      } catch (e) {
        // 使用者取消或權限失敗，退回 ZIP
        dirHandle = null;
      }
    }

    const zip = new JSZip();
    const outputs = [];

    for (const keyId of keyIds) {
      const cfg = ensureKeyConfig(keyId);
      const exactImg = hasAnyImage ? imageForExactScale(cfg.scale) : null;
      const img = exactImg; // 僅使用精確倍率的圖片
      let outW, outH;
      if (img) {
        outW = img.width; outH = isTwoFrameSprite(img) ? img.height : img.height * 2;
      } else {
        const factor = parseScaleFactor(cfg.scale);
        outW = Math.max(1, Math.round(DEFAULT_UNIT_W * factor));
        outH = DEFAULT_UNIT_W * 2;
      }
      if (canvas.width !== outW || canvas.height !== outH) { canvas.width = outW; canvas.height = outH; }
      // 背景
      c2d.clearRect(0, 0, canvas.width, canvas.height);
      if (img) {
        if (isTwoFrameSprite(img)) {
          c2d.drawImage(img, 0, 0, outW, Math.floor(outH/2), 0, 0, outW, Math.floor(outH/2));
          c2d.drawImage(img, 0, Math.floor(outH/2), outW, Math.floor(outH/2), 0, Math.floor(outH/2), outW, Math.floor(outH/2));
        } else {
          c2d.drawImage(img, 0, 0, outW, Math.floor(outH/2));
          c2d.drawImage(img, 0, Math.floor(outH/2), outW, Math.floor(outH/2));
        }
      } else if (includeDefaults || !hasAnyImage) {
        // 空白底：與預覽一致的示意色塊
        c2d.fillStyle = '#0b1220';
        c2d.fillRect(0, 0, outW, outH);
        c2d.fillStyle = '#334155';
        c2d.fillRect(0, 0, outW, Math.floor(outH/2));
        c2d.fillStyle = '#1f2937';
        c2d.fillRect(0, Math.floor(outH/2), outW, Math.floor(outH/2));
      } else {
        // 使用者選擇不輸出未匯入圖片的鍵，直接跳過
        continue;
      }

      // 文字
      c2d.textAlign = 'center';
      c2d.textBaseline = 'middle';
      // 上半樣式
      const t = cfg.top; const b = cfg.bottom;
      c2d.font = `${t.fontWeight} ${t.fontSize}px ${t.fontFamily}`;
      const label = labelForKeyWithOverride(keyId);
      drawOutlinedText(c2d, label, Math.floor(outW/2), Math.floor(outH/4), t.color, t.strokeSize, t.strokeColor);
      c2d.font = `${b.fontWeight} ${b.fontSize}px ${b.fontFamily}`;
      drawOutlinedText(c2d, label, Math.floor(outW/2), Math.floor(outH*3/4), b.color, b.strokeSize, b.strokeColor);

      const fileBase = keyMapping[keyId] || keyId;
      const fileName = `${refineFileName(fileBase)}.png`;
      const blob = await canvasToPngBlob(canvas);
      outputs.push({ fileName, blob });
    }

    if (outputs.length === 0) {
      alert('沒有任何檔案可匯出。請匯入圖片或允許輸出預設圖片後再試。');
      return;
    }

    if (dirHandle) {
      try {
        for (const { fileName, blob } of outputs) {
          const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
        }
        alert('匯出完成！');
        return;
      } catch (e) {
        const fallback = window.confirm('寫入資料夾失敗，是否改為下載 ZIP？');
        if (!fallback) return;
      }
    }

    // ZIP 下載（無資料夾或改為 fallback）
    outputs.forEach(({ fileName, blob }) => zip.file(fileName, blob));
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(zipBlob);
    a.download = 'dr_keyboard_images.zip';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function refreshKeyList() {
    if (!keyList) return;
    keyList.innerHTML = '';
    keyIds.forEach(id => {
      const li = document.createElement('li');
      const cfg = ensureKeyConfig(id);
      const label = labelForKeyWithOverride(id);
      li.innerHTML = `<span>${id}</span><span>${label}</span>`;
      if (selectedIds.has(id) || (selectedIds.size === 0 && selPreviewKey && selPreviewKey.value === id)) li.classList.add('active');
      li.addEventListener('click', (e) => {
        // Ctrl 支援多選/取消
        if (e.ctrlKey) {
          if (selectedIds.has(id)) selectedIds.delete(id); else selectedIds.add(id);
        } else {
          selectedIds.clear();
          selectedIds.add(id);
        }
        const primary = getPrimarySelectedId();
        if (selPreviewKey) selPreviewKey.value = primary;
        loadKeyConfigToForm(primary);
        refreshKeyList();
      });
      keyList.appendChild(li);
    });
  }

  function getPrimarySelectedId() {
    for (const id of selectedIds) return id;
    return selPreviewKey ? selPreviewKey.value : (keyIds[0] || 'a');
  }

  function saveFormToSelected() {
    const ids = selectedIds.size > 0 ? Array.from(selectedIds) : [selPreviewKey.value];
    ids.forEach(id => saveFormToKeyConfig(id));
    refreshKeyList();
  }

  // 事件繫結：多倍率匯入與預覽切換
  SCALE_KEYS.forEach(scaleKey => {
    const btn = btnPickers[scaleKey];
    const inp = fileInputs[scaleKey];
    const hint = hints[scaleKey];
    if (btn && inp) btn.addEventListener('click', () => inp.click());
    if (inp) inp.addEventListener('change', async () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      try {
        const img = await readImageFromFile(f);
        baseImages[scaleKey] = img;
        if (hint) hint.textContent = `${f.name} (${img.width}x${img.height})`;
        if (selPreviewScale.value === scaleKey) {
          fitCanvasToBase();
          renderPreview();
        }
      } catch {
        alert('讀取圖片失敗');
      }
    });
  });

  if (selPreviewScale) selPreviewScale.addEventListener('change', () => { saveFormToSelected(); fitCanvasToBase(); renderPreview(); });
  if (selPreviewKey) selPreviewKey.addEventListener('change', () => { selectedIds.clear(); selectedIds.add(selPreviewKey.value); loadKeyConfigToForm(selPreviewKey.value); refreshKeyList(); });
  if (btnSelectAllKeys) btnSelectAllKeys.addEventListener('click', () => {
    selectedIds.clear();
    keyIds.forEach(id => selectedIds.add(id));
    const primary = getPrimarySelectedId();
    if (selPreviewKey) selPreviewKey.value = primary;
    loadKeyConfigToForm(primary);
    refreshKeyList();
  });
  if (btnImportFont && fileFont) {
    btnImportFont.addEventListener('click', () => fileFont.click());
    fileFont.addEventListener('change', async () => {
      const files = fileFont.files ? Array.from(fileFont.files) : [];
      if (files.length === 0) return;
      for (const f of files) {
        await importFontFile(f);
      }
      renderPreview();
    });
  }

  [
   selFontTop, fontSizeTop, fontWeightTop, colorTop, strokeSizeTop, strokeColorTop,
   selFontBottom, fontSizeBottom, fontWeightBottom, colorBottom, strokeSizeBottom, strokeColorBottom,
   labelOverride]
    .forEach(el => el && el.addEventListener('input', () => { saveFormToSelected(); renderPreview(); }));

  // 初始化：給所有鍵建立預設配置與預設倍率，並載入目前鍵到表單
  keyIds.forEach(k => ensureKeyConfig(k));
  if (selPreviewKey) selectedIds.add(selPreviewKey.value);
  loadKeyConfigToForm(getPrimarySelectedId());
  refreshKeyList();
  btnExport.addEventListener('click', exportAllImages);

  // 初始化預覽畫布
  renderPreview();

  // 左側面板摺疊切換
  document.querySelectorAll('.panel .panel-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const panel = e.target.closest('.panel');
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      panel.classList.toggle('collapsed');
      btn.textContent = expanded ? '▸' : '▾';
    });
  });
})();


