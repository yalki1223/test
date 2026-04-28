/* Twitch Custom Themes — theme engine
 * Pure functions for converting a theme JSON into CSS + DOM tweaks.
 * Loaded both in content script and (as a module-like global) in the popup
 * for live preview purposes.
 */
(function (global) {
  'use strict';

  const PAGE_BG_ID = 'twitch-themes-page-bg';
  const CHAT_BG_ID = 'twitch-themes-chat-bg';
  const STYLE_ID = 'twitch-themes-style';

  /** Default empty layer used for background controls. */
  function makeEmptyLayer() {
    return {
      enabled: false,
      type: 'color', // 'color' | 'gradient' | 'image'
      color: 'transparent',
      gradient: '',
      image: '',
      size: 'cover',
      position: 'center center',
      repeat: 'no-repeat',
      blur: 0,
      opacity: 1,
      offsetX: 0,
      offsetY: 0,
      scale: 100,
      tintColor: '',
      tintOpacity: 0
    };
  }

  function makeEmptyTheme() {
    return {
      id: 'custom-' + Date.now(),
      name: 'Моя тема',
      category: 'custom',
      author: 'me',
      vars: {},
      pageBackground: makeEmptyLayer(),
      chatBackground: makeEmptyLayer(),
      sidebarBackground: makeEmptyLayer(),
      topbarBackground: makeEmptyLayer(),
      chat: {
        messageBgColor: '',
        messageOpacity: 1,
        fontFamily: '',
        fontSize: 0,
        textColor: '',
        borderRadius: 0,
        outline: false
      },
      effects: {
        accent: '',
        chatGlow: false,
        roundedUI: false
      },
      customCSS: ''
    };
  }

  function escapeCSSValue(v) {
    if (v == null) return '';
    return String(v).replace(/[\r\n]/g, ' ');
  }

  function layerToBackgroundCSS(layer) {
    if (!layer || !layer.enabled) return '';
    const parts = [];
    if (layer.type === 'image' && layer.image) {
      parts.push(`background-image: url("${escapeCSSValue(layer.image)}") !important;`);
      parts.push(`background-size: ${escapeCSSValue(layer.size || 'cover')} !important;`);
      const pos =
        (layer.position || 'center center') +
        (layer.offsetX || layer.offsetY
          ? ''
          : '');
      parts.push(`background-position: ${escapeCSSValue(pos)} !important;`);
      parts.push(`background-repeat: ${escapeCSSValue(layer.repeat || 'no-repeat')} !important;`);
      parts.push(`background-attachment: fixed !important;`);
    } else if (layer.type === 'gradient' && layer.gradient) {
      parts.push(`background: ${escapeCSSValue(layer.gradient)} !important;`);
    } else if (layer.type === 'color' && layer.color) {
      parts.push(`background-color: ${escapeCSSValue(layer.color)} !important;`);
    }
    if (typeof layer.opacity === 'number' && layer.opacity < 1) {
      parts.push(`opacity: ${layer.opacity} !important;`);
    }
    if (layer.blur && layer.blur > 0) {
      parts.push(`filter: blur(${Number(layer.blur)}px) !important;`);
    }
    return parts.join(' ');
  }

  /** Build full CSS string for the given theme. */
  function buildCSS(theme) {
    if (!theme) return '';
    const t = theme;
    const lines = [];

    // CSS variable overrides on :root (Twitch reads them via custom properties).
    if (t.vars && Object.keys(t.vars).length > 0) {
      const vars = Object.entries(t.vars)
        .map(([k, v]) => `  ${k}: ${escapeCSSValue(v)} !important;`)
        .join('\n');
      lines.push(`:root, html, body, .tw-root--theme-dark, .tw-root--theme-light {\n${vars}\n}`);
    }

    // Make sure html/body background is transparent so our overlay shows through.
    if (t.pageBackground && t.pageBackground.enabled) {
      lines.push(
        `html, body { background: transparent !important; }
         .root-scrollable, [data-a-target="root-scroller"], .twilight-root, #root {
           background: transparent !important;
         }`
      );
    }

    // Chat background — applied via overlay element styled below + transparent
    // chat surfaces so it's visible.
    if (t.chatBackground && t.chatBackground.enabled) {
      lines.push(
        `.chat-room,
         .chat-room__content,
         .chat-list,
         .chat-list--default,
         .chat-list__list-container,
         .chat-shell,
         .chat-shell__expanded,
         .channel-root__right-column,
         section[data-test-selector="chat-room-component-layout"],
         .stream-chat,
         .stream-chat-header,
         .chat-input,
         .chat-input__textarea,
         .chat-scrollable-area__message-container {
           background: transparent !important;
         }`
      );
    }

    // Apply backgrounds to overlays via id selectors.
    const pageBgCSS = layerToBackgroundCSS(t.pageBackground);
    if (pageBgCSS) {
      lines.push(`#${PAGE_BG_ID} { ${pageBgCSS} }`);
    }
    const chatBgCSS = layerToBackgroundCSS(t.chatBackground);
    if (chatBgCSS) {
      lines.push(`#${CHAT_BG_ID} { ${chatBgCSS} }`);
    }

    // Sidebar background overrides.
    if (t.sidebarBackground && t.sidebarBackground.enabled) {
      const css = layerToBackgroundCSS(t.sidebarBackground);
      lines.push(
        `.side-nav, .side-nav-section, .side-bar-contents,
         [data-a-target="side-nav-bar"], nav.side-nav { ${css} }`
      );
    }
    if (t.topbarBackground && t.topbarBackground.enabled) {
      const css = layerToBackgroundCSS(t.topbarBackground);
      lines.push(
        `.top-nav, .top-nav__menu, [data-a-target="top-nav"], nav.top-nav,
         .top-nav__container { ${css} }`
      );
    }

    // Chat message styling.
    const c = t.chat || {};
    const chatRules = [];
    if (c.messageBgColor) {
      chatRules.push(
        `.chat-line__message, .chat-line__message--with-mention,
         .chat-line__status, .vod-message {
           background-color: ${escapeCSSValue(c.messageBgColor)} !important;
           border-radius: ${Number(c.borderRadius) || 0}px !important;
           padding: 4px 6px !important;
           margin: 2px 0 !important;
         }`
      );
    } else if (c.borderRadius) {
      chatRules.push(
        `.chat-line__message { border-radius: ${Number(c.borderRadius)}px !important; padding: 2px 6px !important; }`
      );
    }
    if (c.fontSize) {
      chatRules.push(
        `.chat-line__message, .chat-scrollable-area__message-container,
         .chat-line__username, .text-fragment {
           font-size: ${Number(c.fontSize)}px !important;
         }`
      );
    }
    if (c.fontFamily) {
      chatRules.push(
        `.chat-line__message, .chat-scrollable-area__message-container,
         .chat-line__username, .text-fragment {
           font-family: ${escapeCSSValue(c.fontFamily)} !important;
         }`
      );
    }
    if (c.textColor) {
      chatRules.push(
        `.chat-line__message, .text-fragment, .chat-line__message--emote-button { color: ${escapeCSSValue(c.textColor)} !important; }`
      );
    }
    if (c.outline) {
      chatRules.push(
        `.chat-line__message {
           text-shadow:
             -1px -1px 0 #000, 1px -1px 0 #000,
             -1px 1px 0 #000, 1px 1px 0 #000 !important;
         }`
      );
    }
    if (chatRules.length) lines.push(chatRules.join('\n'));

    // Effects.
    const fx = t.effects || {};
    if (fx.accent) {
      lines.push(
        `:root { --ext-accent: ${escapeCSSValue(fx.accent)} !important; }
         .tw-core-button-primary, .ScCoreButton-sc-ocjdkq-0[data-test-selector="follow-button"],
         button[data-a-target="follow-button"], button[data-test-selector="subscribe-button"] {
           background: ${escapeCSSValue(fx.accent)} !important;
           border-color: ${escapeCSSValue(fx.accent)} !important;
         }
         a, .tw-link, [data-test-selector="channel-name"] { color: ${escapeCSSValue(fx.accent)} !important; }`
      );
    }
    if (fx.chatGlow) {
      lines.push(
        `.chat-line__message {
           box-shadow: 0 0 8px var(--ext-accent, #9147ff) !important;
         }`
      );
    }
    if (fx.roundedUI) {
      lines.push(
        `button, .tw-button, .tw-core-button, input, .tw-input,
         .video-player, .channel-info-content, .chat-input__textarea {
           border-radius: 12px !important;
         }`
      );
    }

    // Custom user CSS escape hatch.
    if (t.customCSS) lines.push(t.customCSS);

    return lines.join('\n\n');
  }

  /** Apply the theme to the current page (only valid in content scripts). */
  function applyTheme(theme) {
    const doc = document;
    if (!doc || !doc.documentElement) return;

    let style = doc.getElementById(STYLE_ID);
    if (!style) {
      style = doc.createElement('style');
      style.id = STYLE_ID;
      (doc.head || doc.documentElement).appendChild(style);
    }
    style.textContent = buildCSS(theme);

    // Page background overlay.
    let pageBg = doc.getElementById(PAGE_BG_ID);
    if (theme && theme.pageBackground && theme.pageBackground.enabled) {
      if (!pageBg) {
        pageBg = doc.createElement('div');
        pageBg.id = PAGE_BG_ID;
        Object.assign(pageBg.style, {
          position: 'fixed',
          inset: '0',
          width: '100vw',
          height: '100vh',
          zIndex: '-2',
          pointerEvents: 'none'
        });
        (doc.body || doc.documentElement).appendChild(pageBg);
      }
    } else if (pageBg) {
      pageBg.remove();
    }

    // Chat background overlay — append into chat container when found.
    function placeChatBg() {
      const chat = doc.querySelector(
        '.chat-shell, .channel-root__right-column, section[data-test-selector="chat-room-component-layout"], .chat-room'
      );
      let chatBg = doc.getElementById(CHAT_BG_ID);
      if (theme && theme.chatBackground && theme.chatBackground.enabled && chat) {
        if (!chatBg) {
          chatBg = doc.createElement('div');
          chatBg.id = CHAT_BG_ID;
          Object.assign(chatBg.style, {
            position: 'absolute',
            inset: '0',
            zIndex: '0',
            pointerEvents: 'none'
          });
        }
        if (getComputedStyle(chat).position === 'static') {
          chat.style.position = 'relative';
        }
        if (chatBg.parentElement !== chat) chat.prepend(chatBg);
      } else if (chatBg) {
        chatBg.remove();
      }
    }
    placeChatBg();
    // Re-place when SPA navigation changes the chat container.
    if (!global.__twitchThemesObserver) {
      try {
        const obs = new MutationObserver(() => {
          // Throttle work.
          if (global.__twitchThemesPlaceTO) return;
          global.__twitchThemesPlaceTO = setTimeout(() => {
            global.__twitchThemesPlaceTO = null;
            const cur = global.__twitchThemesCurrent;
            if (cur) placeChatBg();
          }, 250);
        });
        obs.observe(doc.documentElement, { childList: true, subtree: true });
        global.__twitchThemesObserver = obs;
      } catch (_) {}
    }
    global.__twitchThemesCurrent = theme;
  }

  function clearTheme() {
    [PAGE_BG_ID, CHAT_BG_ID, STYLE_ID].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
    global.__twitchThemesCurrent = null;
  }

  global.TwitchThemesEngine = {
    PAGE_BG_ID,
    CHAT_BG_ID,
    STYLE_ID,
    buildCSS,
    applyTheme,
    clearTheme,
    makeEmptyLayer,
    makeEmptyTheme,
    layerToBackgroundCSS
  };
})(typeof window !== 'undefined' ? window : globalThis);
