/* Twitch Custom Themes — popup script
 * Renders the preset/custom theme grids and powers the live editor.
 */
(function () {
  'use strict';

  const Engine = window.TwitchThemesEngine;
  const Presets = window.TwitchThemesPresets;

  const STORAGE_ACTIVE = 'tt:active';
  const STORAGE_CUSTOMS = 'tt:customs';
  const STORAGE_DISABLED = 'tt:disabled';

  /* ---------------- Storage helpers ---------------- */
  const storage = {
    get(keys) {
      return new Promise((res) => chrome.storage.local.get(keys, res));
    },
    set(obj) {
      return new Promise((res) => chrome.storage.local.set(obj, res));
    }
  };

  /* ---------------- Tab switching ---------------- */
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('tab-active', t === tab));
      document.querySelectorAll('.tab-content').forEach((c) => {
        c.classList.toggle('tab-content-active', c.dataset.tab === target);
      });
    });
  });

  /* ---------------- Toast ---------------- */
  const toastEl = document.getElementById('toast');
  let toastT = 0;
  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('show'), 1600);
  }

  /* ---------------- Tab → content script messaging ---------------- */
  async function findTwitchTab() {
    const tabs = await new Promise((res) =>
      chrome.tabs.query({ url: ['*://*.twitch.tv/*'] }, res)
    );
    if (!tabs.length) return null;
    // Prefer active tab in current window if it's a twitch tab.
    const active = tabs.find((t) => t.active) || tabs[0];
    return active;
  }

  async function sendToTwitch(msg) {
    const tab = await findTwitchTab();
    if (!tab) return { ok: false, error: 'no-twitch-tab' };
    return new Promise((res) => {
      try {
        chrome.tabs.sendMessage(tab.id, msg, (resp) => {
          if (chrome.runtime.lastError) res({ ok: false, error: chrome.runtime.lastError.message });
          else res(resp || { ok: true });
        });
      } catch (e) {
        res({ ok: false, error: String(e) });
      }
    });
  }

  /* ---------------- Preview helpers ---------------- */
  let previewT = 0;
  function previewTheme(theme) {
    clearTimeout(previewT);
    previewT = setTimeout(() => sendToTwitch({ type: 'tt:preview', theme }), 80);
  }
  function clearPreview() {
    clearTimeout(previewT);
    sendToTwitch({ type: 'tt:clear-preview' });
  }

  /* ---------------- Preset/Custom rendering ---------------- */
  function makeCard(theme, opts) {
    opts = opts || {};
    const card = document.createElement('div');
    card.className = 'theme-card';
    card.dataset.id = theme.id;
    if (opts.active) card.classList.add('active');
    const v = theme.vars || {};
    const accent =
      (theme.effects && theme.effects.accent) ||
      v['--color-background-button-primary-default'] ||
      '#9147ff';
    const bg = v['--color-background-body'] || '#0e0e10';
    const surface = v['--color-background-base'] || '#18181b';
    const text = v['--color-text-base'] || '#efeff1';
    const textAlt = v['--color-text-alt'] || '#adadb8';
    const pageBg = theme.pageBackground || {};
    let previewBg;
    if (pageBg.enabled && pageBg.type === 'gradient' && pageBg.gradient) previewBg = pageBg.gradient;
    else if (pageBg.enabled && pageBg.type === 'image' && pageBg.image)
      previewBg = `url("${pageBg.image}") center/cover`;
    else previewBg = bg;

    card.innerHTML = `
      <div class="preview" style="background: ${previewBg};">
        <div class="preview-bar" style="background: ${accent};"></div>
        <div class="preview-chat" style="background: ${surface}; border: 1px solid rgba(255,255,255,0.06);"></div>
        <div class="preview-line" style="left: 6px; top: 28px; width: 50%; background: ${text};"></div>
        <div class="preview-line" style="left: 6px; top: 42px; width: 30%; background: ${textAlt};"></div>
        <div class="preview-line" style="left: 6px; top: 56px; width: 40%; background: ${text}; opacity: 0.6;"></div>
        <div class="preview-line" style="left: 6px; top: 70px; width: 25%; background: ${accent};"></div>
      </div>
      <div class="meta">
        <div class="meta-title"></div>
        <div class="meta-cat"></div>
      </div>
      <div class="actions"></div>
    `;
    card.querySelector('.meta-title').textContent = theme.name;
    card.querySelector('.meta-cat').textContent =
      theme.category === 'dark' ? 'тёмная' :
      theme.category === 'light' ? 'светлая' :
      theme.category === 'special' ? 'специальная' : 'кастомная';
    const actions = card.querySelector('.actions');

    const applyBtn = document.createElement('button');
    applyBtn.className = 'btn-primary';
    applyBtn.textContent = 'Применить';
    applyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      applyTheme(theme, opts.kind || 'preset');
    });
    actions.appendChild(applyBtn);

    if (opts.kind === 'custom') {
      const editBtn = document.createElement('button');
      editBtn.className = 'btn';
      editBtn.textContent = 'Изменить';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        loadIntoEditor(theme);
        switchTab('editor');
      });
      const dupBtn = document.createElement('button');
      dupBtn.className = 'btn-ghost';
      dupBtn.textContent = '⧉';
      dupBtn.title = 'Дублировать';
      dupBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        duplicateCustom(theme);
      });
      const delBtn = document.createElement('button');
      delBtn.className = 'btn-danger';
      delBtn.textContent = '✕';
      delBtn.title = 'Удалить';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Удалить тему "${theme.name}"?`)) deleteCustom(theme.id);
      });
      actions.appendChild(editBtn);
      actions.appendChild(dupBtn);
      actions.appendChild(delBtn);
    } else {
      const dupBtn = document.createElement('button');
      dupBtn.className = 'btn';
      dupBtn.textContent = 'В мои';
      dupBtn.title = 'Скопировать в мои темы для редактирования';
      dupBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        duplicateCustom(theme);
        toast('Скопировано в «Мои темы»');
      });
      actions.appendChild(dupBtn);
    }

    // Hover preview.
    card.addEventListener('mouseenter', () => previewTheme(theme));
    card.addEventListener('mouseleave', () => clearPreview());

    return card;
  }

  function switchTab(name) {
    const t = document.querySelector(`.tab[data-tab="${name}"]`);
    if (t) t.click();
  }

  /* ---------------- Apply/Save ---------------- */
  async function applyTheme(theme, kind) {
    let payload;
    if (kind === 'preset') payload = { kind: 'preset', id: theme.id };
    else if (kind === 'custom') payload = { kind: 'custom', id: theme.id };
    else payload = { kind: 'inline', theme };
    await storage.set({ [STORAGE_ACTIVE]: payload, [STORAGE_DISABLED]: false });
    document.getElementById('theme-toggle').checked = true;
    await sendToTwitch({ type: 'tt:apply' });
    toast(`Применена: ${theme.name}`);
    renderPresets();
    renderCustoms();
  }

  /* ---------------- State ---------------- */
  const state = {
    customs: [],
    activeRef: null,
    presetFilter: 'all',
    presetSearch: '',
    editor: Engine.makeEmptyTheme()
  };

  /* ---------------- Render presets ---------------- */
  function renderPresets() {
    const container = document.getElementById('preset-grid');
    container.innerHTML = '';
    const all = Presets.all();
    const filtered = all.filter((t) => {
      if (state.presetFilter !== 'all' && t.category !== state.presetFilter) return false;
      if (state.presetSearch && !t.name.toLowerCase().includes(state.presetSearch.toLowerCase()))
        return false;
      return true;
    });
    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'Ничего не найдено по этому запросу.';
      container.appendChild(empty);
      return;
    }
    filtered.forEach((t) => {
      const isActive =
        state.activeRef &&
        state.activeRef.kind === 'preset' &&
        state.activeRef.id === t.id;
      container.appendChild(makeCard(t, { kind: 'preset', active: isActive }));
    });
  }

  document.getElementById('preset-search').addEventListener('input', (e) => {
    state.presetSearch = e.target.value;
    renderPresets();
  });
  document.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('chip-active', c === chip));
      state.presetFilter = chip.dataset.filter;
      renderPresets();
    });
  });

  /* ---------------- Render customs ---------------- */
  function renderCustoms() {
    const container = document.getElementById('custom-grid');
    const empty = document.getElementById('custom-empty');
    container.innerHTML = '';
    if (!state.customs.length) {
      container.appendChild(empty);
      return;
    }
    state.customs.forEach((t) => {
      const isActive =
        state.activeRef &&
        state.activeRef.kind === 'custom' &&
        state.activeRef.id === t.id;
      container.appendChild(makeCard(t, { kind: 'custom', active: isActive }));
    });
  }

  document.getElementById('new-custom-btn').addEventListener('click', () => {
    const t = Engine.makeEmptyTheme();
    t.name = 'Новая тема';
    loadIntoEditor(t);
    switchTab('editor');
  });

  document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const themes = Array.isArray(data) ? data : [data];
      for (const t of themes) {
        if (!t || typeof t !== 'object') continue;
        t.id = t.id && !state.customs.some((c) => c.id === t.id) ? t.id : 'custom-' + Date.now() + '-' + Math.floor(Math.random() * 1e6);
        t.category = 'custom';
        state.customs.push(t);
      }
      await storage.set({ [STORAGE_CUSTOMS]: state.customs });
      renderCustoms();
      toast('Импорт выполнен');
    } catch (err) {
      toast('Ошибка импорта');
    } finally {
      e.target.value = '';
    }
  });

  async function duplicateCustom(theme) {
    const copy = JSON.parse(JSON.stringify(theme));
    copy.id = 'custom-' + Date.now();
    copy.name = (theme.name || 'Тема') + ' (копия)';
    copy.category = 'custom';
    state.customs.push(copy);
    await storage.set({ [STORAGE_CUSTOMS]: state.customs });
    renderCustoms();
  }
  async function deleteCustom(id) {
    state.customs = state.customs.filter((c) => c.id !== id);
    await storage.set({ [STORAGE_CUSTOMS]: state.customs });
    if (state.activeRef && state.activeRef.kind === 'custom' && state.activeRef.id === id) {
      await storage.set({ [STORAGE_ACTIVE]: null });
      await sendToTwitch({ type: 'tt:clear' });
    }
    renderCustoms();
    toast('Тема удалена');
  }

  /* ---------------- Theme toggle ---------------- */
  const toggle = document.getElementById('theme-toggle');
  toggle.addEventListener('change', async (e) => {
    if (e.target.checked) {
      await storage.set({ [STORAGE_DISABLED]: false });
      await sendToTwitch({ type: 'tt:apply' });
      toast('Тема включена');
    } else {
      await storage.set({ [STORAGE_DISABLED]: true });
      await sendToTwitch({ type: 'tt:clear' });
      toast('Тема выключена');
    }
  });

  document.getElementById('open-twitch-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://www.twitch.tv/' });
  });

  /* ---------------- EDITOR ---------------- */
  const ed = state.editor;

  function loadIntoEditor(theme) {
    state.editor = JSON.parse(JSON.stringify(theme));
    if (!state.editor.vars) state.editor.vars = {};
    if (!state.editor.chat) state.editor.chat = {};
    if (!state.editor.effects) state.editor.effects = {};
    ['pageBackground', 'chatBackground', 'sidebarBackground', 'topbarBackground'].forEach((k) => {
      state.editor[k] = Object.assign(Engine.makeEmptyLayer(), state.editor[k] || {});
    });
    syncEditorUI();
    pushPreview();
  }

  function pushPreview() {
    if (!toggle.checked) return; // disabled state
    previewTheme(state.editor);
  }

  /* Build layer form HTML for each background slot. */
  function buildLayerForm(container, key) {
    container.innerHTML = `
      <div class="layer-form">
        <label class="full"><input type="checkbox" data-field="enabled" /> Включить</label>
        <label>Тип
          <select data-field="type">
            <option value="color">Сплошной цвет</option>
            <option value="gradient">Градиент</option>
            <option value="image">Картинка / GIF</option>
          </select>
        </label>
        <label>Цвет<input type="color" data-field="color" /></label>
        <label class="full">Градиент CSS<input type="text" data-field="gradient" placeholder="linear-gradient(135deg,#9147ff,#ff36c8)" /></label>
        <div class="full layer-image-row">
          <div class="layer-image-thumb" data-thumb></div>
          <button class="btn" data-action="upload">Загрузить картинку/GIF</button>
          <button class="btn-ghost" data-action="url">URL</button>
          <button class="btn-ghost" data-action="clear">Удалить</button>
          <input type="file" accept="image/*" hidden data-file />
        </div>
        <label>Размер
          <select data-field="size">
            <option value="cover">cover (заполняет)</option>
            <option value="contain">contain (вписывает)</option>
            <option value="auto">auto (как есть)</option>
            <option value="100% 100%">растянуть</option>
          </select>
        </label>
        <label>Повтор
          <select data-field="repeat">
            <option value="no-repeat">no-repeat</option>
            <option value="repeat">repeat</option>
            <option value="repeat-x">repeat-x</option>
            <option value="repeat-y">repeat-y</option>
          </select>
        </label>
        <label>Позиция X (%) <input type="range" data-field="positionX" min="0" max="100" step="1" /></label>
        <label>Позиция Y (%) <input type="range" data-field="positionY" min="0" max="100" step="1" /></label>
        <label>Прозрачность <input type="range" data-field="opacity" min="0" max="1" step="0.05" /></label>
        <label>Размытие (px) <input type="range" data-field="blur" min="0" max="40" step="1" /></label>
      </div>
    `;
    const layer = state.editor[key];

    function refresh() {
      container.querySelector('[data-field="enabled"]').checked = !!layer.enabled;
      container.querySelector('[data-field="type"]').value = layer.type || 'color';
      container.querySelector('[data-field="color"]').value = normalizeHex(layer.color) || '#000000';
      container.querySelector('[data-field="gradient"]').value = layer.gradient || '';
      container.querySelector('[data-field="size"]').value = layer.size || 'cover';
      container.querySelector('[data-field="repeat"]').value = layer.repeat || 'no-repeat';
      const pos = parsePos(layer.position);
      container.querySelector('[data-field="positionX"]').value = pos.x;
      container.querySelector('[data-field="positionY"]').value = pos.y;
      container.querySelector('[data-field="opacity"]').value = typeof layer.opacity === 'number' ? layer.opacity : 1;
      container.querySelector('[data-field="blur"]').value = layer.blur || 0;
      const thumb = container.querySelector('[data-thumb]');
      if (layer.image) thumb.style.background = `url("${layer.image}") center/cover`;
      else thumb.style.background = '#222';
    }

    container.querySelectorAll('[data-field]').forEach((input) => {
      input.addEventListener('input', () => {
        const f = input.dataset.field;
        if (f === 'enabled') layer.enabled = input.checked;
        else if (f === 'opacity' || f === 'blur') layer[f] = parseFloat(input.value);
        else if (f === 'positionX' || f === 'positionY') {
          const x = container.querySelector('[data-field="positionX"]').value;
          const y = container.querySelector('[data-field="positionY"]').value;
          layer.position = `${x}% ${y}%`;
        } else {
          layer[f] = input.value;
        }
        pushPreview();
      });
    });

    container.querySelector('[data-action="upload"]').addEventListener('click', () => {
      container.querySelector('[data-file]').click();
    });
    container.querySelector('[data-file]').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const dataUrl = await fileToDataURL(file);
      layer.image = dataUrl;
      layer.type = 'image';
      layer.enabled = true;
      refresh();
      container.querySelector('[data-field="type"]').value = 'image';
      container.querySelector('[data-field="enabled"]').checked = true;
      pushPreview();
    });
    container.querySelector('[data-action="url"]').addEventListener('click', () => {
      const url = prompt('URL картинки или GIF');
      if (!url) return;
      layer.image = url;
      layer.type = 'image';
      layer.enabled = true;
      refresh();
      container.querySelector('[data-field="type"]').value = 'image';
      container.querySelector('[data-field="enabled"]').checked = true;
      pushPreview();
    });
    container.querySelector('[data-action="clear"]').addEventListener('click', () => {
      layer.image = '';
      refresh();
      pushPreview();
    });

    refresh();
  }

  function parsePos(p) {
    if (!p) return { x: 50, y: 50 };
    const m = String(p).match(/(-?\d+)%\s+(-?\d+)%/);
    if (m) return { x: m[1], y: m[2] };
    return { x: 50, y: 50 };
  }

  function normalizeHex(c) {
    if (!c) return '';
    if (/^#[0-9a-f]{3}$/i.test(c)) {
      return '#' + c.slice(1).split('').map((ch) => ch + ch).join('');
    }
    if (/^#[0-9a-f]{6}$/i.test(c)) return c;
    // rgb/rgba etc — color input only supports hex; leave as-is.
    return '';
  }

  function fileToDataURL(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.readAsDataURL(file);
    });
  }

  function syncEditorUI() {
    document.getElementById('ed-name').value = state.editor.name || '';
    document.getElementById('ed-customCSS').value = state.editor.customCSS || '';

    document.querySelectorAll('input[data-var]').forEach((i) => {
      i.value = normalizeHex(state.editor.vars[i.dataset.var]) || '#000000';
    });
    document.querySelectorAll('input[data-effect]').forEach((i) => {
      i.value = normalizeHex(state.editor.effects[i.dataset.effect]) || '#000000';
    });
    document.querySelectorAll('[data-effect-bool]').forEach((i) => {
      i.checked = !!state.editor.effects[i.dataset.effectBool];
    });
    document.querySelectorAll('[data-chat]').forEach((i) => {
      const k = i.dataset.chat;
      if (i.type === 'checkbox') i.checked = !!state.editor.chat[k];
      else i.value = state.editor.chat[k] != null ? state.editor.chat[k] : '';
    });

    ['pageBackground', 'chatBackground', 'sidebarBackground', 'topbarBackground'].forEach((k) => {
      const div = document.querySelector(`[data-layer="${k}"]`);
      if (div) buildLayerForm(div, k);
    });
  }

  /* Wire up scalar editor inputs. */
  document.getElementById('ed-name').addEventListener('input', (e) => {
    state.editor.name = e.target.value;
    pushPreview();
  });
  document.getElementById('ed-customCSS').addEventListener('input', (e) => {
    state.editor.customCSS = e.target.value;
    pushPreview();
  });
  document.querySelectorAll('input[data-var]').forEach((i) => {
    i.addEventListener('input', () => {
      state.editor.vars[i.dataset.var] = i.value;
      pushPreview();
    });
  });
  document.querySelectorAll('input[data-effect]').forEach((i) => {
    i.addEventListener('input', () => {
      state.editor.effects[i.dataset.effect] = i.value;
      pushPreview();
    });
  });
  document.querySelectorAll('[data-effect-bool]').forEach((i) => {
    i.addEventListener('change', () => {
      state.editor.effects[i.dataset.effectBool] = i.checked;
      pushPreview();
    });
  });
  document.querySelectorAll('[data-chat]').forEach((i) => {
    i.addEventListener('input', () => {
      const k = i.dataset.chat;
      if (i.type === 'checkbox') state.editor.chat[k] = i.checked;
      else if (i.type === 'number') state.editor.chat[k] = i.value === '' ? 0 : parseFloat(i.value);
      else state.editor.chat[k] = i.value;
      pushPreview();
    });
  });

  document.getElementById('ed-from-preset').addEventListener('click', () => {
    const list = Presets.all().map((p) => `${p.id} — ${p.name}`).join('\n');
    const id = prompt('Введите id пресета (см. список):\n\n' + list, 'dark-twilight');
    if (!id) return;
    const p = Presets.byId(id.trim());
    if (!p) {
      toast('Пресет не найден');
      return;
    }
    const copy = JSON.parse(JSON.stringify(p));
    copy.id = 'custom-' + Date.now();
    copy.name = p.name + ' (копия)';
    copy.category = 'custom';
    loadIntoEditor(copy);
  });

  document.getElementById('ed-save').addEventListener('click', async () => {
    const t = JSON.parse(JSON.stringify(state.editor));
    t.category = 'custom';
    if (!t.name || !t.name.trim()) t.name = 'Без названия';
    const idx = state.customs.findIndex((c) => c.id === t.id);
    if (idx >= 0) state.customs[idx] = t;
    else state.customs.push(t);
    await storage.set({ [STORAGE_CUSTOMS]: state.customs });
    renderCustoms();
    toast('Тема сохранена');
  });

  document.getElementById('ed-apply').addEventListener('click', async () => {
    // Save first to get a stable id.
    document.getElementById('ed-save').click();
    // Then apply as inline to be safe (works even if save was async).
    const t = JSON.parse(JSON.stringify(state.editor));
    await applyTheme(t, 'custom');
  });

  document.getElementById('ed-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state.editor, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(state.editor.name || 'theme').replace(/\s+/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  /* ---------------- Init ---------------- */
  (async function init() {
    const data = await storage.get([STORAGE_CUSTOMS, STORAGE_ACTIVE, STORAGE_DISABLED]);
    state.customs = Array.isArray(data[STORAGE_CUSTOMS]) ? data[STORAGE_CUSTOMS] : [];
    state.activeRef = data[STORAGE_ACTIVE] || null;
    toggle.checked = !data[STORAGE_DISABLED];

    // Seed editor with last edited theme if any, else first preset.
    if (state.activeRef && state.activeRef.kind === 'custom') {
      const t = state.customs.find((c) => c.id === state.activeRef.id);
      if (t) state.editor = JSON.parse(JSON.stringify(t));
    }
    if (!state.editor || !state.editor.vars) state.editor = Engine.makeEmptyTheme();

    syncEditorUI();
    renderPresets();
    renderCustoms();
  })();
})();
