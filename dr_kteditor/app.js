/* DR Keyboard Tracker Editor - Local HTML only */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const stage = $('#stage');
  const stageWrapper = $('#stageWrapper');
  const stageScaler = document.getElementById('stageScaler');
  const rightPanel = document.getElementById('rightPanel');
  const toggleRightPanel = document.getElementById('toggleRightPanel');
  const keyList = document.getElementById('keyList');
  const keySearch = document.getElementById('keySearch');
  const inputW = $('#canvasWidth');
  const inputH = $('#canvasHeight');
  const btnApplyCanvas = $('#applyCanvas');
  const selectTheme = document.getElementById('canvasTheme');
  const chkShowIds = document.getElementById('chkShowIds');
  const btnAddKey = $('#addKey');
  const canvasPanel = document.getElementById('canvasPanel');
  const toggleCanvasPanel = document.getElementById('toggleCanvasPanel');
  const toggleStartPanel = document.getElementById('toggleStartPanel');
  const toggleKeysPanel = document.getElementById('toggleKeysPanel');
  const togglePropPanel = document.getElementById('togglePropPanel');
  const btnImportJson = document.getElementById('btnImportJson');
  const btnPickImageDir = document.getElementById('btnPickImageDir');
  const fileImportJson = document.getElementById('fileImportJson');
  const btnImportImages = document.getElementById('btnImportImages');
  const fileImportImages = document.getElementById('fileImportImages');
  const dirPickImageBase = document.getElementById('dirPickImageBase');
  const btnDownloadKeyMap = document.getElementById('btnDownloadKeyMap');
  const keyBaseSize = document.getElementById('keyBaseSize');
  const keyGap = document.getElementById('keyGap');
  const layoutPreset = document.getElementById('layoutPreset');
  const btnApplyLayout = document.getElementById('btnApplyLayout');
  const btnLangEn = document.getElementById('btnLangEn');
  const btnLangZh = document.getElementById('btnLangZh');
  // 取消「圖片使用相對路徑」選項，匯出時一律輸出目前持有的 sprite（若為 URL 則保留，若為 blob 仍為 blob）
  const propPanel = $('#propPanel');
  // Collapsible panels (start/keys/props)
  const startPanel = document.getElementById('startPanel');
  const keysPanel = document.getElementById('keysPanel');
  const emptyProps = propPanel.querySelector('.empty');
  const propsBox = propPanel.querySelector('.fields');
  const rowId = document.getElementById('rowId');
  const rowKey = document.getElementById('rowKey');
  const rowKeyBtns = document.getElementById('rowKeyBtns');
  const rowSprite = document.getElementById('rowSprite');
  const rowSpriteBtn = document.getElementById('rowSpriteBtn');
  const rowPos = document.getElementById('rowPos');
  const rowRot = document.getElementById('rowRot');
  const selectionGuides = document.getElementById('selectionGuides');
  const guideV = selectionGuides ? selectionGuides.querySelector('.guide.v') : null;
  const guideH = selectionGuides ? selectionGuides.querySelector('.guide.h') : null;
  const fileSprite = document.getElementById('fileSprite');
  const btnPickSprite = document.getElementById('btnPickSprite');
  const propSpriteHint = document.getElementById('propSpriteHint');
  const multiBox = document.getElementById('multiBox');
  // 圖片目錄快取：檔名(含副檔名)->URL、檔名不含副檔名->URL
  let imageNameToUrl = new Map();
  let imageBaseNameToUrl = new Map();
  // 反向對照：URL(ObjectURL) -> 原始檔名（含副檔名），用於匯出時還原檔名
  let imageUrlToName = new Map();
  let lastDirObjectUrls = [];
  let currentImportSession = 0;
  let pendingFixTimer = null;

  const propId = $('#propId');
  const propKeyBinding = $('#propKeyBinding');
  const btnStartBind = document.getElementById('btnStartBind');
  const btnClearBind = document.getElementById('btnClearBind');
  const propSprite = document.getElementById('propSprite');
  const propX = $('#propX');
  const propY = $('#propY');
  const propW = $('#propW');
  const propH = $('#propH');
  const propRot = $('#propRot');
  const btnDelete = $('#deleteKey');
  const btnExport = $('#exportJson');
  const fileSaveJson = document.getElementById('fileSaveJson');
  const propFields = document.getElementById('propFields');
  const multiSelectHint = document.getElementById('multiSelectHint');
  const multiArrange = document.getElementById('multiArrange');
  const multiAlign = document.getElementById('multiAlign');
  const multiHSpace = document.getElementById('multiHSpace');
  const multiVSpace = document.getElementById('multiVSpace');
  const btnApplyHSpace = document.getElementById('btnApplyHSpace');
  const btnApplyVSpace = document.getElementById('btnApplyVSpace');
  const btnAlignX = document.getElementById('btnAlignX');
  const btnAlignY = document.getElementById('btnAlignY');

  let keyCounter = 1;
  let selected = null;
  let selectedSet = new Set();
  const keys = new Map();

  function displaySpriteTextFor(el) {
    if (!el) return '';
    // 優先顯示原始檔名
    const name = (el.dataset.spriteName || '').trim();
    if (name) return name;
    // 退回顯示路徑末段（非 blob）
    const src = (el.dataset.sprite || '').trim();
    if (src && !/^blob:/i.test(src)) {
      try { const u = new URL(src, window.location.href); return u.pathname.split('/').pop() || src; } catch { return src.split(/[/\\]/).pop() || src; }
    }
    return '';
  }

  // --- Undo history (Ctrl+Z) ---
  const historyStack = [];
  const HISTORY_LIMIT = 100;
  let isRestoringState = false;
  let historyDebounceTimer = null;
  function snapshotState() {
    return {
      canvas: { width: Math.round(stage.clientWidth), height: Math.round(stage.clientHeight) },
      keys: Array.from(keys.values()).map(el => ({
        id: el.dataset.id,
        keyBinding: el.dataset.keyBinding || '',
        sprite: el.dataset.sprite || '',
        x: Math.round(parseFloat(el.style.left) || 0),
        y: Math.round(parseFloat(el.style.top) || 0),
        w: Math.round(el.offsetWidth),
        h: Math.round(el.offsetHeight),
        rotation: (() => {
          const m = /rotate\(([-0-9.]+)deg\)/.exec(el.style.transform || '');
          return m ? Number(m[1]) : 0;
        })()
      }))
    };
  }
  function pushHistory() {
    if (isRestoringState) return;
    historyStack.push(snapshotState());
    if (historyStack.length > HISTORY_LIMIT) historyStack.shift();
  }
  function scheduleHistoryDebounced(delayMs = 1000) {
    if (isRestoringState) return;
    if (historyDebounceTimer) clearTimeout(historyDebounceTimer);
    historyDebounceTimer = setTimeout(() => {
      historyDebounceTimer = null;
      pushHistory();
    }, delayMs);
  }
  function restoreState(state) {
    isRestoringState = true;
    // Clear existing
    keys.clear();
    stage.querySelectorAll('.key').forEach(n => n.remove());
    setStageSize(state.canvas.width, state.canvas.height);
    // Re-create
    state.keys.forEach(k => {
      const el = createKeyElement({ id: k.id, x: k.x, y: k.y, w: k.w, h: k.h, rotation: k.rotation, sprite: k.sprite });
      el.dataset.keyBinding = k.keyBinding || '';
      if (k.sprite) {
        el.dataset.sprite = k.sprite;
        applySpriteToElement(el);
        // Override with saved dimensions (in case image changes)
        el.style.width = `${k.w}px`;
        el.style.height = `${k.h}px`;
      }
    });
    clearSelection();
    refreshKeyList();
    isRestoringState = false;
  }
  function undoLast() {
    if (historyStack.length === 0) return;
    const prev = historyStack.pop();
    restoreState(prev);
  }

  function setStageSize(w, h) {
    stage.style.width = `${w}px`;
    stage.style.height = `${h}px`;
  }

  // Pan & Zoom state
  let scale = 1;
  let offsetX = 0; // CSS translate in wrapper space
  let offsetY = 0;
  const MIN_SCALE = 0.2;
  const MAX_SCALE = 4;
  const VISIBLE_MARGIN = 100; // 最多露出畫布外 100px

  function clampOffsets() {
    const w = stage.offsetWidth;  // 未縮放的寬
    const h = stage.offsetHeight; // 未縮放的高
    const scaledW = w * scale;
    const scaledH = h * scale;
    const vw = stageWrapper.clientWidth;
    const vh = stageWrapper.clientHeight;

    // 允許中鍵拖曳最多讓畫布邊界外露 100px
    let minX = vw - scaledW - VISIBLE_MARGIN; // 往左最多
    let maxX = VISIBLE_MARGIN;                 // 往右最多
    let minY = vh - scaledH - VISIBLE_MARGIN; // 往上最多
    let maxY = VISIBLE_MARGIN;                 // 往下最多

    // 若畫布比視窗小，則以中心附近為基準，允許 +/- 100px 的餘度
    if (scaledW + VISIBLE_MARGIN * 2 <= vw) {
      const centerOffsetX = (vw - scaledW) / 2;
      minX = centerOffsetX - VISIBLE_MARGIN;
      maxX = centerOffsetX + VISIBLE_MARGIN;
    }
    if (scaledH + VISIBLE_MARGIN * 2 <= vh) {
      const centerOffsetY = (vh - scaledH) / 2;
      minY = centerOffsetY - VISIBLE_MARGIN;
      maxY = centerOffsetY + VISIBLE_MARGIN;
    }

    offsetX = Math.max(minX, Math.min(maxX, offsetX));
    offsetY = Math.max(minY, Math.min(maxY, offsetY));
  }

  function applyTransform() {
    clampOffsets();
    stageScaler.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
  }

  function createKeyElement(initial) {
    const el = document.createElement('div');
    el.className = 'key';
    el.tabIndex = 0;
    el.style.left = `${initial.x}px`;
    el.style.top = `${initial.y}px`;
    el.style.width = `${initial.w}px`;
    el.style.height = `${initial.h}px`;
    el.style.transform = `rotate(${initial.rotation || 0}deg)`;
    el.dataset.id = initial.id;
    el.dataset.keyBinding = initial.keyBinding || '';
    el.dataset.sprite = initial.sprite || '';

    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = initial.id;
    el.appendChild(label);

    const handle = document.createElement('div');
    handle.className = 'handle';
    el.appendChild(handle);

    if (!initial.sprite) {
      // default visual placeholder
      const svg = `url("data:image/svg+xml;utf8,${encodeURIComponent(`
        <svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'>
          <rect x='0' y='0' width='64' height='64' fill='none' stroke='%23bcd3ff' stroke-width='2'/>
        </svg>
      `)}")`;
      el.style.backgroundImage = svg;
      el.style.backgroundSize = 'contain';
      el.style.backgroundRepeat = 'no-repeat';
    } else {
      el.classList.add('sprite');
      el.style.backgroundImage = `url('${initial.sprite}')`;
    }

    enableDrag(el);
    enableResize(el, handle);

    stage.appendChild(el);
    keys.set(initial.id, el);
    refreshKeyList();
    pushHistory();
    return el;
  }

  function enableDrag(el) {
    let startX = 0, startY = 0, origX = 0, origY = 0;
    const clampToStage = (x, y, elem) => {
      const maxX = Math.max(0, stage.clientWidth - elem.offsetWidth);
      const maxY = Math.max(0, stage.clientHeight - elem.offsetHeight);
      return [Math.min(Math.max(0, x), maxX), Math.min(Math.max(0, y), maxY)];
    };

    const onMouseDown = (e) => {
      if (e.target.classList.contains('handle')) return; // resize handle
      // Ctrl 支援多選切換
      if (e.ctrlKey) {
        // 若目前是單選，先提升為多選
        ensureSelectedPromotedToMulti();
        if (selectedSet.has(el)) {
          el.classList.remove('selected');
          selectedSet.delete(el);
        } else {
          selectedSet.add(el);
          el.classList.add('selected');
        }
        selected = null; // 進入多選模式
        updatePropPanel();
        updateMultiBox();
        refreshKeyList();
      } else {
        // 若物件在多選集合中，啟用群組拖曳；否則單選
        if (selectedSet.has(el) || (selected && selected === el)) {
          if (!selectedSet.has(el)) clearMultiSelection();
          if (!selectedSet.has(el)) selectedSet.add(el);
        } else {
          selectKey(el);
        }
      }
      startX = e.clientX; startY = e.clientY;
      // record original positions (unscaled)
      origX = parseFloat(el.style.left) || 0;
      origY = parseFloat(el.style.top) || 0;
      // snapshot originals for group drag
      if (selectedSet.size > 0) {
        el._dragOriginals = Array.from(selectedSet).map(node => ({
          node,
          x: parseFloat(node.style.left) || 0,
          y: parseFloat(node.style.top) || 0,
        }));
      } else {
        el._dragOriginals = null;
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      e.preventDefault();
    };
    const onMove = (e) => {
      const dx = (e.clientX - startX) / scale;
      const dy = (e.clientY - startY) / scale;
      if (selectedSet.size > 0 && el._dragOriginals) {
        // 群組拖曳：計算群組可用的 dx/dy 範圍，任何一個物件碰到邊界即整組停止
        const stageMaxXFor = (node) => Math.max(0, stage.clientWidth - node.offsetWidth);
        const stageMaxYFor = (node) => Math.max(0, stage.clientHeight - node.offsetHeight);

        // 允許的位移界線（群組共同）
        let lowerDx = -Infinity, upperDx = Infinity;
        let lowerDy = -Infinity, upperDy = Infinity;
        el._dragOriginals.forEach(({ node, x, y }) => {
          const minDxForNode = -x;                         // 不可再往左超過 0
          const maxDxForNode = stageMaxXFor(node) - x;    // 不可再往右超過邊界
          const minDyForNode = -y;
          const maxDyForNode = stageMaxYFor(node) - y;
          // 交集
          lowerDx = Math.max(lowerDx, minDxForNode);
          upperDx = Math.min(upperDx, maxDxForNode);
          lowerDy = Math.max(lowerDy, minDyForNode);
          upperDy = Math.min(upperDy, maxDyForNode);
        });

        // 將 dx/dy 限制在群組共同可行區間
        const allowedDx = Math.min(Math.max(dx, lowerDx), upperDx);
        const allowedDy = Math.min(Math.max(dy, lowerDy), upperDy);

        let minX = Infinity, minY = Infinity;
        el._dragOriginals.forEach(({ node, x, y }) => {
          const nx = Math.round(x + allowedDx);
          const ny = Math.round(y + allowedDy);
          node.style.left = `${nx}px`;
          node.style.top = `${ny}px`;
          minX = Math.min(minX, nx);
          minY = Math.min(minY, ny);
        });
        updateMultiBox();
        if (Number.isFinite(minX)) propX.value = minX;
        if (Number.isFinite(minY)) propY.value = minY;
      } else {
        let newX = Math.round(origX + dx);
        let newY = Math.round(origY + dy);
        const clamped = clampToStage(newX, newY, el);
        newX = clamped[0]; newY = clamped[1];
        el.style.left = `${newX}px`;
        el.style.top = `${newY}px`;
        if (selected === el) {
          propX.value = newX;
          propY.value = newY;
          if (selectionGuides) {
            if (guideV) guideV.style.left = `${newX}px`;
            if (guideH) guideH.style.top = `${newY}px`;
            selectionGuides.classList.remove('hidden');
          }
        }
      }
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      // 拖曳結束：視為一個步驟
      pushHistory();
    };
    el.addEventListener('mousedown', onMouseDown);
  }

  function enableResize(el, handle) { /* 尺寸由 sprite 自動決定，禁用手動縮放 */ }

  function selectKey(el) {
    clearMultiSelection();
    if (selected === el) return;
    if (selected) selected.classList.remove('selected');
    selected = el;
    if (selected) selected.classList.add('selected');
    updatePropPanel();
    refreshKeyList();
  }

  function clearSelection() {
    if (selected) selected.classList.remove('selected');
    selected = null;
    clearMultiSelection();
    updatePropPanel();
  }

  function clearMultiSelection() {
    selectedSet.forEach(el => el.classList.remove('selected'));
    selectedSet.clear();
  }

  function updatePropPanel() {
    const hasMulti = selectedSet.size > 0;
    if (!selected && !hasMulti) {
      emptyProps.classList.remove('hidden');
      propsBox.classList.add('hidden');
      if (selectionGuides) selectionGuides.classList.add('hidden');
      if (multiBox) multiBox.classList.add('hidden');
      return;
    }
    emptyProps.classList.add('hidden');
    propsBox.classList.remove('hidden');
    if (hasMulti) {
      let minX = Infinity, minY = Infinity;
      selectedSet.forEach(el => {
        const x = Math.round(parseFloat(el.style.left) || 0);
        const y = Math.round(parseFloat(el.style.top) || 0);
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
      });
      propX.value = isFinite(minX) ? minX : 0;
      propY.value = isFinite(minY) ? minY : 0;
      // 顯示/隱藏需要的欄位
      if (rowId) rowId.classList.add('hidden');
      if (rowKey) rowKey.classList.add('hidden');
      if (rowKeyBtns) rowKeyBtns.classList.add('hidden');
      if (rowSprite) rowSprite.classList.add('hidden');
      if (rowSpriteBtn) rowSpriteBtn.classList.add('hidden');
      if (propSpriteHint) propSpriteHint.classList.add('hidden');
      if (rowRot) rowRot.classList.add('hidden');
      if (rowPos) rowPos.classList.remove('hidden');
      if (document.getElementById('multiSelectHint')) document.getElementById('multiSelectHint').classList.remove('hidden');
      if (btnDelete) btnDelete.textContent = '刪除這些按鍵';
      if (selectionGuides) selectionGuides.classList.add('hidden');
      // 更新多選外框
      updateMultiBox();
      if (multiArrange) multiArrange.classList.remove('hidden');
      if (multiAlign) multiAlign.classList.remove('hidden');
    } else if (selected) {
      const id = selected.dataset.id;
      propId.value = id;
      propKeyBinding.value = selected.dataset.keyBinding || '';
      if (propSprite) propSprite.value = displaySpriteTextFor(selected);
      propX.value = Math.round(parseFloat(selected.style.left) || 0);
      propY.value = Math.round(parseFloat(selected.style.top) || 0);
      const rotMatch = /rotate\(([-0-9.]+)deg\)/.exec(selected.style.transform || '') || [null, '0'];
      propRot.value = parseFloat(rotMatch[1]);
      if (rowId) rowId.classList.remove('hidden');
      if (rowKey) rowKey.classList.remove('hidden');
      if (rowKeyBtns) rowKeyBtns.classList.remove('hidden');
      if (rowSprite) rowSprite.classList.remove('hidden');
      if (rowSpriteBtn) rowSpriteBtn.classList.remove('hidden');
      if (propSpriteHint) propSpriteHint.classList.remove('hidden');
      if (rowRot) rowRot.classList.remove('hidden');
      if (rowPos) rowPos.classList.remove('hidden');
      const hint = document.getElementById('multiSelectHint'); if (hint) hint.classList.add('hidden');
      if (btnDelete) btnDelete.textContent = '刪除此按鍵';

      if (selectionGuides) {
        const x = Math.round(parseFloat(selected.style.left) || 0);
        const y = Math.round(parseFloat(selected.style.top) || 0);
        if (guideV) guideV.style.left = `${x}px`;
        if (guideH) guideH.style.top = `${y}px`;
        selectionGuides.classList.remove('hidden');
      }
      if (multiBox) multiBox.classList.add('hidden');
      if (multiArrange) multiArrange.classList.add('hidden');
      if (multiAlign) multiAlign.classList.add('hidden');
    }
  }

  function syncSelectedFromProps() {
    const hasMulti = selectedSet.size > 0;
    if (hasMulti) {
      // 手動輸入 X/Y 時，整組依最小 X/Y 對齊位移
      let minX = Infinity, minY = Infinity;
      selectedSet.forEach(el => {
        const x = Math.round(parseFloat(el.style.left) || 0);
        const y = Math.round(parseFloat(el.style.top) || 0);
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
      });
      const targetX = Math.max(0, Number(propX.value || 0));
      const targetY = Math.max(0, Number(propY.value || 0));
      const dx = targetX - minX;
      const dy = targetY - minY;
      selectedSet.forEach(el => {
        const x = Math.round((parseFloat(el.style.left) || 0) + dx);
        const y = Math.round((parseFloat(el.style.top) || 0) + dy);
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
      });
      updateMultiBox();
      scheduleHistoryDebounced();
      return;
    }

    if (!selected) return;
    // 單一物件：處理 ID/圖片/位置等
    const newId = propId.value.trim();
    const oldId = selected.dataset.id;
    if (newId && newId !== oldId && !keys.has(newId)) {
      keys.delete(oldId);
      selected.dataset.id = newId;
      keys.set(newId, selected);
      refreshKeyList();
      const label = selected.querySelector('.label');
      if (label) label.textContent = newId;
    }

    selected.dataset.keyBinding = propKeyBinding.value.trim();
    if (propSprite) {
      const v = propSprite.value.trim();
      // 若使用者手動輸入檔名（非 blob），優先當作檔名，讓補圖流程可重新對應
      if (v && !/^blob:/i.test(v)) {
        selected.dataset.spriteName = v.split(/[/\\]/).pop();
      }
    }
    const x = Math.max(0, Number(propX.value || 0));
    const y = Math.max(0, Number(propY.value || 0));
    const r = Number(propRot.value || 0);
    selected.style.left = `${Math.round(x)}px`;
    selected.style.top = `${Math.round(y)}px`;
    selected.style.transform = `rotate(${r}deg)`;
    applySpriteToElement(selected);
    scheduleHistoryDebounced();

    // update guides
    if (selectionGuides) {
      const x = Math.round(parseFloat(selected.style.left) || 0);
      const y = Math.round(parseFloat(selected.style.top) || 0);
      if (guideV) guideV.style.left = `${x}px`;
      if (guideH) guideH.style.top = `${y}px`;
      selectionGuides.classList.remove('hidden');
    }
  }

  // Deselect or start box selection when clicking stage background
  stage.addEventListener('mousedown', (e) => {
    if (e.target === stage) {
      clearSelection();
      const startX = e.clientX;
      const startY = e.clientY;
      const rect = document.createElement('div');
      rect.className = 'cover';
      stage.appendChild(rect);

      const onMove = (ev) => {
        const x1 = Math.min(startX, ev.clientX);
        const y1 = Math.min(startY, ev.clientY);
        const x2 = Math.max(startX, ev.clientX);
        const y2 = Math.max(startY, ev.clientY);
        const sRect = stage.getBoundingClientRect();
        rect.style.left = `${x1 - sRect.left}px`;
        rect.style.top = `${y1 - sRect.top}px`;
        rect.style.width = `${x2 - x1}px`;
        rect.style.height = `${y2 - y1}px`;

        // Hit test elements
        selectedSet.forEach(el => el.classList.remove('selected'));
        selectedSet.clear();
        keys.forEach(el => {
          const b = el.getBoundingClientRect();
          const hit = !(b.right < x1 || b.left > x2 || b.bottom < y1 || b.top > y2);
          if (hit) { el.classList.add('selected'); selectedSet.add(el); }
          else { el.classList.remove('selected'); }
        });
        updatePropPanel();
      };
      const onUp = () => {
        rect.remove();
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }
  });

  function updateMultiBox() {
    if (!multiBox) return;
    if (selectedSet.size === 0) { multiBox.classList.add('hidden'); return; }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selectedSet.forEach(el => {
      const x = Math.round(parseFloat(el.style.left) || 0);
      const y = Math.round(parseFloat(el.style.top) || 0);
      const w = Math.round(el.offsetWidth);
      const h = Math.round(el.offsetHeight);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    });
    multiBox.style.left = `${minX}px`;
    multiBox.style.top = `${minY}px`;
    multiBox.style.width = `${Math.max(0, maxX - minX)}px`;
    multiBox.style.height = `${Math.max(0, maxY - minY)}px`;
    multiBox.classList.remove('hidden');
    // 同步左上對齊線
    if (selectionGuides) {
      if (guideV) guideV.style.left = `${minX}px`;
      if (guideH) guideH.style.top = `${minY}px`;
      selectionGuides.classList.remove('hidden');
    }
  }

  // Canvas size controls
  btnApplyCanvas.addEventListener('click', () => {
    const w = Math.max(1, Number(inputW.value || 1920));
    const h = Math.max(1, Number(inputH.value || 1080));
    setStageSize(w, h);
  });

  // Theme switching
  function applyTheme(theme) {
    const root = document.body;
    if (theme === 'light') root.classList.add('theme-light');
    else root.classList.remove('theme-light');
  }
  if (selectTheme) {
    selectTheme.addEventListener('change', () => applyTheme(selectTheme.value));
    // initialize
    applyTheme(selectTheme.value);
  }

  // Toggle show IDs on stage
  function applyShowIds(show) {
    document.body.classList.toggle('show-ids', !!show);
  }
  if (chkShowIds) {
    chkShowIds.addEventListener('change', () => applyShowIds(chkShowIds.checked));
    applyShowIds(false);
  }

  // Toggle canvas panel collapse/expand
  if (toggleCanvasPanel && canvasPanel) {
    toggleCanvasPanel.addEventListener('click', () => {
      const isCollapsed = canvasPanel.classList.toggle('collapsed');
      toggleCanvasPanel.textContent = isCollapsed ? '▸' : '▾';
      toggleCanvasPanel.setAttribute('aria-expanded', String(!isCollapsed));
    });
  }

  // Toggle start panel
  if (toggleStartPanel && startPanel) {
    toggleStartPanel.addEventListener('click', () => {
      const isCollapsed = startPanel.classList.toggle('collapsed');
      toggleStartPanel.textContent = isCollapsed ? '▸' : '▾';
      toggleStartPanel.setAttribute('aria-expanded', String(!isCollapsed));
    });
  }
  // Toggle keys panel
  if (toggleKeysPanel && keysPanel) {
    toggleKeysPanel.addEventListener('click', () => {
      const isCollapsed = keysPanel.classList.toggle('collapsed');
      toggleKeysPanel.textContent = isCollapsed ? '▸' : '▾';
      toggleKeysPanel.setAttribute('aria-expanded', String(!isCollapsed));
    });
  }
  // Toggle prop panel
  if (togglePropPanel && propPanel) {
    togglePropPanel.addEventListener('click', () => {
      const isCollapsed = propPanel.classList.toggle('collapsed');
      togglePropPanel.textContent = isCollapsed ? '▸' : '▾';
      togglePropPanel.setAttribute('aria-expanded', String(!isCollapsed));
    });
  }

  // Right panel toggle
  if (toggleRightPanel && rightPanel) {
    toggleRightPanel.addEventListener('click', (e) => {
      e.stopPropagation();
      const isCollapsed = rightPanel.classList.toggle('collapsed');
      toggleRightPanel.textContent = isCollapsed ? '▶' : '◀';
      toggleRightPanel.setAttribute('aria-expanded', String(!isCollapsed));
    });
    // 允許點擊右側窄條任意處也能展開
    rightPanel.addEventListener('click', (e) => {
      if (!rightPanel.classList.contains('collapsed')) return;
      // 只在收起時且點擊非按鈕時觸發展開
      if (e.target === rightPanel) {
        rightPanel.classList.remove('collapsed');
        toggleRightPanel.textContent = '◀';
        toggleRightPanel.setAttribute('aria-expanded', 'true');
      }
    });
  }

  // 簡易多語系切換
  const i18n = {
    en: {
      start: 'Start',
      canvas: 'Canvas Settings',
      keys: 'Keys',
      props: 'Properties',
      importJson: 'Import .json',
      fixJsonImages: 'Fix .json Images',
      importImages: 'Import Multiple Images',
      downloadMap: 'Download Filename Mapping',
      keySize: 'Key Size',
      keyGap: 'Key Gap',
      layout: 'Apply Layout',
      layoutAnsi: 'Standard Keyboard',
      apply: 'Apply',
      width: 'Width (px)', height: 'Height (px)', applyCanvas: 'Apply Canvas Size',
      theme: 'Theme', dark: 'Dark', light: 'Bright',
      showIds: 'Show key IDs on canvas',
      addKey: 'Add Key (64x64)',
      empty: 'No key selected',
      bindKey: 'Key Binding', startBind: 'Start Binding', stopBind: 'Stop Binding', clearBind: 'Clear Binding',
      sprite: 'Image Path', pickSprite: 'Select Image Path',
      posX: 'Position X', posY: 'Position Y',
      alignX: 'Align to X', alignY: 'Align to Y',
      hspace: 'Horizontal space', vspace: 'Vertical space',
      deleteOne: 'Delete This Key', deleteMany: 'Delete These Keys',
      rotate: 'Rotation (deg)',
      exportJson: 'Export .json',
      rightList: 'Object List', searchId: 'Search ID...',
      toolbar_hint: 'Drag keys to arrange. Top-left is (0,0). Press your keyboard to preview pressed bindings.',
      warnGeneric: 'Detected a non-sided modifier (Shift/Ctrl/Alt). This binding may not work in OBS. Please bind Left/Right version instead.',
      keyBindPlaceholder: "After 'Start Binding', press the key once",
      spritePlaceholder: 'e.g. images/key_sprite.png',
      toggleTitle: 'Collapse/Expand',
      rightExpandTitle: 'Expand',
      importFail: 'Import failed: invalid JSON.',
      imgBaseSet: 'Image folder set as base. Images are being reloaded.',
      fixPromptText: 'Images may be missing. Please select the images folder.'
    },
    zh: {
      start: '開始', canvas: '畫布設定', keys: '按鍵', props: '屬性',
      importJson: '匯入.json', fixJsonImages: '補齊.json圖片', importImages: '匯入大量圖片', downloadMap: '下載檔名對照表',
      keySize: '按鍵大小', keyGap: '按鍵間隔', layout: '套用配置', layoutAnsi: '一般鍵盤', apply: '套用',
      width: '寬 (px)', height: '高 (px)', applyCanvas: '套用畫布尺寸', theme: '主題', dark: '黑暗', light: '明亮',
      showIds: '在畫布上顯示按鍵 ID', addKey: '新增按鍵 (64x64)', empty: '未選取任何按鍵',
      bindKey: '綁定按鍵', startBind: '開始綁定', stopBind: '停止綁定', clearBind: '清除綁定',
      sprite: '圖片路徑', pickSprite: '選擇圖片路徑', posX: '位置 X', posY: '位置 Y',
      alignX: '對齊至 X', alignY: '對齊至 Y', hspace: '水平間距', vspace: '垂直間距', deleteOne: '刪除此按鍵', deleteMany: '刪除這些按鍵',
      rotate: '旋轉 (度)', exportJson: '匯出.json', rightList: '物件列表', searchId: '搜尋 ID...',
      toolbar_hint: '拖曳按鍵以排版。左上角為 (0,0)。按下實際鍵盤可預覽綁定按鍵的按下狀態。',
      warnGeneric: '偵測到未區分左右的修飾鍵（如 Shift/Ctrl/Alt）。此綁定在 OBS 內可能無法使用，請改用 Left/Right 版本（例如 Left Shift 或 Right Shift）。',
      keyBindPlaceholder: '按「開始綁定」後按一次欲綁定的鍵',
      spritePlaceholder: '例如: images/key_sprite.png',
      toggleTitle: '收起/展開',
      rightExpandTitle: '展開',
      importFail: '匯入失敗：JSON 格式不正確',
      imgBaseSet: '已設定圖片資料夾為相對路徑根目錄，並嘗試重新載入圖片。',
      fixPromptText: '偵測到可能缺少圖片，請選擇圖片資料夾以補齊。'
    }
  };
  let currentLang = 'en'; // 預設英文
  function t(key) { return (i18n[currentLang] && i18n[currentLang][key]) || key; }

  function applyLanguage() {
    // <html lang>
    document.documentElement.lang = (currentLang === 'en' ? 'en' : 'zh-Hant');
    // 左側 Start
    const startH3 = document.querySelector('#startPanel .panel-header h3'); if (startH3) startH3.textContent = t('start');
    const btnImport = document.getElementById('btnImportJson'); if (btnImport) btnImport.textContent = t('importJson');
    const btnPickDir = document.getElementById('btnPickImageDir'); if (btnPickDir) btnPickDir.textContent = t('fixJsonImages');
    const btnImpImgs = document.getElementById('btnImportImages'); if (btnImpImgs) btnImpImgs.textContent = t('importImages');
    const btnDlMap = document.getElementById('btnDownloadKeyMap'); if (btnDlMap) btnDlMap.textContent = t('downloadMap');
    const lblKeySize = document.querySelector('label[for="keyBaseSize"]'); if (lblKeySize) lblKeySize.textContent = t('keySize');
    const lblKeyGap = document.querySelector('label[for="keyGap"]'); if (lblKeyGap) lblKeyGap.textContent = t('keyGap');
    const lblLayout = document.querySelector('label[for="layoutPreset"]'); if (lblLayout) lblLayout.textContent = t('layout');
    const optAnsi = document.querySelector('#layoutPreset option[value="ansi104"]'); if (optAnsi) optAnsi.textContent = t('layoutAnsi');
    const btnApplyLay = document.getElementById('btnApplyLayout'); if (btnApplyLay) btnApplyLay.textContent = t('apply');

    // 畫布設定
    const canvasH3 = document.querySelector('#canvasPanel .panel-header h3'); if (canvasH3) canvasH3.textContent = t('canvas');
    const lblW = document.querySelector('label[for="canvasWidth"]'); if (lblW) lblW.textContent = t('width');
    const lblH = document.querySelector('label[for="canvasHeight"]'); if (lblH) lblH.textContent = t('height');
    const btnApplyCanvasEl = document.getElementById('applyCanvas'); if (btnApplyCanvasEl) btnApplyCanvasEl.textContent = t('applyCanvas');
    const lblTheme = document.querySelector('label[for="canvasTheme"]'); if (lblTheme) lblTheme.textContent = t('theme');
    const optDark = document.querySelector('#canvasTheme option[value="dark"]'); if (optDark) optDark.textContent = t('dark');
    const optLight = document.querySelector('#canvasTheme option[value="light"]'); if (optLight) optLight.textContent = t('light');
    const lblShowIds = document.querySelector('label[for="chkShowIds"]'); if (lblShowIds) lblShowIds.textContent = t('showIds');

    // 按鍵
    const keysH3 = document.querySelector('#keysPanel .panel-header h3'); if (keysH3) keysH3.textContent = t('keys');
    const btnAddKeyEl = document.getElementById('addKey'); if (btnAddKeyEl) btnAddKeyEl.textContent = t('addKey');

    // 屬性
    const propsH3 = document.querySelector('#propPanel .panel-header h3'); if (propsH3) propsH3.textContent = t('props');
    const emptyEl = document.querySelector('#propPanel .empty'); if (emptyEl) emptyEl.textContent = t('empty');
    const lblBind = document.querySelector('label[for="propKeyBinding"]'); if (lblBind) lblBind.textContent = t('bindKey');
    const btnStartBindEl = document.getElementById('btnStartBind');
    if (btnStartBindEl) {
      const isActive = btnStartBindEl.classList.contains('danger');
      btnStartBindEl.textContent = isActive ? t('stopBind') : t('startBind');
    }
    const btnClearBindEl = document.getElementById('btnClearBind'); if (btnClearBindEl) btnClearBindEl.textContent = t('clearBind');
    const lblSprite = document.querySelector('label[for="propSprite"]'); if (lblSprite) lblSprite.textContent = t('sprite');
    const btnPickSpriteEl = document.getElementById('btnPickSprite'); if (btnPickSpriteEl) btnPickSpriteEl.textContent = t('pickSprite');
    const lblX = document.querySelector('label[for="propX"]'); if (lblX) lblX.textContent = t('posX');
    const lblY = document.querySelector('label[for="propY"]'); if (lblY) lblY.textContent = t('posY');
    const btnAlignXEl = document.getElementById('btnAlignX'); if (btnAlignXEl) btnAlignXEl.textContent = t('alignX');
    const btnAlignYEl = document.getElementById('btnAlignY'); if (btnAlignYEl) btnAlignYEl.textContent = t('alignY');
    const lblHSpace = document.querySelector('label[for="multiHSpace"]'); if (lblHSpace) lblHSpace.textContent = t('hspace');
    const lblVSpace = document.querySelector('label[for="multiVSpace"]'); if (lblVSpace) lblVSpace.textContent = t('vspace');
    const btnApplyH = document.getElementById('btnApplyHSpace'); if (btnApplyH) btnApplyH.textContent = t('apply');
    const btnApplyV = document.getElementById('btnApplyVSpace'); if (btnApplyV) btnApplyV.textContent = t('apply');
    const btnDeleteEl = document.getElementById('deleteKey'); if (btnDeleteEl) btnDeleteEl.textContent = (selectedSet.size>0) ? t('deleteMany') : t('deleteOne');
    const lblRot = document.querySelector('label[for="propRot"]'); if (lblRot) lblRot.textContent = t('rotate');
    const inpBind = document.getElementById('propKeyBinding'); if (inpBind) inpBind.placeholder = t('keyBindPlaceholder');
    const inpSprite = document.getElementById('propSprite'); if (inpSprite) inpSprite.placeholder = t('spritePlaceholder');

    // 匯出
    const btnExportEl = document.getElementById('exportJson'); if (btnExportEl) btnExportEl.textContent = t('exportJson');

    // 右側列表與提示
    document.querySelectorAll('[data-i18n="right_list"]').forEach(n => n.textContent = t('rightList'));
    const search = document.getElementById('keySearch'); if (search) search.placeholder = t('searchId');
    const toolbarHint = document.querySelector('[data-i18n="toolbar_hint"]'); if (toolbarHint) toolbarHint.textContent = t('toolbar_hint');
    // 匯入後補圖提示
    const fixPromptSpan = document.querySelector('#fixPrompt [data-i18n="fixPromptText"]'); if (fixPromptSpan) fixPromptSpan.textContent = t('fixPromptText');
    const fixPromptBtn = document.getElementById('btnPromptPick'); if (fixPromptBtn) fixPromptBtn.textContent = t('fixJsonImages');
    // 工具列右側「Object List」窄條標籤也同步
    const collapsedLabels = document.querySelectorAll('#rightPanel .collapsed-label[data-i18n="right_list"]');
    collapsedLabels.forEach(n => n.textContent = t('rightList'));

    // 折疊按鈕的 title
    if (toggleStartPanel) toggleStartPanel.title = t('toggleTitle');
    if (toggleCanvasPanel) toggleCanvasPanel.title = t('toggleTitle');
    if (toggleKeysPanel) toggleKeysPanel.title = t('toggleTitle');
    if (togglePropPanel) togglePropPanel.title = t('toggleTitle');
    const rightToggle = document.getElementById('toggleRightPanel'); if (rightToggle) rightToggle.title = t('rightExpandTitle');
  }

  if (btnLangEn) btnLangEn.addEventListener('click', () => { currentLang = 'en'; applyLanguage(); });
  if (btnLangZh) btnLangZh.addEventListener('click', () => { currentLang = 'zh'; applyLanguage(); });
  // 若載入時 UI 尚未完成，延遲一次刷新，確保 data-i18n 元素也被更新
  window.requestAnimationFrame(() => applyLanguage());
  // 預設英文
  applyLanguage();

  function refreshKeyList() {
    if (!keyList) return;
    keyList.innerHTML = '';
    const q = (keySearch && keySearch.value || '').toLowerCase();
    Array.from(keys.keys()).sort().forEach(id => {
      if (q && !id.toLowerCase().includes(q)) return;
      const li = document.createElement('li');
      li.textContent = id;
      // 單選高亮
      if (selected && selected.dataset.id === id) li.classList.add('active');
      // 多選高亮
      if (selectedSet && selectedSet.size > 0 && selectedSetHasId(id)) li.classList.add('active');
      li.addEventListener('click', (e) => {
        const el = keys.get(id);
        if (!el) return;
        if (e.ctrlKey) {
          // Ctrl 切換多選（若當前是單選，先提升為多選）
          ensureSelectedPromotedToMulti();
          if (selectedSet.has(el)) {
            el.classList.remove('selected');
            selectedSet.delete(el);
            if (selected === el) selected = null;
          } else {
            selectedSet.add(el);
            el.classList.add('selected');
          }
          updatePropPanel();
          updateMultiBox();
          refreshKeyList();
        } else {
          selectKey(el);
          refreshKeyList();
          // 滾到可視範圍
          const r = el.getBoundingClientRect();
          const sr = stage.getBoundingClientRect();
          stageWrapper.scrollLeft += (r.left - sr.left) - stageWrapper.clientWidth / 2 + el.offsetWidth / 2;
          stageWrapper.scrollTop += (r.top - sr.top) - stageWrapper.clientHeight / 2 + el.offsetHeight / 2;
        }
      });
      keyList.appendChild(li);
    });
  }

  function ensureSelectedPromotedToMulti() {
    if (selected && !selectedSet.has(selected)) {
      selectedSet.add(selected);
      // keep visual selected state
      selected.classList.add('selected');
      selected = null;
    }
  }

  function selectedSetHasId(id) {
    for (const el of selectedSet) {
      if (el.dataset.id === id) return true;
    }
    return false;
  }

  if (keySearch) {
    keySearch.addEventListener('input', refreshKeyList);
  }

  // Wheel zoom on Ctrl+Wheel or plain wheel (trackpad-friendly): zoom to cursor
  stageWrapper.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && e.deltaZ === 0 && (e.shiftKey || e.altKey)) {
      // allow other modifiers to pass through without zoom
      return;
    }
    // If middle-drag is active, let drag handle scroll. Still prevent default to avoid browser zoom.
    e.preventDefault();

    const rect = stageWrapper.getBoundingClientRect();
    const cursorX = e.clientX - rect.left - offsetX;
    const cursorY = e.clientY - rect.top - offsetY;

    const zoomIntensity = 0.0015; // smooth
    const delta = -e.deltaY; // wheel up -> zoom in
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * (1 + delta * zoomIntensity)));
    const scaleRatio = newScale / scale;

    // Keep point under cursor stable by adjusting offset
    offsetX = cursorX - (cursorX * scaleRatio);
    offsetY = cursorY - (cursorY * scaleRatio);
    scale = newScale;
    applyTransform();
  }, { passive: false });

  // Middle mouse panning: hold wheel button to drag
  let isPanning = false;
  let panStartX = 0, panStartY = 0;
  let panOrigOffsetX = 0, panOrigOffsetY = 0;
  stageWrapper.addEventListener('mousedown', (e) => {
    if (e.button === 1) { // middle button
      isPanning = true;
      panStartX = e.clientX;
      panStartY = e.clientY;
      panOrigOffsetX = offsetX;
      panOrigOffsetY = offsetY;
      stageWrapper.style.cursor = 'grabbing';
      e.preventDefault();
    }
  });
  window.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    const dx = e.clientX - panStartX;
    const dy = e.clientY - panStartY;
    offsetX = panOrigOffsetX + dx;
    offsetY = panOrigOffsetY + dy;
    applyTransform();
  });
  window.addEventListener('mouseup', () => {
    if (!isPanning) return;
    isPanning = false;
    stageWrapper.style.cursor = '';
  });

  // Add key button
  btnAddKey.addEventListener('click', () => {
    const id = `Custom_${String(keyCounter++).padStart(3, '0')}`;
    const el = createKeyElement({ id, x: 10, y: 10, w: 64, h: 64, rotation: 0, sprite: '' });
    selectKey(el);
  });

  // Prop sync events (寬高已移除，不再監聽)
  [propId, propKeyBinding, propSprite, propX, propY, propRot].filter(Boolean).forEach(inp => {
    inp.addEventListener('input', syncSelectedFromProps);
    inp.addEventListener('change', syncSelectedFromProps);
  });

  // 檔案挑選：使用隱藏 input[type=file]
  if (btnPickSprite && fileSprite && propSprite) {
    btnPickSprite.addEventListener('click', () => fileSprite.click());
    fileSprite.addEventListener('change', () => {
      const file = fileSprite.files && fileSprite.files[0];
      if (!file) return;
      // 顯示實際檔名
      if (propSpriteHint) propSpriteHint.textContent = file.name;
      // 以 Object URL/ Data URL 載入，避免本機路徑權限問題
      const url = URL.createObjectURL(file);
      // 面板顯示檔名
      propSprite.value = file.name;
      if (selected) {
        selected.dataset.spriteName = file.name; // 保存原始檔名以便匯出與重建
        selected.dataset.sprite = url;
        applySpriteToElement(selected);
      }
    });
  }

  // Delete key(s)
  btnDelete.addEventListener('click', () => {
    const hasMulti = selectedSet.size > 0;
    if (hasMulti) {
      // Delete all selected items
      selectedSet.forEach(el => {
        const id = el.dataset.id;
        el.remove();
        if (id) keys.delete(id);
      });
      selectedSet.clear();
      if (multiBox) multiBox.classList.add('hidden');
      updatePropPanel();
      refreshKeyList();
      pushHistory();
      return;
    }
    if (!selected) return;
    const id = selected.dataset.id;
    selected.remove();
    keys.delete(id);
    clearSelection();
    refreshKeyList();
    pushHistory();
  });

  // Keyboard press preview
  const pressedKeyState = new Set();
  const currentChord = new Set();
  function normalizeKey(k) {
    if (!k) return '';
    const map = { 'Control': 'Ctrl', ' ': 'Space' };
    return (map[k] || k).toLowerCase();
  }

  function sideModifierFromEvent(e) {
    // Returns one of: lctrl, rctrl, lshift, rshift, lalt, ralt, lmeta, rmeta or '' if not a sided modifier
    switch (e.code) {
      case 'ControlLeft': return 'lctrl';
      case 'ControlRight': return 'rctrl';
      case 'ShiftLeft': return 'lshift';
      case 'ShiftRight': return 'rshift';
      case 'AltLeft': return 'lalt';
      case 'AltRight': return 'ralt';
      case 'MetaLeft': return 'lmeta';
      case 'MetaRight': return 'rmeta';
      default: return '';
    }
  }

  function keyIdFromCode(code) {
    // Map hardware key codes to our standard key ids
    if (!code) return '';
    // Letters
    if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
    // Top row digits
    if (/^Digit[0-9]$/.test(code)) return code.slice(5);
    // Function keys F1..F24 (we use F1..F12)
    if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code.toLowerCase();
    switch (code) {
      // Modifiers (side-specific as key id too)
      case 'ShiftLeft': return 'lshift';
      case 'ShiftRight': return 'rshift';
      case 'ControlLeft': return 'lctrl';
      case 'ControlRight': return 'rctrl';
      case 'AltLeft': return 'lalt';
      case 'AltRight': return 'ralt';
      case 'MetaLeft': return 'lmeta';
      case 'MetaRight': return 'rmeta';
      // Editing and control
      case 'Escape': return 'escape';
      case 'Backspace': return 'backspace';
      case 'Tab': return 'tab';
      case 'Enter': return 'enter';
      case 'Space': return 'space';
      case 'Insert': return 'insert';
      case 'Delete': return 'delete';
      case 'Home': return 'home';
      case 'End': return 'end';
      case 'PageUp': return 'pageup';
      case 'PageDown': return 'pagedown';
      case 'PrintScreen': return 'printscreen';
      case 'ScrollLock': return 'scrolllock';
      case 'Pause': return 'pause';
      case 'CapsLock': return 'capslock';
      case 'NumLock': return 'numlock';
      case 'ContextMenu': return 'contextmenu';
      // Arrows
      case 'ArrowUp': return 'arrowup';
      case 'ArrowDown': return 'arrowdown';
      case 'ArrowLeft': return 'arrowleft';
      case 'ArrowRight': return 'arrowright';
      // Punctuation (US)
      case 'Backquote': return 'grave';
      case 'Minus': return 'minus';
      case 'Equal': return 'equal';
      case 'BracketLeft': return 'bracketleft';
      case 'BracketRight': return 'bracketright';
      case 'Backslash': return 'backslash';
      case 'Semicolon': return 'semicolon';
      case 'Quote': return 'quote';
      case 'Comma': return 'comma';
      case 'Period': return 'period';
      case 'Slash': return 'slash';
      // Numpad
      case 'Numpad0': return 'numpad0';
      case 'Numpad1': return 'numpad1';
      case 'Numpad2': return 'numpad2';
      case 'Numpad3': return 'numpad3';
      case 'Numpad4': return 'numpad4';
      case 'Numpad5': return 'numpad5';
      case 'Numpad6': return 'numpad6';
      case 'Numpad7': return 'numpad7';
      case 'Numpad8': return 'numpad8';
      case 'Numpad9': return 'numpad9';
      case 'NumpadAdd': return 'numpadadd';
      case 'NumpadSubtract': return 'numpadsubtract';
      case 'NumpadMultiply': return 'numpadmultiply';
      case 'NumpadDivide': return 'numpaddivide';
      case 'NumpadDecimal': return 'numpaddecimal';
      case 'NumpadEnter': return 'numpadenter';
      default: return '';
    }
  }

  // Windows Virtual-Key 對應
  function vkFromKeyId(keyId) {
    if (!keyId) return 0;
    const k = String(keyId).toLowerCase();
    // A..Z
    if (/^[a-z]$/.test(k)) return 0x41 + (k.charCodeAt(0) - 97);
    // Top row digits 0..9
    if (/^[0-9]$/.test(k)) return 0x30 + Number(k);
    // Function keys F1..F24
    if (/^f([1-9]|1[0-9]|2[0-4])$/.test(k)) return 0x70 + (Number(k.slice(1)) - 1);
    const VK = {
      // Mouse buttons (Windows VK_* for mouse)
      mouseleft: 0x01,   // VK_LBUTTON
      mouseright: 0x02,  // VK_RBUTTON
      mousemiddle: 0x04, // VK_MBUTTON
      mousex1: 0x05,     // VK_XBUTTON1
      mousex2: 0x06,     // VK_XBUTTON2
      // Mouse wheel (custom codes for export)
      wheelup: 0x0A01,
      wheeldown: 0x0A02,
      // Generic modifiers (keyboard不分左右時使用)
      shift: 0x10, // VK_SHIFT
      ctrl:  0x11, // VK_CONTROL
      alt:   0x12, // VK_MENU
      meta:  0x5B, // 以左Win為通用（VK_LWIN）
      // Side-specific modifiers
      lshift: 0xA0, rshift: 0xA1,
      lctrl:  0xA2, rctrl:  0xA3,
      lalt:   0xA4, ralt:   0xA5,
      lmeta:  0x5B, rmeta:  0x5C,
      escape: 0x1B,
      backspace: 0x08,
      tab: 0x09,
      enter: 0x0D,
      space: 0x20,
      insert: 0x2D,
      delete: 0x2E,
      home: 0x24,
      end: 0x23,
      pageup: 0x21,
      pagedown: 0x22,
      printscreen: 0x2C,
      scrolllock: 0x91,
      pause: 0x13,
      capslock: 0x14,
      numlock: 0x90,
      contextmenu: 0x5D,
      arrowup: 0x26,
      arrowdown: 0x28,
      arrowleft: 0x25,
      arrowright: 0x27,
      // US punctuation
      grave: 0xC0,
      minus: 0xBD,
      equal: 0xBB,
      bracketleft: 0xDB,
      bracketright: 0xDD,
      backslash: 0xDC,
      semicolon: 0xBA,
      quote: 0xDE,
      comma: 0xBC,
      period: 0xBE,
      slash: 0xBF,
      // Numpad
      numpad0: 0x60,
      numpad1: 0x61,
      numpad2: 0x62,
      numpad3: 0x63,
      numpad4: 0x64,
      numpad5: 0x65,
      numpad6: 0x66,
      numpad7: 0x67,
      numpad8: 0x68,
      numpad9: 0x69,
      numpadadd: 0x6B,
      numpadsubtract: 0x6D,
      numpadmultiply: 0x6A,
      numpaddivide: 0x6F,
      numpaddecimal: 0x6E,
      numpadenter: 0x0D, // 注意：Num Enter 與 Enter 皆為 VK_RETURN，需以延伸旗標區分
    };
    return VK[k] || 0;
  }

  function vkForElement(el) {
    if (!el) return 0;
    const binding = (el.dataset.keyBinding || '').toLowerCase();
    let token = '';
    if (binding) token = binding.split('+').map(s=>s.trim()).filter(Boolean)[0] || '';
    if (!token) token = String(el.dataset.id || '').toLowerCase();
    // 若 token 是 generic 修飾鍵，使用該 generic 的 VK；若是側別修飾鍵，使用側別 VK。
    return vkFromKeyId(token);
  }

  // Extended (E0) 判定：依使用者需求，保守地對指定鍵回傳 true
  function isExtendedKeyId(keyId) {
    if (!keyId) return false;
    const k = String(keyId).toLowerCase();
    // 依使用者提供的準確對照：只對下列鍵設 extended=true
    const set = new Set([
      // 右側修飾鍵
      'rctrl', 'ralt',
      // 方向鍵
      'arrowup','arrowdown','arrowleft','arrowright',
      // 導航鍵
      'insert','delete','home','end','pageup','pagedown',
      // 數字鍵盤中：僅 Enter 與 Divide
      'numpadenter','numpaddivide',
    ]);
    return set.has(k);
  }

  function extendedForElement(el) {
    if (!el) return false;
    if (typeof el.dataset.extended !== 'undefined') {
      const v = String(el.dataset.extended).toLowerCase();
      return v === '1' || v === 'true';
    }
    const binding = (el.dataset.keyBinding || '').toLowerCase();
    let token = '';
    if (binding) token = binding.split('+').map(s=>s.trim()).filter(Boolean)[0] || '';
    if (!token) token = String(el.dataset.id || '').toLowerCase();
    return isExtendedKeyId(token);
  }

  function sortChordParts(parts) {
    const order = ['lctrl','rctrl','ctrl','lshift','rshift','shift','lalt','ralt','alt'];
    return parts.slice().sort((a,b) => {
      const ia = order.indexOf(a); const ib = order.indexOf(b);
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    // otherwise keep lexicographic
      return a.localeCompare(b);
    });
  }
  function updatePressedPreview() {
    const family = {
      shift: { generic: 'shift', sided: ['lshift','rshift'] },
      ctrl:  { generic: 'ctrl',  sided: ['lctrl','rctrl'] },
      alt:   { generic: 'alt',   sided: ['lalt','ralt'] },
      meta:  { generic: 'meta',  sided: ['lmeta','rmeta'] },
    };
    function isSidedOf(p) {
      for (const k in family) if (family[k].sided.includes(p)) return k;
      return '';
    }
    function partMatched(p) {
      if (!p) return false;
      // 直接命中
      if (pressedKeyState.has(p)) return true;
      // 若目標是側別修飾鍵，僅在「沒有任何側別訊號」時，允許 generic 代替
      const fam = isSidedOf(p);
      if (fam) {
        const hasAnySided = family[fam].sided.some(s => pressedKeyState.has(s));
        if (!hasAnySided && pressedKeyState.has(family[fam].generic)) return true;
        return false;
      }
      // 若目標是 generic 修飾鍵，任一側或 generic 皆可
      if (family[p]) {
        const f = family[p];
        if (pressedKeyState.has(f.generic)) return true;
        if (f.sided.some(s => pressedKeyState.has(s))) return true;
        return false;
      }
      return false;
    }
    keys.forEach(el => {
      const binding = (el.dataset.keyBinding || '').toLowerCase();
      const parts = binding.split('+').map(s => s.trim()).filter(Boolean);
      const matched = parts.length > 0 && parts.every(partMatched);
      if (matched) el.classList.add('pressed');
      else el.classList.remove('pressed');
    });
  }
  window.addEventListener('keydown', (e) => {
    // Ctrl+Z undo
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undoLast();
      return;
    }

    // 方向鍵微調：若有選取物件且焦點不在可輸入元件，使用方向鍵以 1px 微調，不讓視窗捲動
    const isEditable = (() => {
      const ae = document.activeElement;
      if (!ae) return false;
      const tag = (ae.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
      if (ae.isContentEditable) return true;
      return false;
    })();
    const hasSelection = !!selected || selectedSet.size > 0;
    if (hasSelection && !isEditable && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      const dx = (e.key === 'ArrowLeft') ? -1 : (e.key === 'ArrowRight') ? 1 : 0;
      const dy = (e.key === 'ArrowUp') ? -1 : (e.key === 'ArrowDown') ? 1 : 0;

      const clampToStage = (x, y, elem) => {
        const maxX = Math.max(0, stage.clientWidth - elem.offsetWidth);
        const maxY = Math.max(0, stage.clientHeight - elem.offsetHeight);
        return [Math.min(Math.max(0, x), maxX), Math.min(Math.max(0, y), maxY)];
      };

      if (selectedSet.size > 0) {
        // 多選：整組平移，任何一個碰到邊界即整組停止
        let lowerDx = -Infinity, upperDx = Infinity, lowerDy = -Infinity, upperDy = Infinity;
        const stageMaxXFor = (node) => Math.max(0, stage.clientWidth - node.offsetWidth);
        const stageMaxYFor = (node) => Math.max(0, stage.clientHeight - node.offsetHeight);
        selectedSet.forEach(node => {
          const x = parseFloat(node.style.left) || 0;
          const y = parseFloat(node.style.top) || 0;
          const minDxForNode = -x;
          const maxDxForNode = stageMaxXFor(node) - x;
          const minDyForNode = -y;
          const maxDyForNode = stageMaxYFor(node) - y;
          lowerDx = Math.max(lowerDx, minDxForNode);
          upperDx = Math.min(upperDx, maxDxForNode);
          lowerDy = Math.max(lowerDy, minDyForNode);
          upperDy = Math.min(upperDy, maxDyForNode);
        });
        const allowedDx = Math.min(Math.max(dx, lowerDx), upperDx);
        const allowedDy = Math.min(Math.max(dy, lowerDy), upperDy);
        let minX = Infinity, minY = Infinity;
        selectedSet.forEach(node => {
          const x = Math.round((parseFloat(node.style.left) || 0) + allowedDx);
          const y = Math.round((parseFloat(node.style.top) || 0) + allowedDy);
          node.style.left = `${x}px`;
          node.style.top = `${y}px`;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
        });
        updateMultiBox();
        if (Number.isFinite(minX)) propX.value = minX;
        if (Number.isFinite(minY)) propY.value = minY;
      } else if (selected) {
        let x = (parseFloat(selected.style.left) || 0) + dx;
        let y = (parseFloat(selected.style.top) || 0) + dy;
        const clamped = clampToStage(x, y, selected);
        x = Math.round(clamped[0]); y = Math.round(clamped[1]);
        selected.style.left = `${x}px`;
        selected.style.top = `${y}px`;
        propX.value = x; propY.value = y;
        if (selectionGuides) {
          if (guideV) guideV.style.left = `${x}px`;
          if (guideH) guideH.style.top = `${y}px`;
          selectionGuides.classList.remove('hidden');
        }
      }
      // 視為連續操作，使用 1 秒去彈跳紀錄到歷史
      scheduleHistoryDebounced(1000);
    }
    const sided = sideModifierFromEvent(e);
    const keyId = keyIdFromCode(e.code) || (e.key && e.key.toLowerCase());
    if (keyId) pressedKeyState.add(keyId);
    // 加入通用修飾鍵，支援鍵盤不分左右的情況
    if (e.ctrlKey) pressedKeyState.add('ctrl'); else pressedKeyState.delete('ctrl');
    if (e.shiftKey) pressedKeyState.add('shift'); else pressedKeyState.delete('shift');
    if (e.altKey) pressedKeyState.add('alt'); else pressedKeyState.delete('alt');
    if (sided) pressedKeyState.add(sided);
    // 當綁定模式開啟時，記錄單一鍵：優先側別修飾鍵，否則使用實體鍵位；若平台無法提供 code，回退為通用修飾鍵
    if (bindingActive) {
      currentChord.clear();
      // 只接受單鍵：若是修飾鍵則記錄側別版；否則記錄該鍵；最後才回退為通用修飾鍵
      let addedToken = '';
      if (sided) {
        addedToken = sided;
        currentChord.add(addedToken);
      } else if (keyId) {
        addedToken = keyId;
        currentChord.add(addedToken);
      } else {
        if (e.shiftKey) { addedToken = 'shift'; currentChord.add(addedToken); }
        else if (e.ctrlKey) { addedToken = 'ctrl'; currentChord.add(addedToken); }
        else if (e.altKey) { addedToken = 'alt'; currentChord.add(addedToken); }
      }
      updateBindingPreview();
      // 當偵測到未分左右的修飾鍵時，於本次綁定流程提示一次（先停止綁定再提示）
      if (!bindingWarnedGeneric && isGenericModifierToken(addedToken)) {
        bindingWarnedGeneric = true;
        if (bindingActive) stopBinding();
        alert(t('warnGeneric'));
      }
    }
    updatePressedPreview();
  });
  window.addEventListener('keyup', (e) => {
    const sided = sideModifierFromEvent(e);
    const keyId = keyIdFromCode(e.code) || (e.key && e.key.toLowerCase());
    if (keyId) pressedKeyState.delete(keyId);
    if (!e.ctrlKey) { pressedKeyState.delete('ctrl'); pressedKeyState.delete('lctrl'); pressedKeyState.delete('rctrl'); }
    if (!e.shiftKey) { pressedKeyState.delete('shift'); pressedKeyState.delete('lshift'); pressedKeyState.delete('rshift'); }
    if (!e.altKey) { pressedKeyState.delete('alt'); pressedKeyState.delete('lalt'); pressedKeyState.delete('ralt'); }
    if (sided) pressedKeyState.delete(sided);
    if (bindingActive) commitBindingFromChord();
    updatePressedPreview();
  });

  // --- Mouse binding support (left/right/middle/X1/X2 and wheel up/down) ---
  function tokenFromMouseButton(btn) {
    switch (btn) {
      case 0: return 'mouseleft';
      case 1: return 'mousemiddle';
      case 2: return 'mouseright';
      case 3: return 'mousex1';
      case 4: return 'mousex2';
      default: return '';
    }
  }
  function isBindingUiTarget(target) {
    if (!target) return false;
    // 避免點擊「開始綁定」本身就被當成綁定目標
    return !!(target.closest && (target.closest('#rowKeyBtns') || target.closest('#rowKey')));
  }
  let lastMouseBindToken = '';
  function onMouseDownCapture(e) {
    const token = tokenFromMouseButton(e.button);
    if (token) {
      // 更新按下預覽（不論是否綁定中）
      pressedKeyState.add(token);
      updatePressedPreview();
    }
    if (!bindingActive) return;
    if (isBindingUiTarget(e.target)) return; // 忽略在綁定控制元件上的點擊
    if (!token) return;
    e.preventDefault();
    e.stopPropagation();
    currentChord.clear();
    currentChord.add(token);
    lastMouseBindToken = token;
    updateBindingPreview();
  }
  function onMouseUpCapture(e) {
    const token = tokenFromMouseButton(e.button);
    if (token) {
      pressedKeyState.delete(token);
      updatePressedPreview();
    }
    if (!bindingActive) return;
    if (!token) return;
    if (lastMouseBindToken === token) {
      e.preventDefault();
      e.stopPropagation();
      commitBindingFromChord();
      stopBinding();
      lastMouseBindToken = '';
    }
  }
  function onWheelCapture(e) {
    if (!bindingActive) return;
    e.preventDefault();
    e.stopPropagation();
    const token = (e.deltaY < 0) ? 'wheelup' : 'wheeldown';
    currentChord.clear();
    currentChord.add(token);
    updateBindingPreview();
    commitBindingFromChord();
    stopBinding();
  }
  window.addEventListener('mousedown', onMouseDownCapture, true);
  window.addEventListener('mouseup', onMouseUpCapture, true);
  window.addEventListener('wheel', onWheelCapture, { capture: true, passive: false });

  let bindingActive = false;
  let bindingWarnedGeneric = false; // 本次綁定流程是否已提示過 generic 修飾鍵警告
  function isGenericModifierToken(t) {
    if (!t) return false;
    const k = String(t).toLowerCase();
    return k === 'shift' || k === 'ctrl' || k === 'alt';
  }
  function updateBindingPreview() {
    if (!propKeyBinding) return;
    propKeyBinding.value = sortChordParts(Array.from(currentChord)).join('+');
  }
  function commitBindingFromChord() {
    if (!selected || !propKeyBinding) return;
    const bindingStr = propKeyBinding.value.trim();
    selected.dataset.keyBinding = bindingStr;
    // 同步更新對應 VK 值（不直接顯示，供匯出）
    // 若使用者鍵盤不分左右（無 code 提供），允許 generic 修飾鍵
    selected.dataset.vk = String(vkFromKeyId(bindingStr.toLowerCase()));
    // 同步 extended 判定（允許手動覆蓋 dataset.extended，但這裡先依規則設定預設值）
    selected.dataset.extended = String(isExtendedKeyId(bindingStr.toLowerCase()));
    // 若為未分左右的修飾鍵，提醒使用者在 OBS 內會無法使用（先停止綁定再提示）
    if (!bindingWarnedGeneric && isGenericModifierToken(bindingStr)) {
      bindingWarnedGeneric = true;
      if (bindingActive) stopBinding();
      alert(t('warnGeneric'));
    }
    // 若內容有變更，結束綁定
    if (bindingActive && propKeyBinding.value) {
      stopBinding();
    }
  }
  function startBinding() {
    bindingActive = true;
    bindingWarnedGeneric = false;
    currentChord.clear();
    if (propKeyBinding) propKeyBinding.value = '';
    if (btnStartBind) {
      btnStartBind.textContent = t('stopBind');
      btnStartBind.classList.add('danger');
    }
  }
  function stopBinding() {
    bindingActive = false;
    if (btnStartBind) {
      btnStartBind.textContent = t('startBind');
      btnStartBind.classList.remove('danger');
    }
  }
  if (btnStartBind && propKeyBinding) {
    btnStartBind.addEventListener('click', () => {
      if (bindingActive) stopBinding(); else startBinding();
    });
  }
  if (btnClearBind && propKeyBinding) {
    btnClearBind.addEventListener('click', () => {
      currentChord.clear();
      propKeyBinding.value = '';
      if (selected) selected.dataset.keyBinding = '';
      stopBinding();
    });
  }

  // Apply horizontal spacing: order by X then apply minX + i*space (Y unchanged)
  if (btnApplyHSpace && multiHSpace) {
    btnApplyHSpace.addEventListener('click', () => {
      if (selectedSet.size === 0) return;
      const space = Number(multiHSpace.value || 0);
      const items = Array.from(selectedSet);
      items.sort((a,b) => (parseFloat(a.style.left)||0) - (parseFloat(b.style.left)||0));
      let minX = Infinity;
      items.forEach(el => { minX = Math.min(minX, parseFloat(el.style.left)||0); });
      items.forEach((el, i) => {
        const y = Math.round(parseFloat(el.style.top) || 0);
        const x = Math.round(minX + i * space);
        el.style.left = `${Math.max(0, x)}px`;
        el.style.top = `${Math.max(0, y)}px`;
      });
      updateMultiBox();
      updatePropPanel();
      pushHistory();
    });
  }

  // Apply vertical spacing: order by Y then apply minY + i*space (X unchanged)
  if (btnApplyVSpace && multiVSpace) {
    btnApplyVSpace.addEventListener('click', () => {
      if (selectedSet.size === 0) return;
      const space = Number(multiVSpace.value || 0);
      const items = Array.from(selectedSet);
      items.sort((a,b) => (parseFloat(a.style.top)||0) - (parseFloat(b.style.top)||0));
      let minY = Infinity;
      items.forEach(el => { minY = Math.min(minY, parseFloat(el.style.top)||0); });
      items.forEach((el, i) => {
        const x = Math.round(parseFloat(el.style.left) || 0);
        const y = Math.round(minY + i * space);
        el.style.left = `${Math.max(0, x)}px`;
        el.style.top = `${Math.max(0, y)}px`;
      });
      updateMultiBox();
      updatePropPanel();
      pushHistory();
    });
  }

  // Align to min X among selection
  if (btnAlignX) {
    btnAlignX.addEventListener('click', () => {
      if (selectedSet.size === 0) return;
      let minX = Infinity;
      selectedSet.forEach(el => { minX = Math.min(minX, parseFloat(el.style.left) || 0); });
      selectedSet.forEach(el => {
        const y = Math.round(parseFloat(el.style.top) || 0);
        el.style.left = `${Math.max(0, Math.round(minX))}px`;
        el.style.top = `${Math.max(0, y)}px`;
      });
      updateMultiBox();
      updatePropPanel();
      pushHistory();
    });
  }

  // Align to min Y among selection
  if (btnAlignY) {
    btnAlignY.addEventListener('click', () => {
      if (selectedSet.size === 0) return;
      let minY = Infinity;
      selectedSet.forEach(el => { minY = Math.min(minY, parseFloat(el.style.top) || 0); });
      selectedSet.forEach(el => {
        const x = Math.round(parseFloat(el.style.left) || 0);
        el.style.left = `${Math.max(0, x)}px`;
        el.style.top = `${Math.max(0, Math.round(minY))}px`;
      });
      updateMultiBox();
      updatePropPanel();
      pushHistory();
    });
  }

  // Export JSON
  btnExport.addEventListener('click', () => {
    const w = Math.round(stage.clientWidth);
    const h = Math.round(stage.clientHeight);
    const filenameFor = (el) => {
      // 1) 若有保存原始檔名，直接使用
      const saved = (el.dataset.spriteName || '').trim();
      if (saved) return saved;
      // 2) 從目前 sprite 來源取最後一段（支援 URL 或本機路徑或檔名本身）
      const src = (el.dataset.sprite || '').trim();
      if (!src) return '';
      // 2a) 若是目前 ObjectURL，且有反向對照，優先還原原始檔名
      const rev = imageUrlToName.get(src);
      if (rev) return rev;
      try {
        const u = new URL(src, window.location.href);
        const parts = u.pathname.split('/');
        return parts[parts.length - 1] || '';
      } catch {
        const p = src.split(/[/\\]/);
        return p[p.length - 1] || '';
      }
    };
    const data = {
      canvas: { width: w, height: h, theme: (document.body.classList.contains('theme-light') ? 'light' : 'dark') },
      keys: Array.from(keys.values()).map(el => ({
        id: el.dataset.id,
        keyBinding: el.dataset.keyBinding || '',
        vk: vkForElement(el),
        extended: extendedForElement(el),
        // 匯出為檔名（含副檔名），避免 blob URL 無法於 OBS 外掛使用
        sprite: filenameFor(el),
        x: Math.round(parseFloat(el.style.left) || 0),
        y: Math.round(parseFloat(el.style.top) || 0),
        w: Math.round(el.offsetWidth),
        h: Math.round(el.offsetHeight),
        rotation: (() => {
          const m = /rotate\(([-0-9.]+)deg\)/.exec(el.style.transform || '');
          return m ? Number(m[1]) : 0;
        })()
      }))
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    // 固定使用預設檔名，交由瀏覽器決定是否詢問儲存位置
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'KeboardTracker.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // Import JSON
  if (btnImportJson && fileImportJson) {
    btnImportJson.addEventListener('click', () => fileImportJson.click());
    fileImportJson.addEventListener('change', () => {
      // 開始新一輪匯入：增加 session，取消上一輪尚未執行的補圖提示
      currentImportSession++;
      if (pendingFixTimer) { clearTimeout(pendingFixTimer); pendingFixTimer = null; }
      const mySession = currentImportSession;
      const file = fileImportJson.files && fileImportJson.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        // 只處理最新一次匯入
        if (mySession !== currentImportSession) return;
        try {
          const data = JSON.parse(reader.result);
          // 嘗試建立 JSON 基準資料夾的 URL 以支援相對路徑
          let jsonBaseUrl = '';
          try { jsonBaseUrl = new URL('.', URL.createObjectURL(file)).href; } catch {}
          // Apply canvas settings
          if (data.canvas) {
            if (typeof data.canvas.width === 'number') { inputW.value = data.canvas.width; }
            if (typeof data.canvas.height === 'number') { inputH.value = data.canvas.height; }
            setStageSize(Number(inputW.value), Number(inputH.value));
            if (data.canvas.theme) applyTheme(String(data.canvas.theme));
          }
          // Clear current and load keys
          keys.clear();
          stage.querySelectorAll('.key').forEach(n => n.remove());
          if (Array.isArray(data.keys)) {
            data.keys.forEach(k => {
              // 允許 JSON 內帶路徑：先改用僅檔名做對照，提高補圖成功率
              let spriteName = '';
              if (k.sprite) {
                const segs = String(k.sprite).split(/[/\\]/);
                spriteName = segs[segs.length - 1];
              }
              const sprite = resolveSpritePath(spriteName || k.sprite, jsonBaseUrl);
              const el = createKeyElement({ id: k.id, x: k.x, y: k.y, w: k.w, h: k.h, rotation: k.rotation, sprite });
              el.dataset.keyBinding = k.keyBinding || '';
              if (typeof k.vk === 'number') el.dataset.vk = String(k.vk);
              if (typeof k.extended === 'boolean') el.dataset.extended = String(k.extended);
              // 保存原檔名以利後續資料夾比對（k.sprite 可能已是檔名或路徑）
              if (k.sprite) {
                const segs = String(k.sprite).split(/[/\\]/);
                const name = segs[segs.length - 1];
                if (name && !/^blob:/i.test(name)) el.dataset.spriteName = name;
              }
              if (sprite) {
                el.dataset.sprite = sprite;
                applySpriteToElement(el);
                el.style.width = `${k.w}px`;
                el.style.height = `${k.h}px`;
              }
            });
          }
          clearSelection();
          refreshKeyList();
          pushHistory();
          // 匯入後直接開啟「補齊.json圖片」資料夾選擇，以便立即修復路徑
          const needPrompt = stage.querySelectorAll('.key').length > 0; // 有鍵才提示
          pendingFixTimer = setTimeout(() => {
            if (mySession !== currentImportSession) return;
            const prompt = document.getElementById('fixPrompt');
            const btn = document.getElementById('btnPromptPick');
            if (prompt && btn && needPrompt) {
              prompt.classList.remove('hidden');
              btn.onclick = () => {
                prompt.classList.add('hidden');
                if (btnPickImageDir) btnPickImageDir.click();
              };
            } else if (btnPickImageDir) {
              // 後備：若無提示元素，仍直接彈檔案夾選擇
              btnPickImageDir.click();
            }
          }, 50);
        } catch (err) {
          alert(t('importFail'));
        }
      };
      reader.readAsText(file, 'utf-8');
    });
  }

  // 解析圖片路徑：支援相對於 JSON 位置、使用者指定資料夾或名稱映射表
  let userImageBaseDirUrl = '';
  function resolveSpritePath(sprite, jsonBaseUrl) {
    if (!sprite) return '';
    // 避免使用無效的 blob:null
    if (/^blob:null/i.test(sprite)) return '';
    // 若為絕對 URL 或 blob，直接回傳
    if (/^(blob:|https?:|file:\/\/)/i.test(sprite)) return sprite;
    // 只使用使用者選取資料夾所建立的 filename → ObjectURL 對應，不再嘗試以 blob: 當作目錄拼接
    // 先用「僅檔名」嘗試（忽略資料夾路徑）
    const keyFull = String(sprite).toLowerCase();
    const onlyName = keyFull.split(/[\\\/]/).pop();
    const onlyBase = onlyName.replace(/\.[^.]+$/, '');
    if (onlyName && imageNameToUrl.has(onlyName)) return imageNameToUrl.get(onlyName);
    if (onlyBase && imageBaseNameToUrl.has(onlyBase)) return imageBaseNameToUrl.get(onlyBase);
    // 找不到就返回空字串，待使用者用「Fix .json Images」選擇正確資料夾
    return '';
  }

  // 讓使用者選擇圖片資料夾作為相對根目錄
  if (btnPickImageDir && dirPickImageBase) {
    btnPickImageDir.addEventListener('click', () => dirPickImageBase.click());
    dirPickImageBase.addEventListener('change', () => {
      const files = dirPickImageBase.files ? Array.from(dirPickImageBase.files) : [];
      if (files.length === 0) return;
      // 不再以 blob URL 當作「資料夾 base」，統一只用檔名→ObjectURL 映射
      userImageBaseDirUrl = '';
      // 建立快取對應：完整檔名與去副檔名
      // 先釋放上一批 object URLs，避免記憶體累積與錯誤引用
      try { lastDirObjectUrls.forEach(u => URL.revokeObjectURL(u)); } catch {}
      lastDirObjectUrls = [];
      imageNameToUrl.clear();
      imageBaseNameToUrl.clear();
      files.forEach(f => {
        const url = URL.createObjectURL(f);
        lastDirObjectUrls.push(url);
        const full = (f.name || '').toLowerCase();
        const base = full.replace(/\.[^.]+$/, '');
        imageNameToUrl.set(full, url);
        if (!imageBaseNameToUrl.has(base)) imageBaseNameToUrl.set(base, url);
        imageUrlToName.set(url, f.name || '');
      });
      // 重試所有鍵的圖片載入（若 key.dataset.sprite 是檔名或相對路徑）
      keys.forEach(el => {
        // 先以保存的 spriteName（原檔名）嘗試；再以目前 sprite 欄位；再以建議檔名對應
        const id = el.dataset.id || '';
        let candidate = (el.dataset.spriteName || '').toLowerCase();
        let rebuilt = '';
        if (candidate) {
          rebuilt = resolveSpritePath(candidate, '');
        }
        if (!rebuilt) {
          const raw = (el.dataset.sprite || '').toLowerCase();
          rebuilt = resolveSpritePath(raw, '');
        }
        if (!rebuilt) {
          // 依 mapping 猜測
          const map = generateKeyFilenameMapping();
          const guess = (map[id] || id || '').toLowerCase();
          rebuilt = resolveSpritePath(guess, '');
        }
        if (rebuilt) {
          el.dataset.sprite = rebuilt;
          applySpriteToElement(el);
        }
      });
      alert(t('imgBaseSet'));
    });
  }

  // Import multiple images and auto-create keys
  if (btnImportImages && fileImportImages) {
    btnImportImages.addEventListener('click', () => fileImportImages.click());
    fileImportImages.addEventListener('change', () => {
      const files = fileImportImages.files ? Array.from(fileImportImages.files) : [];
      if (files.length === 0) return;
      // Map filename (without extension) -> { url, filename }
      const nameInfo = new Map();
      files.forEach(f => {
        const url = URL.createObjectURL(f);
        const filename = f.name || '';
        const base = filename.replace(/\.[^.]+$/, '').toLowerCase();
        nameInfo.set(base, { url, filename });
        imageUrlToName.set(url, filename);
      });

      // Build reverse map from recommended filenames -> binding key id
      const forwardMap = generateKeyFilenameMapping();
      const reverseMap = new Map();
      Object.entries(forwardMap).forEach(([keyId, fileBase]) => reverseMap.set(String(fileBase).toLowerCase(), keyId));

      // Create or update keys based on filenames
      nameInfo.forEach(({ url, filename }, base) => {
        const mappedId = reverseMap.get(base) || base; // prefer known key id from mapping
        let el = keys.get(mappedId);
        if (!el) {
          el = createKeyElement({ id: mappedId, x: 10, y: 10, w: 64, h: 64, rotation: 0, sprite: url });
        }
        el.dataset.sprite = url;
        el.dataset.spriteName = filename; // 記錄原始檔名，供匯出與補圖
        applySpriteToElement(el);
        // If the filename matches known mapping, bind that key automatically
        if (reverseMap.has(base)) {
          el.dataset.keyBinding = mappedId;
          el.dataset.vk = String(vkForElement(el));
        }
      });

      refreshKeyList();
      pushHistory();
    });
  }

  // Download key name mapping table
  if (btnDownloadKeyMap) {
    btnDownloadKeyMap.addEventListener('click', () => {
      const mapping = generateKeyFilenameMapping();
      const header = '按鍵 (keyBinding) => 圖片檔名稱 (不含副檔名)';
      const lines = [header, ''].concat(
        Object.entries(mapping).map(([k,v]) => `${labelForKey(k)} => ${v}`)
      ).join('\n');
      const blob = new Blob([lines], { type:'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'key_filename_mapping.txt';
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  function labelForKey(keyId) {
    const symbols = {
      grave: '~', minus: '-', equal: '=', bracketleft: '[', bracketright: ']', backslash: '\\',
      semicolon: ';', quote: "'", comma: ',', period: '.', slash: '/',
      numpadadd: '+', numpadsubtract: '-', numpadmultiply: '*', numpaddivide: '/', numpaddecimal: '.',
    };
    const s = symbols[keyId];
    if (s) return `${keyId}(${s})`;
    return keyId;
  }

  function generateKeyFilenameMapping() {
    // 完整鍵位到建議圖片檔名（不含副檔名）的對應
    // 左右鍵以 left_/right_ 前綴清楚標註
    return {
      // mouse buttons & wheel
      mouseleft:'mouse_left', mouseright:'mouse_right', mousemiddle:'mouse_middle', mousex1:'mouse_x1', mousex2:'mouse_x2',
      wheelup:'wheel_up', wheeldown:'wheel_down',
      // letters
      a:'a', b:'b', c:'c', d:'d', e:'e', f:'f', g:'g', h:'h', i:'i', j:'j', k:'k', l:'l', m:'m', n:'n', o:'o', p:'p', q:'q', r:'r', s:'s', t:'t', u:'u', v:'v', w:'w', x:'x', y:'y', z:'z',
      // digits
      '0':'0','1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9',
      // function keys
      f1:'f1',f2:'f2',f3:'f3',f4:'f4',f5:'f5',f6:'f6',f7:'f7',f8:'f8',f9:'f9',f10:'f10',f11:'f11',f12:'f12',
      // editing and control cluster
      escape:'esc', backspace:'backspace', tab:'tab', enter:'enter', space:'space',
      insert:'insert', delete:'delete', home:'home', end:'end', pageup:'page_up', pagedown:'page_down',
      printscreen:'print_screen', scrolllock:'scroll_lock', pause:'pause', capslock:'caps_lock', numlock:'num_lock',
      // arrows
      arrowup:'arrow_up', arrowdown:'arrow_down', arrowleft:'arrow_left', arrowright:'arrow_right',
      // modifiers with side
      lshift:'left_shift', rshift:'right_shift', lctrl:'left_ctrl', rctrl:'right_ctrl', lalt:'left_alt', ralt:'right_alt', lmeta:'left_win', rmeta:'right_win', contextmenu:'menu',
      // punctuation (US)
      grave:'grave', minus:'minus', equal:'equal', bracketleft:'bracket_left', bracketright:'bracket_right', backslash:'backslash',
      semicolon:'semicolon', quote:'quote', comma:'comma', period:'period', slash:'slash',
      // numpad
      numpad0:'numpad_0', numpad1:'numpad_1', numpad2:'numpad_2', numpad3:'numpad_3', numpad4:'numpad_4', numpad5:'numpad_5', numpad6:'numpad_6', numpad7:'numpad_7', numpad8:'numpad_8', numpad9:'numpad_9',
      numpadadd:'numpad_add', numpadsubtract:'numpad_subtract', numpadmultiply:'numpad_multiply', numpaddivide:'numpad_divide', numpaddecimal:'numpad_decimal', numpadenter:'numpad_enter'
    };
  }

  // Apply keyboard layout preset by placing keys on grid based on filenames already imported
  if (btnApplyLayout && layoutPreset) {
    btnApplyLayout.addEventListener('click', () => {
      const preset = layoutPreset.value;
      const size = Math.max(8, Number(keyBaseSize.value || 64));
      const gap = Math.max(0, Number(keyGap.value || 8));
      if (preset === 'ansi104') applyAnsi104Layout(size, gap);
      updateMultiBox();
      pushHistory();
    });
  }

  function applyAnsi104Layout(size, gap) {
    const sx = 10, sy = 10; // origin
    const W = (n=1) => n*size + (n-1)*gap;
    const P = (col,row) => [sx + col*(size+gap), sy + row*(size+gap)];
    const half = Math.round((size+gap) * 0.5);
    const PShift = (col,row,dx) => { const [x,y] = P(col,row); return [x + dx, y]; };
    const clusterOffset = half; // 與相鄰區域保持 0.5u 的間距

    // Row 0
    setKeyPositionOnly('escape', ...P(0,0));
    ['f1','f2','f3','f4','f5','f6','f7','f8','f9','f10','f11','f12']
      .forEach((k,i)=>setKeyPositionOnly(k, ...P(1+i,0)));

    // Row 1
    const row1 = ['grave','1','2','3','4','5','6','7','8','9','0','minus','equal'];
    row1.forEach((k,i)=>setKeyPositionOnly(k, ...P(i,1)));
    setKeyPositionOnly('backspace', sx + W(row1.length) + gap, sy + 1*(size+gap));

    // Row 2
    setKeyPositionOnly('tab', sx, sy + 2*(size+gap));
    const row2 = ['q','w','e','r','t','y','u','i','o','p','bracketleft','bracketright','backslash'];
    row2.forEach((k,i)=>setKeyPositionOnly(k, sx + Math.round(size*1.5) + gap + i*(size+gap), sy + 2*(size+gap)));

    // Row 3
    setKeyPositionOnly('capslock', sx, sy + 3*(size+gap));
    const row3 = ['a','s','d','f','g','h','j','k','l','semicolon','quote'];
    row3.forEach((k,i)=>setKeyPositionOnly(k, sx + Math.round(size*1.75) + gap + i*(size+gap), sy + 3*(size+gap)));
    setKeyPositionOnly('enter', sx + Math.round(size*1.75) + gap + row3.length*(size+gap), sy + 3*(size+gap));

    // Row 4
    setKeyPositionOnly('lshift', sx, sy + 4*(size+gap));
    const row4 = ['z','x','c','v','b','n','m','comma','period','slash'];
    row4.forEach((k,i)=>setKeyPositionOnly(k, sx + Math.round(size*2.25) + gap + i*(size+gap), sy + 4*(size+gap)));
    setKeyPositionOnly('rshift', sx + Math.round(size*2.25) + gap + row4.length*(size+gap), sy + 4*(size+gap));

    // Row 5 bottom mods
    const baseY = sy + 5*(size+gap);
    let cx = sx;
    const wMod = Math.round(size*1.25);
    setKeyPositionOnly('lctrl', cx, baseY); cx += wMod + gap;
    setKeyPositionOnly('lmeta', cx, baseY); cx += wMod + gap;
    setKeyPositionOnly('lalt', cx, baseY); cx += wMod + gap;
    setKeyPositionOnly('space', cx, baseY); cx += Math.round(size*6.25 + gap*5.25) + gap;
    setKeyPositionOnly('ralt', cx, baseY); cx += wMod + gap;
    setKeyPositionOnly('rmeta', cx, baseY); cx += wMod + gap;
    setKeyPositionOnly('contextmenu', cx, baseY); cx += wMod + gap;
    setKeyPositionOnly('rctrl', cx, baseY);

    // Arrow cluster
    setKeyPositionOnly('arrowup', ...PShift(16,4, half));
    setKeyPositionOnly('arrowleft', ...PShift(15,5, half));
    setKeyPositionOnly('arrowdown', ...PShift(16,5, half));
    setKeyPositionOnly('arrowright', ...PShift(17,5, half));

    // Navigation cluster 3x3
    setKeyPositionOnly('printscreen', ...PShift(15,0, clusterOffset));
    setKeyPositionOnly('scrolllock', ...PShift(16,0, clusterOffset));
    setKeyPositionOnly('pause', ...PShift(17,0, clusterOffset));
    setKeyPositionOnly('insert', ...PShift(15,1, clusterOffset));
    setKeyPositionOnly('home', ...PShift(16,1, clusterOffset));
    setKeyPositionOnly('pageup', ...PShift(17,1, clusterOffset));
    setKeyPositionOnly('delete', ...PShift(15,2, clusterOffset));
    setKeyPositionOnly('end', ...PShift(16,2, clusterOffset));
    setKeyPositionOnly('pagedown', ...PShift(17,2, clusterOffset));

    // Numpad
    const ncol = 19;
    setKeyPositionOnly('numlock', ...PShift(ncol,1, clusterOffset));
    setKeyPositionOnly('numpaddivide', ...PShift(ncol+1,1, clusterOffset));
    setKeyPositionOnly('numpadmultiply', ...PShift(ncol+2,1, clusterOffset));
    setKeyPositionOnly('numpadsubtract', ...PShift(ncol+3,1, clusterOffset));
    setKeyPositionOnly('numpad7', ...PShift(ncol,2, clusterOffset));
    setKeyPositionOnly('numpad8', ...PShift(ncol+1,2, clusterOffset));
    setKeyPositionOnly('numpad9', ...PShift(ncol+2,2, clusterOffset));
    { const p = PShift(ncol+3,2, clusterOffset); setKeyPositionOnly('numpadadd', p[0], p[1]); }
    setKeyPositionOnly('numpad4', ...PShift(ncol,3, clusterOffset));
    setKeyPositionOnly('numpad5', ...PShift(ncol+1,3, clusterOffset));
    setKeyPositionOnly('numpad6', ...PShift(ncol+2,3, clusterOffset));
    setKeyPositionOnly('numpad1', ...PShift(ncol,4, clusterOffset));
    setKeyPositionOnly('numpad2', ...PShift(ncol+1,4, clusterOffset));
    setKeyPositionOnly('numpad3', ...PShift(ncol+2,4, clusterOffset));
    { const p2 = PShift(ncol+3,4, clusterOffset); setKeyPositionOnly('numpadenter', p2[0], p2[1]); }
    { const p0 = PShift(ncol,5, clusterOffset); setKeyPositionOnly('numpad0', p0[0], p0[1]); }
    setKeyPositionOnly('numpaddecimal', ...PShift(ncol+2,5, clusterOffset));
  }

  function placeKey(keyId, x, y, w, h) {
    const el = keys.get(keyId);
    if (!el) return;
    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(y)}px`;
    el.style.width = `${Math.round(w)}px`;
    el.style.height = `${Math.round(h)}px`;
  }

  function setKeyPositionOnly(keyId, x, y) {
    const el = keys.get(keyId);
    if (!el) return;
    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(y)}px`;
  }

  // Initial stage size from inputs
  setStageSize(Number(inputW.value), Number(inputH.value));
  applyTransform();

  // Focus stage wrapper on click for smooth wheel scroll
  stageWrapper.addEventListener('mousedown', () => stageWrapper.focus());

  // 依 sprite 圖片自動設定按鍵尺寸與顯示：上下各一半
  function applySpriteToElement(el) {
    let src = el.dataset.sprite || '';
    // 若元素已存在舊圖載入計時器，先取消避免交錯
    if (el._imgLoadTimer) { clearTimeout(el._imgLoadTimer); el._imgLoadTimer = null; }
    if (propSprite && src && !src.startsWith('blob:')) {
      // 正規化 Windows 路徑
      if (/^[A-Za-z]:[\\/]/.test(src)) {
        src = src.replace(/\\/g, '/');
        src = `file:///${encodeURI(src)}`;
        el.dataset.sprite = src;
      }
    }
    if (!src) {
      el.classList.remove('sprite');
      // fallback placeholder
      const svg = `url("data:image/svg+xml;utf8,${encodeURIComponent(`
        <svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'>
          <rect x='0' y='0' width='64' height='64' fill='none' stroke='%23bcd3ff' stroke-width='2'/>
        </svg>
      `)}")`;
      el.style.backgroundImage = svg;
      el.style.backgroundSize = 'contain';
      el.style.backgroundRepeat = 'no-repeat';
      if (propSpriteHint) propSpriteHint.textContent = '';
      if (el === selected && propSprite) propSprite.value = '';
      return;
    }
    const doLoad = () => {
      const img = new Image();
      img.onload = () => {
      const fullW = img.width;
      const fullH = img.height;
      // 若高度為奇數，忽略中間 1px
      const frameH = Math.floor(fullH / 2);
      el.style.width = `${fullW}px`;
      el.style.height = `${frameH}px`;
      el.classList.add('sprite');
      el.style.backgroundImage = `url('${src}')`;
      el.style.backgroundSize = `100% 200%`;
      el.style.backgroundRepeat = 'no-repeat';
      if (propSpriteHint) {
        if (!(propSprite && (propSprite.value || '').startsWith('blob:'))) {
          const clean = src.split('?')[0].split('#')[0];
          const parts = clean.split(/[/\\]/);
          propSpriteHint.textContent = parts[parts.length - 1] || '';
        }
      }
      if (el === selected && propSprite) {
        // 面板顯示檔名（若有 spriteName 優先）
        propSprite.value = displaySpriteTextFor(el);
      }
      // 非按下顯示上半（0%），按下時 CSS 已切到 100%
      };
      img.onerror = () => {
      // 保持既有大小並顯示 placeholder
      el.classList.remove('sprite');
      const svg = `url("data:image/svg+xml;utf8,${encodeURIComponent(`
        <svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'>
          <rect x='0' y='0' width='64' height='64' fill='none' stroke='%23bcd3ff' stroke-width='2'/>
        </svg>
      `)}")`;
      el.style.backgroundImage = svg;
      el.style.backgroundSize = 'contain';
      el.style.backgroundRepeat = 'no-repeat';
      if (propSpriteHint) propSpriteHint.textContent = '';
      };
      img.src = src;
    };
    // 圖片過大或檔案系統延遲時，延後一幀載入以避免瞬間切換造成未刷新
    el._imgLoadTimer = setTimeout(doLoad, 0);
  }
})();


