/* Twitch Custom Themes — content script
 * Loads the active theme on Twitch pages and listens for live preview / apply
 * messages from the popup.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'tt:active';
  const CUSTOM_KEY = 'tt:customs';

  function loadActive() {
    chrome.storage.local.get([STORAGE_KEY, CUSTOM_KEY], (data) => {
      const active = data[STORAGE_KEY];
      if (!active) return; // nothing applied yet
      const theme = resolveTheme(active, data[CUSTOM_KEY] || []);
      if (theme) window.TwitchThemesEngine.applyTheme(theme);
    });
  }

  function resolveTheme(active, customs) {
    if (!active) return null;
    if (active.kind === 'preset') {
      return window.TwitchThemesPresets.byId(active.id);
    }
    if (active.kind === 'custom') {
      return (customs || []).find((c) => c.id === active.id) || null;
    }
    if (active.kind === 'inline' && active.theme) {
      return active.theme;
    }
    return null;
  }

  // Listen for live preview / apply / clear from popup.
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || !msg.type) return;
    try {
      switch (msg.type) {
        case 'tt:preview':
          if (msg.theme) window.TwitchThemesEngine.applyTheme(msg.theme);
          sendResponse({ ok: true });
          break;
        case 'tt:clear-preview':
          loadActive();
          sendResponse({ ok: true });
          break;
        case 'tt:clear':
          window.TwitchThemesEngine.clearTheme();
          sendResponse({ ok: true });
          break;
        case 'tt:apply':
          loadActive();
          sendResponse({ ok: true });
          break;
        case 'tt:ping':
          sendResponse({ ok: true, pong: true });
          break;
      }
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
    return true;
  });

  // Re-apply when storage changes (e.g. user picks new theme in popup).
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[STORAGE_KEY] || changes[CUSTOM_KEY]) loadActive();
  });

  // Initial load (DOM may not be ready yet at document_start, but engine
  // tolerates this; it appends to documentElement until body exists).
  loadActive();
  document.addEventListener('DOMContentLoaded', loadActive, { once: true });
})();
