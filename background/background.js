/* Twitch Custom Themes — background service worker
 * Used for cross-context plumbing (e.g. relaying messages, future updates).
 */
chrome.runtime.onInstalled.addListener(() => {
  // Initialize empty custom themes array if missing.
  chrome.storage.local.get(['tt:customs'], (data) => {
    if (!Array.isArray(data['tt:customs'])) {
      chrome.storage.local.set({ 'tt:customs': [] });
    }
  });
});
