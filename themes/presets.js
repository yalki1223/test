/* Twitch Custom Themes — preset library
 * Each preset is a theme JSON understood by lib/theme-engine.js.
 * Structure: { id, name, category, vars, pageBackground, chatBackground, sidebarBackground, topbarBackground, chat, effects, customCSS }
 */
(function (global) {
  'use strict';

  const E = global.TwitchThemesEngine;

  /** Helper: produce a full theme by overriding fields of an empty theme. */
  function mk(overrides) {
    const base = E.makeEmptyTheme();
    Object.keys(overrides || {}).forEach((k) => {
      if (k === 'pageBackground' || k === 'chatBackground' || k === 'sidebarBackground' || k === 'topbarBackground') {
        base[k] = Object.assign(E.makeEmptyLayer(), overrides[k] || {});
      } else if (k === 'chat' || k === 'effects' || k === 'vars') {
        base[k] = Object.assign(base[k] || {}, overrides[k] || {});
      } else {
        base[k] = overrides[k];
      }
    });
    return base;
  }

  /** Build a full set of CSS variables given a small palette. */
  function darkVars(p) {
    return {
      '--color-background-body': p.body,
      '--color-background-base': p.base,
      '--color-background-alt': p.alt,
      '--color-background-alt-2': p.alt2,
      '--color-background-float': p.float || p.alt2,
      '--color-text-base': p.text,
      '--color-text-alt': p.textAlt,
      '--color-text-alt-2': p.text,
      '--color-text-link': p.link,
      '--color-border-base': p.border || p.alt2,
      '--color-border-input': p.border || p.alt2,
      '--color-fill-button-icon': p.text,
      '--color-background-button-primary-default': p.accent,
      '--color-background-button-primary-hover': p.accentHover || p.accent,
      '--color-background-button-primary-active': p.accentHover || p.accent,
      '--color-text-button-primary': '#ffffff'
    };
  }

  function lightVars(p) {
    return {
      '--color-background-body': p.body,
      '--color-background-base': p.base,
      '--color-background-alt': p.alt,
      '--color-background-alt-2': p.alt2,
      '--color-background-float': p.float || p.alt2,
      '--color-text-base': p.text,
      '--color-text-alt': p.textAlt,
      '--color-text-alt-2': p.text,
      '--color-text-link': p.link,
      '--color-border-base': p.border || p.alt2,
      '--color-border-input': p.border || p.alt2,
      '--color-fill-button-icon': p.text,
      '--color-background-button-primary-default': p.accent,
      '--color-background-button-primary-hover': p.accentHover || p.accent,
      '--color-background-button-primary-active': p.accentHover || p.accent,
      '--color-text-button-primary': '#ffffff'
    };
  }

  /* ---------------- DARK PRESETS (10) ---------------- */
  const DARK = [
    mk({
      id: 'dark-twilight',
      name: 'Twilight Purple',
      category: 'dark',
      vars: darkVars({
        body: '#0e0e10', base: '#18181b', alt: '#1f1f23', alt2: '#26262c',
        text: '#efeff1', textAlt: '#adadb8', link: '#bf94ff',
        accent: '#9147ff', accentHover: '#772ce8'
      }),
      effects: { accent: '#9147ff' },
      pageBackground: { enabled: true, type: 'gradient',
        gradient: 'radial-gradient(ellipse at top, #2a1356 0%, #0e0e10 60%)' }
    }),
    mk({
      id: 'dark-midnight',
      name: 'Midnight Ocean',
      category: 'dark',
      vars: darkVars({
        body: '#06121f', base: '#0b1c30', alt: '#13263d', alt2: '#1b3151',
        text: '#dbe9f7', textAlt: '#92aac4', link: '#5ab7ff',
        accent: '#1f6feb', accentHover: '#388bfd'
      }),
      effects: { accent: '#5ab7ff' },
      pageBackground: { enabled: true, type: 'gradient',
        gradient: 'linear-gradient(180deg, #061a2c 0%, #0b1c30 100%)' }
    }),
    mk({
      id: 'dark-forest',
      name: 'Forest Night',
      category: 'dark',
      vars: darkVars({
        body: '#0c1410', base: '#10211a', alt: '#152e23', alt2: '#1c3a2c',
        text: '#dff5e4', textAlt: '#9bbfa6', link: '#7ee787',
        accent: '#2ea043', accentHover: '#3fb950'
      }),
      effects: { accent: '#7ee787' },
      pageBackground: { enabled: true, type: 'gradient',
        gradient: 'radial-gradient(ellipse at bottom, #1a3a2a 0%, #0c1410 70%)' }
    }),
    mk({
      id: 'dark-cherry',
      name: 'Cherry Blossom Night',
      category: 'dark',
      vars: darkVars({
        body: '#1a0f15', base: '#241620', alt: '#321b29', alt2: '#3f2233',
        text: '#fce4ee', textAlt: '#cda3b7', link: '#ff8ab9',
        accent: '#ff4d8d', accentHover: '#ff66a1'
      }),
      effects: { accent: '#ff8ab9' },
      pageBackground: { enabled: true, type: 'gradient',
        gradient: 'linear-gradient(135deg, #2a0f1f 0%, #1a0f15 100%)' }
    }),
    mk({
      id: 'dark-cyberpunk',
      name: 'Cyberpunk Neon',
      category: 'dark',
      vars: darkVars({
        body: '#0a0014', base: '#10061f', alt: '#1a0a30', alt2: '#270d44',
        text: '#f0e9ff', textAlt: '#c9b8ff', link: '#00f0ff',
        accent: '#ff00aa', accentHover: '#ff3dbb'
      }),
      effects: { accent: '#00f0ff', chatGlow: true, roundedUI: true },
      pageBackground: { enabled: true, type: 'gradient',
        gradient: 'linear-gradient(135deg, #150024 0%, #0a0014 50%, #001a26 100%)' }
    }),
    mk({
      id: 'dark-volcanic',
      name: 'Volcanic Red',
      category: 'dark',
      vars: darkVars({
        body: '#140707', base: '#1f0a0a', alt: '#2c0e0e', alt2: '#3a1313',
        text: '#fdeaea', textAlt: '#d6a3a3', link: '#ff7b54',
        accent: '#ff4d2e', accentHover: '#ff6b4d'
      }),
      effects: { accent: '#ff7b54' },
      pageBackground: { enabled: true, type: 'gradient',
        gradient: 'radial-gradient(ellipse at top, #4a1010 0%, #140707 70%)' }
    }),
    mk({
      id: 'dark-synthwave',
      name: 'Synthwave',
      category: 'dark',
      vars: darkVars({
        body: '#0c0420', base: '#170733', alt: '#21094a', alt2: '#310b66',
        text: '#ffe6ff', textAlt: '#c5a3ff', link: '#ff5dc8',
        accent: '#ff36c8', accentHover: '#ff6dd8'
      }),
      effects: { accent: '#ff36c8', chatGlow: true, roundedUI: true },
      pageBackground: { enabled: true, type: 'gradient',
        gradient: 'linear-gradient(180deg, #2a0d4d 0%, #ff36c8 200%)' }
    }),
    mk({
      id: 'dark-matrix',
      name: 'Matrix',
      category: 'dark',
      vars: darkVars({
        body: '#000000', base: '#040d04', alt: '#08160a', alt2: '#0c2010',
        text: '#a8ff9c', textAlt: '#5dca5d', link: '#39ff14',
        accent: '#39ff14', accentHover: '#5fff3d'
      }),
      effects: { accent: '#39ff14' },
      pageBackground: { enabled: true, type: 'color', color: '#000000' },
      chat: { fontFamily: '"Fira Code", "Courier New", monospace', textColor: '#a8ff9c' }
    }),
    mk({
      id: 'dark-royal',
      name: 'Royal Gold',
      category: 'dark',
      vars: darkVars({
        body: '#0a0a0a', base: '#141414', alt: '#1a1a1a', alt2: '#262626',
        text: '#f7e9c2', textAlt: '#caa765', link: '#ffd24a',
        accent: '#d4af37', accentHover: '#e6c34a',
        border: '#3a2f10'
      }),
      effects: { accent: '#d4af37', roundedUI: true },
      pageBackground: { enabled: true, type: 'gradient',
        gradient: 'radial-gradient(ellipse at center, #1a1407 0%, #0a0a0a 70%)' }
    }),
    mk({
      id: 'dark-space',
      name: 'Deep Space',
      category: 'dark',
      vars: darkVars({
        body: '#03020c', base: '#0a081a', alt: '#120f29', alt2: '#1c1740',
        text: '#e6e2ff', textAlt: '#9b94d4', link: '#9b8cff',
        accent: '#5b3df5', accentHover: '#7c63f7'
      }),
      effects: { accent: '#9b8cff' },
      pageBackground: { enabled: true, type: 'gradient',
        gradient: 'radial-gradient(ellipse at 30% 20%, #1a0f4d 0%, #03020c 70%)' }
    })
  ];

  /* ---------------- LIGHT PRESETS (10) ---------------- */
  const LIGHT = [
    mk({
      id: 'light-pure',
      name: 'Pure White',
      category: 'light',
      vars: lightVars({
        body: '#ffffff', base: '#f7f7f8', alt: '#efeff1', alt2: '#e5e5e8',
        text: '#0e0e10', textAlt: '#53535f', link: '#9147ff',
        accent: '#9147ff', accentHover: '#772ce8',
        border: '#dcdce0'
      }),
      effects: { accent: '#9147ff' },
      pageBackground: { enabled: true, type: 'color', color: '#ffffff' }
    }),
    mk({
      id: 'light-pastel',
      name: 'Soft Pastel Pink',
      category: 'light',
      vars: lightVars({
        body: '#fff0f5', base: '#ffe4ee', alt: '#ffd6e5', alt2: '#ffc1d6',
        text: '#5a1a36', textAlt: '#9a4f72', link: '#d23a7c',
        accent: '#ff5fa2', accentHover: '#ff7eb5'
      }),
      pageBackground: { enabled: true, type: 'gradient',
        gradient: 'linear-gradient(180deg, #ffe4ee 0%, #fff0f5 100%)' }
    }),
    mk({
      id: 'light-mint',
      name: 'Mint Fresh',
      category: 'light',
      vars: lightVars({
        body: '#eefdf6', base: '#dcfaee', alt: '#c6f5e1', alt2: '#a8edcc',
        text: '#10402b', textAlt: '#3f7a5a', link: '#0fa86c',
        accent: '#1ec587', accentHover: '#3ed29a'
      }),
      pageBackground: { enabled: true, type: 'gradient',
        gradient: 'linear-gradient(135deg, #dcfaee 0%, #eefdf6 100%)' }
    }),
    mk({
      id: 'light-sky',
      name: 'Sky Blue',
      category: 'light',
      vars: lightVars({
        body: '#f0f8ff', base: '#dcefff', alt: '#c6e3ff', alt2: '#a8d4ff',
        text: '#0e2c4d', textAlt: '#3a5d85', link: '#1f6feb',
        accent: '#1f8fff', accentHover: '#3da5ff'
      }),
      pageBackground: { enabled: true, type: 'gradient',
        gradient: 'linear-gradient(180deg, #c6e3ff 0%, #f0f8ff 100%)' }
    }),
    mk({
      id: 'light-cream',
      name: 'Cream Latte',
      category: 'light',
      vars: lightVars({
        body: '#fbf3e4', base: '#f3e7cd', alt: '#ead7b3', alt2: '#dfc18e',
        text: '#3b2614', textAlt: '#6f4e2c', link: '#a05a16',
        accent: '#c8772a', accentHover: '#d68940'
      }),
      pageBackground: { enabled: true, type: 'gradient',
        gradient: 'linear-gradient(135deg, #f3e7cd 0%, #fbf3e4 100%)' }
    }),
    mk({
      id: 'light-lavender',
      name: 'Lavender Dream',
      category: 'light',
      vars: lightVars({
        body: '#f4f0ff', base: '#e6dcff', alt: '#d6c6ff', alt2: '#bfa6ff',
        text: '#2d1d5a', textAlt: '#5c478f', link: '#7c3aed',
        accent: '#8b5cf6', accentHover: '#a07cff'
      }),
      pageBackground: { enabled: true, type: 'gradient',
        gradient: 'linear-gradient(135deg, #e6dcff 0%, #f4f0ff 100%)' }
    }),
    mk({
      id: 'light-peach',
      name: 'Peach Sunset',
      category: 'light',
      vars: lightVars({
        body: '#fff2e6', base: '#ffe2c8', alt: '#ffd0a8', alt2: '#ffba85',
        text: '#4d260a', textAlt: '#8a5024', link: '#d75f1e',
        accent: '#ff7a3d', accentHover: '#ff955f'
      }),
      pageBackground: { enabled: true, type: 'gradient',
        gradient: 'linear-gradient(135deg, #ffba85 0%, #fff2e6 100%)' }
    }),
    mk({
      id: 'light-paper',
      name: 'Paper',
      category: 'light',
      vars: lightVars({
        body: '#faf7f0', base: '#f1ebdc', alt: '#e6dec9', alt2: '#d8cdb1',
        text: '#2a261c', textAlt: '#5d5340', link: '#5b3a17',
        accent: '#7a4f1f', accentHover: '#946335'
      }),
      pageBackground: { enabled: true, type: 'color', color: '#faf7f0' }
    }),
    mk({
      id: 'light-arctic',
      name: 'Arctic Cool',
      category: 'light',
      vars: lightVars({
        body: '#eef7fb', base: '#dceff5', alt: '#c4e4ee', alt2: '#a4d4e3',
        text: '#0d3445', textAlt: '#3a6b80', link: '#0a8aaf',
        accent: '#2bb7d4', accentHover: '#48c5dd'
      }),
      pageBackground: { enabled: true, type: 'gradient',
        gradient: 'linear-gradient(180deg, #c4e4ee 0%, #eef7fb 100%)' }
    }),
    mk({
      id: 'light-rosegold',
      name: 'Rose Gold',
      category: 'light',
      vars: lightVars({
        body: '#fdf1eb', base: '#f8dcd0', alt: '#f0c5b3', alt2: '#e6a98f',
        text: '#3f201a', textAlt: '#7d4839', link: '#c25b3a',
        accent: '#d97a59', accentHover: '#e08e6f'
      }),
      pageBackground: { enabled: true, type: 'gradient',
        gradient: 'linear-gradient(135deg, #e6a98f 0%, #fdf1eb 100%)' }
    })
  ];

  /* ---------------- SPECIAL PRESETS ---------------- */
  const SPECIAL = [
    mk({
      id: 'special-glass',
      name: 'Glassmorphism',
      category: 'special',
      vars: darkVars({
        body: '#0a0a14', base: 'rgba(20,20,30,0.55)', alt: 'rgba(30,30,45,0.55)',
        alt2: 'rgba(40,40,60,0.55)', text: '#f0f0ff', textAlt: '#b0b0d0',
        link: '#a78bfa', accent: '#7c3aed', accentHover: '#9461f5'
      }),
      effects: { accent: '#a78bfa', roundedUI: true },
      pageBackground: { enabled: true, type: 'gradient',
        gradient: 'linear-gradient(135deg, #5b21b6 0%, #1e293b 50%, #0e7490 100%)' },
      chatBackground: { enabled: true, type: 'color', color: 'rgba(20,20,40,0.35)' },
      customCSS: `
        .chat-line__message,
        .chat-room, .chat-room__content, .stream-chat,
        .top-nav, .side-nav,
        .channel-info-content, .home-discovery {
          backdrop-filter: blur(14px) saturate(180%) !important;
          -webkit-backdrop-filter: blur(14px) saturate(180%) !important;
          background-color: rgba(20,20,40,0.35) !important;
          border: 1px solid rgba(255,255,255,0.08) !important;
        }
      `
    }),
    mk({
      id: 'special-rgb',
      name: 'RGB Rainbow',
      category: 'special',
      vars: darkVars({
        body: '#0a0a0a', base: '#141414', alt: '#1c1c1c', alt2: '#262626',
        text: '#ffffff', textAlt: '#cccccc', link: '#ff00ea',
        accent: '#ff00aa', accentHover: '#ff36c8'
      }),
      effects: { accent: '#ff00ea', chatGlow: true, roundedUI: true },
      pageBackground: { enabled: true, type: 'gradient',
        gradient: 'linear-gradient(135deg, #ff0080, #ff8c00, #ffd900, #00d8ff, #8a2be2, #ff0080)' },
      customCSS: `
        @keyframes ext-rgb-bg {
          0% { filter: hue-rotate(0deg); }
          100% { filter: hue-rotate(360deg); }
        }
        #twitch-themes-page-bg { animation: ext-rgb-bg 12s linear infinite; background-size: 400% 400% !important; }
        .chat-line__username { animation: ext-rgb-bg 6s linear infinite; }
      `
    }),
    mk({
      id: 'special-crt',
      name: 'Retro CRT',
      category: 'special',
      vars: darkVars({
        body: '#020602', base: '#062006', alt: '#093009', alt2: '#0c4810',
        text: '#7dff7d', textAlt: '#3fc23f', link: '#a8ffa8',
        accent: '#22c022', accentHover: '#33d033'
      }),
      effects: { accent: '#7dff7d' },
      pageBackground: { enabled: true, type: 'color', color: '#020602' },
      chat: { fontFamily: '"VT323","Courier New",monospace', textColor: '#7dff7d', outline: false },
      customCSS: `
        body, .chat-line__message {
          text-shadow: 0 0 4px #7dff7d, 0 0 8px #2bff2b !important;
        }
        body::after {
          content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 9999;
          background: repeating-linear-gradient(
            to bottom, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px,
            transparent 1px, transparent 3px);
        }
      `
    }),
    mk({
      id: 'special-sakura',
      name: 'Anime Sakura',
      category: 'special',
      vars: darkVars({
        body: '#1a0a14', base: '#2a0f1f', alt: '#3d1530', alt2: '#521b3f',
        text: '#ffe1ee', textAlt: '#ffb1d0', link: '#ff7eb9',
        accent: '#ff5dac', accentHover: '#ff7ebd'
      }),
      effects: { accent: '#ff5dac', roundedUI: true },
      pageBackground: { enabled: true, type: 'gradient',
        gradient: 'linear-gradient(180deg, #4d1638 0%, #1a0a14 70%)' },
      chatBackground: { enabled: true, type: 'gradient',
        gradient: 'linear-gradient(180deg, rgba(80,15,50,0.6), rgba(20,5,15,0.6))' }
    }),
    mk({
      id: 'special-mono',
      name: 'Minimalist Mono',
      category: 'special',
      vars: lightVars({
        body: '#fafafa', base: '#f0f0f0', alt: '#e6e6e6', alt2: '#cccccc',
        text: '#111111', textAlt: '#444444', link: '#000000',
        accent: '#111111', accentHover: '#333333',
        border: '#bbbbbb'
      }),
      effects: { accent: '#111111' },
      pageBackground: { enabled: true, type: 'color', color: '#fafafa' },
      customCSS: `
        * { font-family: -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif !important; }
        button, .tw-button { box-shadow: none !important; }
      `
    }),
    mk({
      id: 'special-vaporwave',
      name: 'Vaporwave',
      category: 'special',
      vars: darkVars({
        body: '#1a0d2e', base: '#2a1140', alt: '#3a1755', alt2: '#4a1f6a',
        text: '#ffd6f7', textAlt: '#c8a2d8', link: '#00f0ff',
        accent: '#ff71ce', accentHover: '#ff8fd8'
      }),
      effects: { accent: '#00f0ff', chatGlow: true, roundedUI: true },
      pageBackground: { enabled: true, type: 'gradient',
        gradient: 'linear-gradient(180deg, #ff71ce 0%, #b967ff 35%, #01cdfe 70%, #05ffa1 100%)' }
    })
  ];

  global.TwitchThemesPresets = {
    LIGHT, DARK, SPECIAL,
    all: () => [...DARK, ...LIGHT, ...SPECIAL],
    byId: (id) => [...DARK, ...LIGHT, ...SPECIAL].find((t) => t.id === id) || null
  };
})(typeof window !== 'undefined' ? window : globalThis);
