/**
 * Content script for SoundCloud Friends Listening.
 *
 *  - Captures the currently-playing track from the SoundCloud DOM and pushes
 *    it to the background worker, which forwards to the local server.
 *  - Renders a floating "FRIENDS LISTENING" widget in the top-right corner.
 *  - Injects a settings button into the SoundCloud top bar (and falls back
 *    to a floating button if the bar isn't present), which opens the
 *    extension popup.
 */

(() => {
  if (window.__scflInjected) return;
  window.__scflInjected = true;

  const STATUS_PUSH_INTERVAL_MS = 12_000;
  const TOPBAR_PROBE_MS = 1500;

  // ----- helpers ------------------------------------------------------- //

  function send(type, payload) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type, payload }, (resp) => resolve(resp || { ok: false }));
      } catch (e) {
        resolve({ ok: false, error: String(e) });
      }
    });
  }

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null) node.setAttribute(k, v);
    }
    for (const child of children) {
      if (child == null) continue;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return node;
  }

  // SVG icons (inline, so no extra fetches).
  const ICON = {
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  };

  // ----- track capture from the SoundCloud player --------------------- //

  function readPlayingTrack() {
    // SoundCloud's persistent player lives at .playControls.
    const player = document.querySelector('.playControls');
    if (!player) return null;

    const titleEl = player.querySelector('.playbackSoundBadge__titleLink');
    if (!titleEl) return null;

    const isPlaying = !!document.querySelector('.playControl.playing, .playControls__play.playing');
    if (!isPlaying) return null;

    const title = (titleEl.getAttribute('title') || titleEl.textContent || '').trim();
    const artistEl = player.querySelector('.playbackSoundBadge__lightLink');
    const artist = artistEl ? (artistEl.getAttribute('title') || artistEl.textContent || '').trim() : '';

    let url = titleEl.getAttribute('href') || '';
    if (url && url.startsWith('/')) url = 'https://soundcloud.com' + url;

    let artwork = '';
    const art = player.querySelector('.playbackSoundBadge__avatar .image__lightOutline, .playbackSoundBadge__avatar .sc-artwork');
    if (art) {
      const bg = (art.style && art.style.backgroundImage) || '';
      const m = bg.match(/url\((['"]?)(.*?)\1\)/);
      if (m) artwork = m[2];
    }

    return {
      track_title: title || null,
      track_artist: artist || null,
      track_url: url || null,
      artwork_url: artwork || null,
    };
  }

  let lastSentKey = null;

  async function pushIfChanged() {
    const cfg = await send('getConfig');
    if (!cfg.ok || !cfg.data || !cfg.data.token) return;

    const track = readPlayingTrack();
    // Always push at least every interval so the server knows we're live;
    // but skip if nothing playing AND we already pushed empty recently.
    const key = JSON.stringify(track || {});
    if (key === lastSentKey) {
      // still push every 4th tick to refresh updated_at
      pushIfChanged.tick = (pushIfChanged.tick || 0) + 1;
      if (pushIfChanged.tick % 4 !== 0) return;
    }
    lastSentKey = key;
    await send('pushStatus', track || {});
  }

  setInterval(pushIfChanged, STATUS_PUSH_INTERVAL_MS);
  pushIfChanged();

  // ----- widget -------------------------------------------------------- //

  let widget = null;
  let lastFriends = [];

  function buildWidget() {
    if (widget) return widget;

    widget = el('div', { id: 'scfl-widget' });

    const header = el('header', {},
      el('div', { class: 'scfl-title' },
        el('span', { class: 'scfl-pulse' }),
        document.createTextNode('Friends Listening'),
      ),
      el('div', { class: 'scfl-actions' },
        el('button', {
          class: 'scfl-iconbtn', title: 'Обновить',
          html: ICON.refresh,
          onclick: () => { renderWidget([], { loading: true }); refreshFriends(); },
        }),
        el('button', {
          class: 'scfl-iconbtn', title: 'Открыть настройки',
          html: ICON.settings,
          onclick: openSettings,
        }),
        el('button', {
          class: 'scfl-iconbtn', title: 'Свернуть',
          html: ICON.chevron,
          onclick: () => widget.classList.toggle('scfl-hidden'),
        }),
      ),
    );

    const list = el('div', { class: 'scfl-list', id: 'scfl-list' },
      el('div', { class: 'scfl-empty' },
        el('strong', {}, 'Загрузка...'),
        document.createTextNode('Получаем статусы друзей.'),
      ),
    );

    const footer = el('footer', {},
      el('span', { id: 'scfl-server-status' },
        el('span', { class: 'scfl-status-dot' }),
        document.createTextNode('Подключение...'),
      ),
      el('button', { class: 'scfl-cta', onclick: openSettings }, 'Настройки'),
    );

    widget.append(header, list, footer);
    document.body.appendChild(widget);
    return widget;
  }

  function renderWidget(friends, opts = {}) {
    const w = buildWidget();
    const list = w.querySelector('#scfl-list');
    list.innerHTML = '';

    if (opts.error) {
      list.appendChild(el('div', { class: 'scfl-empty' },
        el('strong', {}, 'Сервер недоступен'),
        document.createTextNode(opts.error),
      ));
      setStatus('warning', 'офлайн');
      return;
    }

    if (opts.notRegistered) {
      list.appendChild(el('div', { class: 'scfl-empty' },
        el('strong', {}, 'Зарегистрируйся'),
        document.createTextNode('Открой настройки и придумай ник.'),
      ));
      setStatus('warning', 'не зарегистрирован');
      return;
    }

    if (opts.loading) {
      list.appendChild(el('div', { class: 'scfl-empty' }, el('strong', {}, 'Загрузка...')));
      return;
    }

    if (!friends || !friends.length) {
      list.appendChild(el('div', { class: 'scfl-empty' },
        el('strong', {}, 'Никого нет'),
        document.createTextNode('Добавь друзей в попапе расширения.'),
      ));
      setStatus('ok', 'онлайн');
      return;
    }

    for (const item of friends) {
      const u = item.user;
      const t = item.track || {};
      const avatarBg = u.avatar_url ? `url("${u.avatar_url}")` : '';
      const row = el('a', {
        class: 'scfl-row',
        href: t.url || `https://soundcloud.com/${encodeURIComponent(u.username)}`,
        target: '_blank',
        rel: 'noopener noreferrer',
      });

      const avatar = el('span', { class: 'scfl-avatar' + (t.is_live ? ' scfl-live' : '') });
      if (avatarBg) avatar.style.backgroundImage = avatarBg;
      else avatar.textContent = u.username.slice(0, 1).toUpperCase();

      const meta = el('div', { class: 'scfl-meta' },
        el('div', { class: 'scfl-username' }, u.username),
        t.is_live && t.title
          ? el('div', { class: 'scfl-track' },
              el('span', { class: 'scfl-track-title' }, t.title),
              t.artist ? document.createTextNode(' — ' + t.artist) : null,
            )
          : el('div', { class: 'scfl-track scfl-offline' }, 'не в сети'),
      );

      row.append(avatar, meta);
      list.appendChild(row);
    }

    setStatus('ok', 'онлайн');
  }

  function setStatus(level, text) {
    const status = document.querySelector('#scfl-server-status');
    if (!status) return;
    status.innerHTML = '';
    status.append(
      el('span', { class: 'scfl-status-dot scfl-' + level }),
      document.createTextNode(text),
    );
  }

  async function refreshFriends() {
    const cfg = await send('getConfig');
    if (!cfg.ok || !cfg.data) return;
    if (!cfg.data.token) {
      renderWidget([], { notRegistered: true });
      return;
    }
    const r = await send('friendsListening');
    if (!r.ok) {
      renderWidget([], { error: r.error || 'unknown' });
      return;
    }
    lastFriends = r.data || [];
    renderWidget(lastFriends);
  }

  // ----- topbar button ------------------------------------------------- //

  function findTopbarSlot() {
    // SoundCloud's top bar varies; try a few selectors.
    const candidates = [
      '.header__userNav',
      '.header__right',
      '.l-fluid-flex .header__userNav',
      'nav .header__userNav',
    ];
    for (const sel of candidates) {
      const node = document.querySelector(sel);
      if (node) return node;
    }
    return null;
  }

  function buildTopbarButton(parent) {
    const btn = el('button', {
      id: 'scfl-topbar-button',
      title: 'Friends Listening — настройки',
      html: ICON.users,
      'data-badge': '',
      onclick: openSettings,
    });
    if (!parent) {
      btn.classList.add('scfl-floating');
      document.body.appendChild(btn);
    } else {
      parent.insertBefore(btn, parent.firstChild);
    }
    return btn;
  }

  let topbarBtn = null;

  function ensureTopbarButton() {
    if (topbarBtn && document.body.contains(topbarBtn)) return topbarBtn;
    const slot = findTopbarSlot();
    topbarBtn = buildTopbarButton(slot);
    return topbarBtn;
  }

  setInterval(ensureTopbarButton, TOPBAR_PROBE_MS);
  ensureTopbarButton();

  async function openSettings() {
    const r = await send('openPopup');
    if (!r.ok || (r.data && r.data.ok === false)) {
      showToast('Кликни на иконку расширения справа от адресной строки.');
    }
  }

  function showToast(text) {
    const old = document.getElementById('scfl-toast');
    if (old) old.remove();
    const t = el('div', { id: 'scfl-toast' }, text);
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4500);
  }

  // ----- listen for background broadcasts ----------------------------- //

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg) return;
    if (msg.type === 'friends_listening') {
      lastFriends = msg.payload || [];
      renderWidget(lastFriends);
    } else if (msg.type === 'config_changed') {
      refreshFriends();
    }
  });

  // initial render & refresh
  buildWidget();
  refreshFriends();

  // also refresh shortly after load (SoundCloud router can swap topbar)
  setTimeout(refreshFriends, 2000);
})();
