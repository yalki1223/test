/**
 * Background service worker for the SoundCloud Friends Listening extension.
 *
 * Responsibilities:
 *  - Centralised API client (so popup and content script don't duplicate fetch logic).
 *  - Periodic poll of the friends-listening feed, broadcast to the active SoundCloud tab.
 *  - Periodic poll of incoming friend requests, badge counter on the toolbar icon.
 *  - Handle requests from the content script / popup via chrome.runtime.onMessage.
 */

const DEFAULTS = {
  serverUrl: 'http://127.0.0.1:8765',
  username: '',
  token: '',
  userId: 0,
};

const POLL_FRIENDS_MS = 15_000;
const POLL_REQUESTS_MS = 30_000;

// ---------------------------------------------------------------------- //
// Storage helpers                                                        //
// ---------------------------------------------------------------------- //

async function getConfig() {
  const stored = await chrome.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...stored };
}

async function setConfig(patch) {
  await chrome.storage.local.set(patch);
}

// ---------------------------------------------------------------------- //
// API client                                                             //
// ---------------------------------------------------------------------- //

async function api(path, { method = 'GET', body, auth = true } = {}) {
  const cfg = await getConfig();
  const base = (cfg.serverUrl || DEFAULTS.serverUrl).replace(/\/+$/, '');
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    if (!cfg.token) {
      const err = new Error('Не зарегистрирован — задай ник в настройках.');
      err.code = 'NO_TOKEN';
      throw err;
    }
    headers['X-User-Token'] = cfg.token;
  }
  let res;
  try {
    res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    const err = new Error(`Сервер недоступен: ${cfg.serverUrl}`);
    err.code = 'NETWORK';
    throw err;
  }
  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const j = await res.json();
      if (j && j.detail) detail = j.detail;
    } catch (_) { /* ignore */ }
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

// ---------------------------------------------------------------------- //
// Message router                                                         //
// ---------------------------------------------------------------------- //

const HANDLERS = {
  async getConfig() {
    return await getConfig();
  },

  async setServerUrl({ serverUrl }) {
    await setConfig({ serverUrl: (serverUrl || '').trim() });
    return { ok: true };
  },

  async register({ username }) {
    const cfg = await getConfig();
    const base = (cfg.serverUrl || DEFAULTS.serverUrl).replace(/\/+$/, '');
    const res = await fetch(`${base}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    if (!res.ok) {
      let detail = `${res.status}`;
      try { detail = (await res.json()).detail || detail; } catch (_) {}
      throw new Error(detail);
    }
    const j = await res.json();
    await setConfig({ username: j.username, token: j.token, userId: j.user_id });
    schedulePolls(true);
    return j;
  },

  async logout() {
    await setConfig({ username: '', token: '', userId: 0 });
    chrome.action.setBadgeText({ text: '' });
    broadcastToContent({ type: 'config_changed' });
    return { ok: true };
  },

  async pushStatus(payload) {
    return await api('/api/status', { method: 'POST', body: payload });
  },

  async friendsListening() {
    return await api('/api/friends/listening');
  },

  async listFriends() {
    return await api('/api/friends');
  },

  async incomingRequests() {
    return await api('/api/friends/requests/incoming');
  },

  async outgoingRequests() {
    return await api('/api/friends/requests/outgoing');
  },

  async sendRequest({ username }) {
    return await api('/api/friends/request', { method: 'POST', body: { username } });
  },

  async acceptRequest({ requestId }) {
    return await api('/api/friends/requests/accept', {
      method: 'POST', body: { request_id: requestId },
    });
  },

  async declineRequest({ requestId }) {
    return await api('/api/friends/requests/decline', {
      method: 'POST', body: { request_id: requestId },
    });
  },

  async cancelRequest({ requestId }) {
    return await api('/api/friends/requests/cancel', {
      method: 'POST', body: { request_id: requestId },
    });
  },

  async removeFriend({ userId }) {
    return await api('/api/friends/remove', {
      method: 'POST', body: { user_id: userId },
    });
  },

  async searchUsers({ q }) {
    return await api(`/api/users/search?q=${encodeURIComponent(q)}`);
  },

  async openPopup() {
    // chrome.action.openPopup() requires either a user gesture in MV3 or
    // policy permission. We try it; on failure we fall back to a notification
    // toast in the content script.
    try {
      await chrome.action.openPopup();
      return { ok: true };
    } catch (_) {
      return { ok: false, reason: 'click_extension_icon' };
    }
  },
};

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const fn = HANDLERS[msg && msg.type];
  if (!fn) {
    sendResponse({ ok: false, error: `Unknown message: ${msg && msg.type}` });
    return false;
  }
  Promise.resolve(fn(msg.payload || {}))
    .then((data) => sendResponse({ ok: true, data }))
    .catch((err) => sendResponse({ ok: false, error: err.message || String(err), code: err.code, status: err.status }));
  return true; // keep channel open for async response
});

// ---------------------------------------------------------------------- //
// Polling + badge                                                        //
// ---------------------------------------------------------------------- //

async function broadcastToContent(message) {
  const tabs = await chrome.tabs.query({ url: '*://*.soundcloud.com/*' });
  for (const tab of tabs) {
    chrome.tabs.sendMessage(tab.id, message).catch(() => { /* tab may not have content yet */ });
  }
}

async function pollFriends() {
  try {
    const cfg = await getConfig();
    if (!cfg.token) return;
    const list = await api('/api/friends/listening');
    broadcastToContent({ type: 'friends_listening', payload: list });
  } catch (_) {
    // silent — content script will keep last value
  }
}

async function pollRequests() {
  try {
    const cfg = await getConfig();
    if (!cfg.token) {
      chrome.action.setBadgeText({ text: '' });
      return;
    }
    const list = await api('/api/friends/requests/incoming');
    const n = Array.isArray(list) ? list.length : 0;
    chrome.action.setBadgeBackgroundColor({ color: '#ff5500' });
    chrome.action.setBadgeText({ text: n > 0 ? String(n) : '' });
  } catch (_) { /* ignore */ }
}

function schedulePolls(immediate = false) {
  chrome.alarms.clear?.('friends');
  chrome.alarms.clear?.('requests');
  // Use setInterval (service worker stays alive while alarms tick), backed up by alarms.
  if (immediate) {
    pollFriends();
    pollRequests();
  }
}

setInterval(pollFriends, POLL_FRIENDS_MS);
setInterval(pollRequests, POLL_REQUESTS_MS);

chrome.runtime.onInstalled.addListener(() => schedulePolls(true));
chrome.runtime.onStartup?.addListener?.(() => schedulePolls(true));
schedulePolls(true);
