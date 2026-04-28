/* SoundCloud Friends Listening — popup logic. */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function send(type, payload) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, payload }, (resp) => resolve(resp || { ok: false }));
  });
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) node.setAttribute(k, v);
  }
  for (const c of children) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

function avatarNode(user, sizeClass = '') {
  const a = el('span', { class: 'avatar' + (sizeClass ? ' ' + sizeClass : '') });
  if (user.avatar_url) a.style.backgroundImage = `url("${user.avatar_url}")`;
  else a.textContent = (user.username || '?').slice(0, 1).toUpperCase();
  return a;
}

function showToast(message, kind = '') {
  const t = $('#toast');
  t.textContent = message;
  t.className = kind;
  t.hidden = false;
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => { t.hidden = true; }, 3500);
}

// --------------------------------------------------------------------- //
// Tabs                                                                  //
// --------------------------------------------------------------------- //

$$('.tab').forEach((btn) => {
  btn.addEventListener('click', () => activateTab(btn.dataset.tab));
});

function activateTab(name) {
  $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  $$('.panel').forEach((p) => p.classList.toggle('active', p.dataset.panel === name));
  if (name === 'friends')  loadFriends();
  if (name === 'requests') loadRequests();
}

// --------------------------------------------------------------------- //
// Settings                                                              //
// --------------------------------------------------------------------- //

async function refreshHeader() {
  const cfg = await send('getConfig');
  const me = $('#me-summary');
  if (cfg.ok && cfg.data && cfg.data.token) {
    me.innerHTML = '';
    me.append(
      el('span', {}, '@' + cfg.data.username),
    );
  } else {
    me.innerHTML = '<span class="muted">не подключён</span>';
  }
}

async function loadSettings() {
  const cfg = await send('getConfig');
  if (!cfg.ok) return;
  const c = cfg.data;
  $('#server-input').value = c.serverUrl || '';

  if (c.token) {
    $('#register-block').hidden = true;
    $('#account-block').hidden = false;
    $('#account-name').textContent = '@' + c.username;
    $('#account-token').textContent = 'token: ' + c.token.slice(0, 12) + '…';
  } else {
    $('#register-block').hidden = false;
    $('#account-block').hidden = true;
  }

  // Server health probe
  $('#server-hint').textContent = '…';
  try {
    const base = (c.serverUrl || '').replace(/\/+$/, '');
    const res = await fetch(`${base}/api/health`);
    if (res.ok) $('#server-hint').textContent = '✓ сервер отвечает';
    else $('#server-hint').textContent = `сервер ответил ${res.status}`;
  } catch (_) {
    $('#server-hint').textContent = '✗ сервер недоступен — запусти server/run.sh';
  }
}

$('#server-save').addEventListener('click', async () => {
  const v = $('#server-input').value.trim();
  if (!v) return showToast('Введи URL сервера', 'error');
  await send('setServerUrl', { serverUrl: v });
  showToast('Адрес сохранён');
  loadSettings();
});

$('#register-btn').addEventListener('click', async () => {
  const username = $('#username-input').value.trim();
  if (username.length < 2) return showToast('Ник должен быть не короче 2 символов', 'error');
  const r = await send('register', { username });
  if (!r.ok) return showToast(r.error || 'Не получилось зарегистрироваться', 'error');
  showToast('Зарегистрировался как @' + r.data.username);
  refreshHeader();
  loadSettings();
  loadFriends();
});

$('#logout-btn').addEventListener('click', async () => {
  await send('logout');
  showToast('Вышел');
  refreshHeader();
  loadSettings();
});

// --------------------------------------------------------------------- //
// Friends                                                               //
// --------------------------------------------------------------------- //

$('#friends-refresh').addEventListener('click', loadFriends);

async function loadFriends() {
  const list = $('#friends-list');
  list.innerHTML = '<li class="empty">Загрузка…</li>';

  const cfg = await send('getConfig');
  if (!cfg.ok || !cfg.data || !cfg.data.token) {
    list.innerHTML = '<li class="empty">Сначала зарегистрируйся в «Настройках».</li>';
    return;
  }

  const r = await send('listFriends');
  if (!r.ok) {
    list.innerHTML = `<li class="empty">${escapeHtml(r.error || 'ошибка')}</li>`;
    return;
  }

  const friends = r.data || [];
  if (!friends.length) {
    list.innerHTML = '<li class="empty">Друзей пока нет — добавь во вкладке «Добавить».</li>';
    return;
  }

  // Combine with listening info
  const live = await send('friendsListening');
  const liveById = {};
  if (live.ok && Array.isArray(live.data)) {
    for (const item of live.data) liveById[item.user.id] = item;
  }

  list.innerHTML = '';
  for (const u of friends) {
    const item = liveById[u.id] || { track: { is_live: false, title: null } };
    const sub = item.track && item.track.is_live && item.track.title
      ? `♪ ${item.track.title}${item.track.artist ? ' — ' + item.track.artist : ''}`
      : 'не в сети';

    list.appendChild(el('li', { class: 'item' },
      avatarNode(u),
      el('div', {},
        el('div', { class: 'name' }, '@' + u.username),
        el('div', { class: 'sub' }, sub),
      ),
      el('div', { class: 'actions' },
        el('button', {
          class: 'decline', title: 'Удалить из друзей',
          onclick: () => removeFriend(u),
        }, '×'),
      ),
    ));
  }
}

async function removeFriend(u) {
  if (!confirm(`Удалить @${u.username} из друзей?`)) return;
  const r = await send('removeFriend', { userId: u.id });
  if (!r.ok) return showToast(r.error || 'не получилось', 'error');
  showToast('Удалено');
  loadFriends();
}

// --------------------------------------------------------------------- //
// Requests                                                              //
// --------------------------------------------------------------------- //

async function loadRequests() {
  const incomingList = $('#incoming-list');
  const outgoingList = $('#outgoing-list');
  incomingList.innerHTML = '<li class="empty">Загрузка…</li>';
  outgoingList.innerHTML = '<li class="empty">Загрузка…</li>';

  const cfg = await send('getConfig');
  if (!cfg.ok || !cfg.data || !cfg.data.token) {
    incomingList.innerHTML = '<li class="empty">Сначала зарегистрируйся.</li>';
    outgoingList.innerHTML = '';
    return;
  }

  const [incoming, outgoing] = await Promise.all([
    send('incomingRequests'),
    send('outgoingRequests'),
  ]);

  renderRequestList(incomingList, incoming, 'incoming');
  renderRequestList(outgoingList, outgoing, 'outgoing');
  updateBadge(incoming.ok ? (incoming.data || []).length : 0);
}

function renderRequestList(listEl, resp, kind) {
  listEl.innerHTML = '';
  if (!resp.ok) {
    listEl.appendChild(el('li', { class: 'empty' }, resp.error || 'ошибка'));
    return;
  }
  const items = resp.data || [];
  if (!items.length) {
    listEl.appendChild(el('li', { class: 'empty' },
      kind === 'incoming' ? 'Заявок нет.' : 'Ничего не отправлено.',
    ));
    return;
  }
  for (const r of items) {
    const u = r.user;
    const date = new Date(r.created_at * 1000).toLocaleString();
    listEl.appendChild(el('li', { class: 'item' },
      avatarNode(u),
      el('div', {},
        el('div', { class: 'name' }, '@' + u.username),
        el('div', { class: 'sub' }, date),
      ),
      kind === 'incoming'
        ? el('div', { class: 'actions' },
            el('button', { class: 'accept', onclick: () => actOnRequest(r.id, 'acceptRequest') }, 'Принять'),
            el('button', { class: 'decline', onclick: () => actOnRequest(r.id, 'declineRequest') }, 'Отклонить'),
          )
        : el('div', { class: 'actions' },
            el('button', { class: 'cancel', onclick: () => actOnRequest(r.id, 'cancelRequest') }, 'Отменить'),
          ),
    ));
  }
}

async function actOnRequest(requestId, kind) {
  const r = await send(kind, { requestId });
  if (!r.ok) return showToast(r.error || 'не получилось', 'error');
  showToast('Готово');
  loadRequests();
  loadFriends();
}

function updateBadge(n) {
  const badge = $('#req-badge');
  if (!n) {
    badge.hidden = true;
    badge.textContent = '0';
  } else {
    badge.hidden = false;
    badge.textContent = String(n);
  }
}

// --------------------------------------------------------------------- //
// Add friend / search                                                   //
// --------------------------------------------------------------------- //

const addInput = $('#add-input');
const searchResults = $('#search-results');
let searchTimer = null;

addInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, 220);
});

async function runSearch() {
  const q = addInput.value.trim();
  searchResults.innerHTML = '';
  if (q.length < 2) return;
  const r = await send('searchUsers', { q });
  if (!r.ok) {
    searchResults.appendChild(el('div', { class: 'empty' }, r.error || 'ошибка'));
    return;
  }
  const items = r.data || [];
  if (!items.length) {
    searchResults.appendChild(el('div', { class: 'empty' }, 'Никого не нашли.'));
    return;
  }
  for (const u of items) {
    searchResults.appendChild(el('div', { class: 'item' },
      avatarNode(u),
      el('div', {}, el('div', { class: 'name' }, '@' + u.username)),
      el('div', { class: 'actions' },
        el('button', {
          class: 'accept',
          onclick: () => sendRequestByUsername(u.username),
        }, 'Заявка'),
      ),
    ));
  }
}

$('#add-submit').addEventListener('click', () => {
  const q = addInput.value.trim();
  if (q.length < 2) return showToast('Введи ник', 'error');
  sendRequestByUsername(q);
});

async function sendRequestByUsername(username) {
  const r = await send('sendRequest', { username });
  if (!r.ok) return showToast(r.error || 'не получилось', 'error');
  if (r.data && r.data.auto_accepted) {
    showToast(`Вы уже друзья с @${username}`);
  } else {
    showToast(`Заявка отправлена @${username}`);
  }
  addInput.value = '';
  searchResults.innerHTML = '';
  loadRequests();
  loadFriends();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// --------------------------------------------------------------------- //
// Init                                                                  //
// --------------------------------------------------------------------- //

(async function init() {
  await refreshHeader();
  await loadSettings();
  await loadFriends();
  // pre-fetch requests so the badge is right immediately
  const incoming = await send('incomingRequests');
  if (incoming.ok) updateBadge((incoming.data || []).length);
})();
