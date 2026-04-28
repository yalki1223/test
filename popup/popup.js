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

  /* ---------------- Info / tooltip system ----------------
   * Each editor field gets an (i) icon. On hover/focus we show a floating
   * tooltip with a short description and a tiny SVG mock-up of the Twitch
   * UI where the affected region is highlighted, so users can see at a glance
   * what the option actually changes.
   */

  /** Build a small Twitch-like layout SVG with one or more regions highlighted. */
  function svgLayout(opts) {
    opts = opts || {};
    const highlight = opts.highlight || 'page';
    const accent = opts.accent || '#9147ff';
    // Region fills (default vs highlighted).
    const dim = '#1f1f23';
    const dim2 = '#26262c';
    const text = opts.text || '#efeff1';
    const link = opts.link || accent;
    const hlBody = highlight === 'body' || highlight === 'page' || highlight === 'all';
    const hlBase = highlight === 'base' || highlight === 'all';
    const hlAlt = highlight === 'alt' || highlight === 'all';
    const hlAlt2 = highlight === 'alt2' || highlight === 'all';
    const hlTopbar = highlight === 'topbar' || highlight === 'all';
    const hlSidebar = highlight === 'sidebar' || highlight === 'all';
    const hlChat = highlight === 'chat' || highlight === 'all';
    const hlButton = highlight === 'button' || highlight === 'accent';
    const hlBorder = highlight === 'border';
    const hlText = highlight === 'text';
    const hlTextAlt = highlight === 'textAlt';
    const hlLink = highlight === 'link';
    // Body/page bg fill.
    let bodyFill = hlBody ? (opts.bodyFill || accent) : '#0e0e10';
    if (opts.bodyImage) bodyFill = `url(#bgPattern)`;
    // Borders.
    const borderColor = hlBorder ? accent : '#2c2c33';
    return [
      '<svg viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg">',
      '<defs>',
      `<pattern id="bgPattern" width="24" height="24" patternUnits="userSpaceOnUse">`,
      `<rect width="24" height="24" fill="${accent}" opacity="0.85"/>`,
      `<circle cx="12" cy="12" r="6" fill="#fff" opacity="0.18"/>`,
      `</pattern>`,
      '</defs>',
      // body
      `<rect x="0" y="0" width="240" height="140" fill="${bodyFill}"/>`,
      // top bar
      `<rect x="0" y="0" width="240" height="16" fill="${hlTopbar ? accent : '#18181b'}" stroke="${borderColor}" stroke-width="${hlBorder ? 1 : 0}"/>`,
      // sidebar
      `<rect x="0" y="16" width="36" height="124" fill="${hlSidebar ? accent : '#18181b'}" stroke="${borderColor}" stroke-width="${hlBorder ? 1 : 0}"/>`,
      // chat panel
      `<rect x="180" y="16" width="60" height="124" fill="${hlChat ? accent : '#18181b'}" stroke="${borderColor}" stroke-width="${hlBorder ? 1 : 0}"/>`,
      // main content area card (base)
      `<rect x="44" y="22" width="130" height="70" rx="4" fill="${hlBase ? accent : dim}" stroke="${borderColor}" stroke-width="${hlBorder ? 1 : 0}"/>`,
      // sub-card alt
      `<rect x="44" y="98" width="62" height="34" rx="4" fill="${hlAlt ? accent : dim2}" stroke="${borderColor}" stroke-width="${hlBorder ? 1 : 0}"/>`,
      `<rect x="112" y="98" width="62" height="34" rx="4" fill="${hlAlt2 ? accent : dim2}" stroke="${borderColor}" stroke-width="${hlBorder ? 1 : 0}"/>`,
      // sidebar items
      `<circle cx="18" cy="30" r="5" fill="${hlSidebar ? '#fff' : '#3a3a40'}"/>`,
      `<circle cx="18" cy="46" r="5" fill="#3a3a40"/>`,
      `<circle cx="18" cy="62" r="5" fill="#3a3a40"/>`,
      // top bar logo
      `<circle cx="10" cy="8" r="3" fill="#9147ff"/>`,
      // primary button (Follow / Subscribe)
      `<rect x="148" y="4" width="40" height="10" rx="3" fill="${hlButton ? accent : '#9147ff'}"/>`,
      // text lines on main card
      `<rect x="50" y="30" width="70" height="4" rx="2" fill="${hlText ? text : (hlTextAlt ? '#adadb8' : '#dadada')}"/>`,
      `<rect x="50" y="40" width="100" height="3" rx="1.5" fill="${hlTextAlt ? '#adadb8' : (hlText ? text : '#5a5a60')}" opacity="${hlTextAlt ? 1 : 0.7}"/>`,
      `<rect x="50" y="48" width="40" height="3" rx="1.5" fill="${hlLink ? link : '#5a5a60'}"/>`,
      // chat lines
      ...(opts.chatLines || []).map((line, i) => {
        const y = 22 + i * 12;
        const rx = line.radius || 0;
        const bg = line.bg;
        const tc = line.color || '#dadada';
        const fs = line.fontSize || 4;
        const glow = line.glow ? `filter="url(#glow)"` : '';
        return [
          bg ? `<rect x="184" y="${y - 2}" width="52" height="${fs + 4}" rx="${rx}" fill="${bg}" ${glow}/>` : '',
          `<rect x="186" y="${y}" width="40" height="${fs}" rx="1" fill="${tc}"/>`
        ].join('');
      }),
      opts.chatGlow ? `<defs><filter id="glow"><feGaussianBlur stdDeviation="1.4"/></filter></defs>` : '',
      '</svg>'
    ].flat().join('');
  }

  /** Default chat preview lines. */
  function defaultChatLines(overrides) {
    overrides = overrides || {};
    return [
      Object.assign({ color: '#9147ff', fontSize: 4 }, overrides),
      Object.assign({ color: '#dadada', fontSize: 4 }, overrides),
      Object.assign({ color: '#dadada', fontSize: 4 }, overrides),
      Object.assign({ color: '#dadada', fontSize: 4 }, overrides),
      Object.assign({ color: '#dadada', fontSize: 4 }, overrides)
    ];
  }

  /** Info dictionary keyed by data-info value. Each entry returns title + description + svg illustration. */
  const INFO = {
    // Base colour vars
    'var:body': () => ({
      title: 'Фон тела (body)',
      desc: 'Главный фон страницы за всем содержимым (то, что видно по краям и под прозрачными карточками).',
      svg: svgLayout({ highlight: 'body' })
    }),
    'var:base': () => ({
      title: 'Фон базы (карточки)',
      desc: 'Основной фон карточек, плеера, разделов чата и др. больших панелей контента.',
      svg: svgLayout({ highlight: 'base' })
    }),
    'var:alt': () => ({
      title: 'Фон alt',
      desc: 'Альтернативный фон — используется в подкарточках, стримах в категориях, всплывающих блоках.',
      svg: svgLayout({ highlight: 'alt' })
    }),
    'var:alt2': () => ({
      title: 'Фон alt-2',
      desc: 'Самый «глубокий» фон под alt — для разделителей, нижних блоков и тёмных подложек.',
      svg: svgLayout({ highlight: 'alt2' })
    }),
    'var:text': () => ({
      title: 'Цвет текста',
      desc: 'Основной цвет всех текстов — заголовков, описаний, сообщений в чате.',
      svg: svgLayout({ highlight: 'text' })
    }),
    'var:textAlt': () => ({
      title: 'Текст alt',
      desc: 'Цвет вторичного текста — подписей, времени, второстепенных деталей.',
      svg: svgLayout({ highlight: 'textAlt' })
    }),
    'var:link': () => ({
      title: 'Ссылки и ники',
      desc: 'Цвет ссылок и имён пользователей — там, где Twitch обычно использует фиолетовый.',
      svg: svgLayout({ highlight: 'link' })
    }),
    'var:border': () => ({
      title: 'Граница',
      desc: 'Цвет тонких рамок: вокруг карточек, инпутов, кнопок и разделителей.',
      svg: svgLayout({ highlight: 'border' })
    }),
    'var:button': () => ({
      title: 'Кнопка primary',
      desc: 'Цвет основных кнопок Twitch (Follow, Subscribe и т.п.).',
      svg: svgLayout({ highlight: 'button' })
    }),
    'var:accent': () => ({
      title: 'Акцент расширения',
      desc: 'Дополнительный акцентный цвет: используется для важных кнопок (Follow), ссылок, ников и эффекта свечения чата.',
      svg: svgLayout({ highlight: 'accent' })
    }),

    // Background layer regions (used both for the section headers and per-field).
    'region:page': () => ({
      title: 'Фон сайта',
      desc: 'Картинка / гифка / цвет, который рисуется поверх всей страницы под чатом и контентом.',
      svg: svgLayout({ highlight: 'page', bodyImage: true })
    }),
    'region:chat': () => ({
      title: 'Фон чата',
      desc: 'Заполняет правую панель чата своим фоном (картинка, гифка, цвет, градиент).',
      svg: svgLayout({ highlight: 'chat' })
    }),
    'region:sidebar': () => ({
      title: 'Фон левой панели',
      desc: 'Применяется к боковой панели слева (список каналов, рекомендации).',
      svg: svgLayout({ highlight: 'sidebar' })
    }),
    'region:topbar': () => ({
      title: 'Фон верхней панели',
      desc: 'Применяется к верхней навигационной панели Twitch (логотип, поиск, профиль).',
      svg: svgLayout({ highlight: 'topbar' })
    }),

    // Per-field hints inside layer form (region-aware).
    'layer:enabled': (region) => ({
      title: 'Включить слой',
      desc: 'Главный выключатель для этого фона. Если выключено — слой вообще не рисуется.',
      svg: svgLayout({ highlight: region })
    }),
    'layer:type': () => ({
      title: 'Тип фона',
      desc: 'Что использовать в качестве фона: однотонный цвет, CSS-градиент или загруженная картинка/GIF.',
      svg:
        '<svg viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="8" y="20" width="60" height="100" rx="6" fill="#9147ff"/>' +
        '<rect x="90" y="20" width="60" height="100" rx="6" fill="url(#g)"/>' +
        '<rect x="172" y="20" width="60" height="100" rx="6" fill="url(#p2)"/>' +
        '<text x="38" y="135" fill="#adadb8" font-size="9" text-anchor="middle" font-family="sans-serif">color</text>' +
        '<text x="120" y="135" fill="#adadb8" font-size="9" text-anchor="middle" font-family="sans-serif">gradient</text>' +
        '<text x="202" y="135" fill="#adadb8" font-size="9" text-anchor="middle" font-family="sans-serif">image</text>' +
        '<defs>' +
        '<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9147ff"/><stop offset="1" stop-color="#ff36c8"/></linearGradient>' +
        '<pattern id="p2" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#1f6feb"/><circle cx="8" cy="8" r="4" fill="#fff" opacity="0.4"/></pattern>' +
        '</defs>' +
        '</svg>'
    }),
    'layer:color': () => ({
      title: 'Цвет фона',
      desc: 'Сплошной цвет, заливающий выбранную область. Работает только когда «Тип» = color.',
      svg: '<svg viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg"><rect x="20" y="20" width="200" height="100" rx="8" fill="#9147ff"/></svg>'
    }),
    'layer:gradient': () => ({
      title: 'CSS-градиент',
      desc: 'Любой валидный CSS-градиент: linear-gradient(135deg,#9147ff,#ff36c8) и т.п. Берётся, когда «Тип» = gradient.',
      svg:
        '<svg viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg">' +
        '<defs><linearGradient id="gr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9147ff"/><stop offset="0.5" stop-color="#ff36c8"/><stop offset="1" stop-color="#1f6feb"/></linearGradient></defs>' +
        '<rect x="20" y="20" width="200" height="100" rx="8" fill="url(#gr)"/>' +
        '</svg>'
    }),
    'layer:image': () => ({
      title: 'Картинка / GIF',
      desc: 'Загрузи картинку или GIF (или укажи URL). Файл встроится прямо в тему как data-URL и будет работать офлайн.',
      svg:
        '<svg viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="20" y="20" width="200" height="100" rx="8" fill="#1a1a1f" stroke="#2c2c33"/>' +
        '<circle cx="60" cy="55" r="12" fill="#ffd56b"/>' +
        '<polygon points="30,110 90,60 130,90 180,40 220,110" fill="#9147ff" opacity="0.85"/>' +
        '<polygon points="30,110 90,60 130,90 180,40 220,110" fill="#ff36c8" opacity="0.4"/>' +
        '</svg>'
    }),
    'layer:size': () => ({
      title: 'Размер фона',
      desc: 'cover — заполняет всю область без полей. contain — вписывает целиком (могут быть поля). auto — реальный размер. растянуть — на 100%×100%.',
      svg:
        '<svg viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="6" y="20" width="108" height="50" rx="4" fill="#1a1a1f" stroke="#2c2c33"/>' +
        '<rect x="6" y="20" width="108" height="50" fill="url(#imgC)"/>' +
        '<text x="60" y="82" fill="#adadb8" font-size="9" text-anchor="middle" font-family="sans-serif">cover</text>' +
        '<rect x="126" y="20" width="108" height="50" rx="4" fill="#1a1a1f" stroke="#2c2c33"/>' +
        '<rect x="152" y="30" width="56" height="30" fill="url(#imgC)"/>' +
        '<text x="180" y="82" fill="#adadb8" font-size="9" text-anchor="middle" font-family="sans-serif">contain</text>' +
        '<rect x="6" y="90" width="108" height="40" rx="4" fill="#1a1a1f" stroke="#2c2c33"/>' +
        '<rect x="6" y="90" width="108" height="40" fill="url(#imgC)" preserveAspectRatio="none"/>' +
        '<text x="60" y="126" fill="#fff" font-size="9" text-anchor="middle" font-family="sans-serif">stretch</text>' +
        '<defs><linearGradient id="imgC" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9147ff"/><stop offset="1" stop-color="#ff36c8"/></linearGradient></defs>' +
        '</svg>'
    }),
    'layer:repeat': () => ({
      title: 'Повтор',
      desc: 'no-repeat — одна копия. repeat — заполнить плиткой в обоих направлениях. repeat-x / repeat-y — только по одной оси.',
      svg:
        '<svg viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg">' +
        '<defs><pattern id="tt" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="#1a1a1f"/><circle cx="12" cy="12" r="6" fill="#9147ff"/></pattern></defs>' +
        '<rect x="6" y="10" width="108" height="50" rx="4" fill="url(#tt)"/>' +
        '<text x="60" y="75" fill="#adadb8" font-size="9" text-anchor="middle" font-family="sans-serif">repeat</text>' +
        '<rect x="126" y="10" width="108" height="50" rx="4" fill="#1a1a1f"/>' +
        '<circle cx="180" cy="35" r="12" fill="#9147ff"/>' +
        '<text x="180" y="75" fill="#adadb8" font-size="9" text-anchor="middle" font-family="sans-serif">no-repeat</text>' +
        '</svg>'
    }),
    'layer:positionX': () => ({
      title: 'Позиция X',
      desc: 'Горизонтальная позиция картинки в %. 0 — слева, 50 — по центру, 100 — справа. Полезно когда фон не помещается.',
      svg:
        '<svg viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="20" y="20" width="200" height="80" rx="6" fill="#1a1a1f" stroke="#2c2c33"/>' +
        '<circle cx="60" cy="60" r="18" fill="#9147ff" opacity="0.7"/>' +
        '<circle cx="180" cy="60" r="18" fill="#9147ff"/>' +
        '<path d="M70 60 L170 60" stroke="#fff" stroke-width="1.2" stroke-dasharray="3 3"/>' +
        '<polygon points="170,55 180,60 170,65" fill="#fff"/>' +
        '<text x="120" y="125" fill="#adadb8" font-size="10" text-anchor="middle" font-family="sans-serif">сдвиг по горизонтали</text>' +
        '</svg>'
    }),
    'layer:positionY': () => ({
      title: 'Позиция Y',
      desc: 'Вертикальная позиция картинки в %. 0 — сверху, 50 — по центру, 100 — снизу.',
      svg:
        '<svg viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="60" y="10" width="120" height="120" rx="6" fill="#1a1a1f" stroke="#2c2c33"/>' +
        '<circle cx="120" cy="30" r="14" fill="#9147ff" opacity="0.7"/>' +
        '<circle cx="120" cy="110" r="14" fill="#9147ff"/>' +
        '<path d="M120 44 L120 95" stroke="#fff" stroke-width="1.2" stroke-dasharray="3 3"/>' +
        '<polygon points="115,95 120,108 125,95" fill="#fff"/>' +
        '</svg>'
    }),
    'layer:opacity': () => ({
      title: 'Прозрачность',
      desc: 'Прозрачность всего слоя: 1 — полностью видно, 0 — полностью невидно.',
      svg:
        '<svg viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="10" y="30" width="220" height="60" fill="#0e0e10"/>' +
        '<rect x="10" y="30" width="55" height="60" fill="#9147ff" opacity="0.2"/>' +
        '<rect x="65" y="30" width="55" height="60" fill="#9147ff" opacity="0.5"/>' +
        '<rect x="120" y="30" width="55" height="60" fill="#9147ff" opacity="0.8"/>' +
        '<rect x="175" y="30" width="55" height="60" fill="#9147ff" opacity="1"/>' +
        '<text x="38" y="108" fill="#adadb8" font-size="9" text-anchor="middle" font-family="sans-serif">0.2</text>' +
        '<text x="92" y="108" fill="#adadb8" font-size="9" text-anchor="middle" font-family="sans-serif">0.5</text>' +
        '<text x="148" y="108" fill="#adadb8" font-size="9" text-anchor="middle" font-family="sans-serif">0.8</text>' +
        '<text x="203" y="108" fill="#adadb8" font-size="9" text-anchor="middle" font-family="sans-serif">1.0</text>' +
        '</svg>'
    }),
    'layer:blur': () => ({
      title: 'Размытие (blur)',
      desc: 'Гауссово размытие фона в пикселях. Делает картинку «мягкой» — удобно, когда фон отвлекает от текста.',
      svg:
        '<svg viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg">' +
        '<defs><filter id="b1"><feGaussianBlur stdDeviation="0"/></filter><filter id="b2"><feGaussianBlur stdDeviation="3"/></filter><filter id="b3"><feGaussianBlur stdDeviation="7"/></filter></defs>' +
        '<rect x="10" y="30" width="70" height="70" rx="6" fill="#9147ff" filter="url(#b1)"/>' +
        '<rect x="85" y="30" width="70" height="70" rx="6" fill="#9147ff" filter="url(#b2)"/>' +
        '<rect x="160" y="30" width="70" height="70" rx="6" fill="#9147ff" filter="url(#b3)"/>' +
        '<text x="45" y="118" fill="#adadb8" font-size="9" text-anchor="middle" font-family="sans-serif">0px</text>' +
        '<text x="120" y="118" fill="#adadb8" font-size="9" text-anchor="middle" font-family="sans-serif">3px</text>' +
        '<text x="195" y="118" fill="#adadb8" font-size="9" text-anchor="middle" font-family="sans-serif">7px</text>' +
        '</svg>'
    }),

    // Chat
    'chat:messageBgColor': () => ({
      title: 'Фон сообщения',
      desc: 'Заливка под каждым сообщением чата. Полезна вместе со скруглением углов — получаются «пузырьки».',
      svg: svgLayout({
        highlight: 'none',
        chatLines: [
          { color: '#fff', bg: '#9147ff', radius: 3, fontSize: 4 },
          { color: '#fff', bg: '#9147ff', radius: 3, fontSize: 4 },
          { color: '#fff', bg: '#9147ff', radius: 3, fontSize: 4 },
          { color: '#fff', bg: '#9147ff', radius: 3, fontSize: 4 }
        ]
      })
    }),
    'chat:textColor': () => ({
      title: 'Цвет текста чата',
      desc: 'Цвет, которым печатаются буквы в сообщениях.',
      svg: svgLayout({
        highlight: 'none',
        chatLines: [
          { color: '#9147ff', fontSize: 4 },
          { color: '#9147ff', fontSize: 4 },
          { color: '#9147ff', fontSize: 4 },
          { color: '#9147ff', fontSize: 4 }
        ]
      })
    }),
    'chat:fontFamily': () => ({
      title: 'Шрифт чата',
      desc: 'Любой CSS font-family. Работает только если такой шрифт установлен в системе.',
      svg:
        '<svg viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="0" y="0" width="240" height="140" fill="#0e0e10"/>' +
        '<text x="16" y="38" fill="#dadada" font-size="15" font-family="serif">Aa Серифный</text>' +
        '<text x="16" y="68" fill="#dadada" font-size="15" font-family="sans-serif">Aa Без засечек</text>' +
        '<text x="16" y="98" fill="#dadada" font-size="15" font-family="monospace">Aa Моноширинный</text>' +
        '<text x="16" y="126" fill="#9147ff" font-size="15" font-family="cursive">Aa Курсивный</text>' +
        '</svg>'
    }),
    'chat:fontSize': () => ({
      title: 'Размер шрифта',
      desc: 'Размер букв в сообщениях, в пикселях. 0 — оставить как у Twitch.',
      svg:
        '<svg viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="0" y="0" width="240" height="140" fill="#18181b"/>' +
        '<text x="16" y="30" fill="#dadada" font-size="10" font-family="sans-serif">10px — мелко</text>' +
        '<text x="16" y="58" fill="#dadada" font-size="14" font-family="sans-serif">14px — норм</text>' +
        '<text x="16" y="92" fill="#dadada" font-size="20" font-family="sans-serif">20px — крупно</text>' +
        '<text x="16" y="128" fill="#9147ff" font-size="26" font-family="sans-serif">26px — XXL</text>' +
        '</svg>'
    }),
    'chat:borderRadius': () => ({
      title: 'Скругление углов',
      desc: 'Радиус скругления углов сообщений в пикселях. Большое значение = «облачка».',
      svg: svgLayout({
        highlight: 'none',
        chatLines: [
          { color: '#fff', bg: '#9147ff', radius: 0, fontSize: 4 },
          { color: '#fff', bg: '#9147ff', radius: 2, fontSize: 4 },
          { color: '#fff', bg: '#9147ff', radius: 6, fontSize: 4 },
          { color: '#fff', bg: '#9147ff', radius: 12, fontSize: 4 }
        ]
      })
    }),
    'chat:outline': () => ({
      title: 'Обводка текста',
      desc: 'Чёрная обводка вокруг букв — повышает читаемость на ярком фоне.',
      svg:
        '<svg viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg">' +
        '<defs><linearGradient id="og" x1="0" x2="1"><stop offset="0" stop-color="#9147ff"/><stop offset="1" stop-color="#ff36c8"/></linearGradient></defs>' +
        '<rect width="240" height="140" fill="url(#og)"/>' +
        '<text x="120" y="55" fill="#fff" font-size="22" font-weight="700" text-anchor="middle" font-family="sans-serif">Без обводки</text>' +
        '<text x="120" y="105" fill="#fff" stroke="#000" stroke-width="2" font-size="22" font-weight="700" text-anchor="middle" font-family="sans-serif">С обводкой</text>' +
        '</svg>'
    }),

    // Effects
    'fx:chatGlow': () => ({
      title: 'Свечение чата',
      desc: 'Каждое сообщение чата получает мягкое свечение акцентного цвета. Хорошо смотрится на тёмных темах.',
      svg:
        '<svg viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg">' +
        '<defs><filter id="glw" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter></defs>' +
        '<rect width="240" height="140" fill="#0e0e10"/>' +
        '<g>' +
        '<rect x="30" y="20" width="180" height="18" rx="6" fill="#9147ff" filter="url(#glw)" opacity="0.65"/>' +
        '<rect x="30" y="20" width="180" height="18" rx="6" fill="#1f1f23"/>' +
        '<text x="40" y="32" fill="#dadada" font-size="9" font-family="sans-serif">Hello chat</text>' +
        '</g>' +
        '<g transform="translate(0,30)">' +
        '<rect x="30" y="20" width="180" height="18" rx="6" fill="#9147ff" filter="url(#glw)" opacity="0.65"/>' +
        '<rect x="30" y="20" width="180" height="18" rx="6" fill="#1f1f23"/>' +
        '<text x="40" y="32" fill="#dadada" font-size="9" font-family="sans-serif">Glow effect demo</text>' +
        '</g>' +
        '<g transform="translate(0,60)">' +
        '<rect x="30" y="20" width="180" height="18" rx="6" fill="#9147ff" filter="url(#glw)" opacity="0.65"/>' +
        '<rect x="30" y="20" width="180" height="18" rx="6" fill="#1f1f23"/>' +
        '<text x="40" y="32" fill="#dadada" font-size="9" font-family="sans-serif">PogChamp</text>' +
        '</g>' +
        '</svg>'
    }),
    'fx:roundedUI': () => ({
      title: 'Скруглить весь UI',
      desc: 'Делает большие радиусы у всех кнопок, инпутов, плеера и панелей чата.',
      svg:
        '<svg viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg">' +
        '<rect width="240" height="140" fill="#18181b"/>' +
        '<rect x="20" y="22" width="90" height="30" rx="2" fill="#9147ff"/>' +
        '<rect x="130" y="22" width="90" height="30" rx="14" fill="#9147ff"/>' +
        '<rect x="20" y="66" width="90" height="54" rx="4" fill="#1f1f23" stroke="#2c2c33"/>' +
        '<rect x="130" y="66" width="90" height="54" rx="18" fill="#1f1f23" stroke="#2c2c33"/>' +
        '<text x="65" y="43" fill="#fff" font-size="10" text-anchor="middle" font-family="sans-serif">прямые</text>' +
        '<text x="175" y="43" fill="#fff" font-size="10" text-anchor="middle" font-family="sans-serif">скруглённые</text>' +
        '</svg>'
    }),

    // Custom CSS
    'customCSS': () => ({
      title: 'Кастомный CSS',
      desc: 'Любой CSS-код, который добавится к теме. Здесь можно тонко поправить любой селектор Twitch.',
      svg:
        '<svg viewBox="0 0 240 140" xmlns="http://www.w3.org/2000/svg">' +
        '<rect width="240" height="140" fill="#0e0e10"/>' +
        '<text x="12" y="24" fill="#9147ff" font-size="10" font-family="monospace">.chat-line__message {</text>' +
        '<text x="22" y="40" fill="#ff36c8" font-size="10" font-family="monospace">color</text>' +
        '<text x="56" y="40" fill="#dadada" font-size="10" font-family="monospace">: #fff;</text>' +
        '<text x="22" y="56" fill="#ff36c8" font-size="10" font-family="monospace">background</text>' +
        '<text x="86" y="56" fill="#dadada" font-size="10" font-family="monospace">: #9147ff;</text>' +
        '<text x="22" y="72" fill="#ff36c8" font-size="10" font-family="monospace">border-radius</text>' +
        '<text x="104" y="72" fill="#dadada" font-size="10" font-family="monospace">: 12px;</text>' +
        '<text x="12" y="88" fill="#9147ff" font-size="10" font-family="monospace">}</text>' +
        '<text x="12" y="118" fill="#adadb8" font-size="9" font-family="sans-serif">+ всё, что захочешь поправить</text>' +
        '</svg>'
    })
  };

  /* ---------------- Tooltip helpers ---------------- */
  const tooltipEl = document.getElementById('info-tooltip');
  let activeInfoBtn = null;

  function infoEntry(key, region) {
    const fn = INFO[key];
    if (typeof fn === 'function') return fn(region);
    return null;
  }

  function showTooltipFor(btn) {
    if (!btn) return;
    const key = btn.dataset.infoKey;
    const region = btn.dataset.infoRegion || '';
    const entry = infoEntry(key, region);
    if (!entry) return;
    activeInfoBtn = btn;
    tooltipEl.innerHTML =
      `<div class="tt-title"></div>` +
      `<div class="tt-desc"></div>` +
      `<div class="tt-illu">${entry.svg || ''}</div>` +
      `<span class="tt-arrow"></span>`;
    tooltipEl.querySelector('.tt-title').textContent = entry.title || '';
    tooltipEl.querySelector('.tt-desc').textContent = entry.desc || '';
    tooltipEl.classList.add('show');
    tooltipEl.setAttribute('aria-hidden', 'false');
    positionTooltip(btn);
  }
  function hideTooltip(forBtn) {
    if (forBtn && forBtn !== activeInfoBtn) return;
    activeInfoBtn = null;
    tooltipEl.classList.remove('show');
    tooltipEl.setAttribute('aria-hidden', 'true');
  }
  function positionTooltip(btn) {
    const r = btn.getBoundingClientRect();
    const tw = 260; // matches CSS width
    const margin = 8;
    // Prefer right-side; if not enough room, place left; if too close to bottom, flip up.
    let left = r.right + margin;
    let arrow = 'left';
    if (left + tw + 4 > window.innerWidth) {
      left = r.left - tw - margin;
      arrow = 'right';
      if (left < 4) {
        left = Math.max(4, Math.min(window.innerWidth - tw - 4, r.left));
        arrow = 'top';
      }
    }
    tooltipEl.style.left = left + 'px';
    // Provisional top — measure after to clamp.
    let top = r.top - 4;
    tooltipEl.style.top = top + 'px';
    const th = tooltipEl.offsetHeight;
    if (top + th + 4 > window.innerHeight) top = window.innerHeight - th - 4;
    if (top < 4) top = 4;
    tooltipEl.style.top = top + 'px';
    tooltipEl.dataset.arrow = arrow;
  }

  /** Create an (i) button and wire hover/focus to show tooltip. */
  function makeInfoBtn(key, region) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'info-btn';
    b.textContent = 'i';
    b.title = 'Показать что меняет этот пункт';
    b.setAttribute('aria-label', 'Что меняет этот пункт');
    b.dataset.infoKey = key;
    if (region) b.dataset.infoRegion = region;
    b.tabIndex = 0;
    b.addEventListener('mouseenter', () => showTooltipFor(b));
    b.addEventListener('mouseleave', () => hideTooltip(b));
    b.addEventListener('focus', () => showTooltipFor(b));
    b.addEventListener('blur', () => hideTooltip(b));
    b.addEventListener('click', (e) => {
      // Sticky: clicking toggles tooltip; prevents the surrounding label
      // from forwarding the click to the underlying input (which would
      // open colour pickers, etc).
      e.preventDefault();
      e.stopPropagation();
      if (activeInfoBtn === b) hideTooltip(b);
      else showTooltipFor(b);
    });
    return b;
  }

  /** Walk every editor element with [data-info] and inject (i) buttons. */
  function injectInfoIcons() {
    document.querySelectorAll('[data-info]').forEach((el) => {
      if (el.dataset.infoBound) return;
      el.dataset.infoBound = '1';
      const key = el.dataset.info;
      const region = el.dataset.infoRegion || el.closest('[data-region]')?.dataset.region || '';
      // Place (i) right after the .lab span if present, otherwise prepend.
      const lab = el.querySelector(':scope > .lab');
      const btn = makeInfoBtn(key, region);
      if (lab) lab.appendChild(btn);
      else el.insertBefore(btn, el.firstChild);
    });
    // Section summaries (Фон сайта/чата/левой панели/верхней панели) get an (i) too.
    document.querySelectorAll('details > div[data-region]').forEach((div) => {
      const summary = div.parentElement && div.parentElement.querySelector(':scope > summary');
      if (!summary || summary.dataset.infoBound) return;
      summary.dataset.infoBound = '1';
      summary.appendChild(makeInfoBtn('region:' + div.dataset.region));
    });
  }

  // Hide tooltip on scroll/resize/click outside.
  document.addEventListener('scroll', () => hideTooltip(), true);
  window.addEventListener('resize', () => hideTooltip());
  document.addEventListener('click', (e) => {
    if (activeInfoBtn && !activeInfoBtn.contains(e.target)) hideTooltip();
  });

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

  /* ---------------- Apply/Save ----------------
   * Writes the active payload + (optionally) updated customs in a single
   * chrome.storage.local.set call so the content script never observes a
   * half-applied state where tt:active references a custom theme that's not
   * yet in tt:customs (which previously caused backgrounds to silently fail).
   */
  async function applyTheme(theme, kind, opts) {
    opts = opts || {};
    let payload;
    if (kind === 'preset') payload = { kind: 'preset', id: theme.id };
    else if (kind === 'custom') payload = { kind: 'custom', id: theme.id };
    else payload = { kind: 'inline', theme };
    const writes = { [STORAGE_ACTIVE]: payload, [STORAGE_DISABLED]: false };
    if (opts.persistCustoms) writes[STORAGE_CUSTOMS] = state.customs;
    await storage.set(writes);
    state.activeRef = payload;
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
    const region = container.dataset.region || '';
    container.innerHTML = `
      <div class="layer-form">
        <label class="full" data-info="layer:enabled" data-info-region="${region}">
          <span class="lab">Включить слой</span>
          <input type="checkbox" data-field="enabled" />
        </label>
        <label data-info="layer:type">
          <span class="lab">Тип</span>
          <select data-field="type">
            <option value="color">Сплошной цвет</option>
            <option value="gradient">Градиент</option>
            <option value="image">Картинка / GIF</option>
          </select>
        </label>
        <label data-info="layer:color"><span class="lab">Цвет</span><input type="color" data-field="color" /></label>
        <label class="full" data-info="layer:gradient"><span class="lab">Градиент CSS</span><input type="text" data-field="gradient" placeholder="linear-gradient(135deg,#9147ff,#ff36c8)" /></label>
        <div class="full layer-image-row" data-info="layer:image">
          <div class="layer-image-thumb" data-thumb></div>
          <button class="btn" data-action="upload">Загрузить картинку/GIF</button>
          <button class="btn-ghost" data-action="url">URL</button>
          <button class="btn-ghost" data-action="clear">Удалить</button>
          <input type="file" accept="image/*" hidden data-file />
        </div>
        <label data-info="layer:size">
          <span class="lab">Размер</span>
          <select data-field="size">
            <option value="cover">cover (заполняет)</option>
            <option value="contain">contain (вписывает)</option>
            <option value="auto">auto (как есть)</option>
            <option value="100% 100%">растянуть</option>
          </select>
        </label>
        <label data-info="layer:repeat">
          <span class="lab">Повтор</span>
          <select data-field="repeat">
            <option value="no-repeat">no-repeat</option>
            <option value="repeat">repeat</option>
            <option value="repeat-x">repeat-x</option>
            <option value="repeat-y">repeat-y</option>
          </select>
        </label>
        <label data-info="layer:positionX"><span class="lab">Позиция X<span class="range-val" data-rv="positionX">50%</span></span><input type="range" data-field="positionX" min="0" max="100" step="1" /></label>
        <label data-info="layer:positionY"><span class="lab">Позиция Y<span class="range-val" data-rv="positionY">50%</span></span><input type="range" data-field="positionY" min="0" max="100" step="1" /></label>
        <label data-info="layer:opacity"><span class="lab">Прозрачность<span class="range-val" data-rv="opacity">1.0</span></span><input type="range" data-field="opacity" min="0" max="1" step="0.05" /></label>
        <label data-info="layer:blur"><span class="lab">Размытие<span class="range-val" data-rv="blur">0px</span></span><input type="range" data-field="blur" min="0" max="40" step="1" /></label>
      </div>
    `;
    const layer = state.editor[key];

    function setRangeVal(name, value) {
      const el = container.querySelector(`[data-rv="${name}"]`);
      if (!el) return;
      if (name === 'opacity') el.textContent = Number(value).toFixed(2);
      else if (name === 'blur') el.textContent = `${Number(value) | 0}px`;
      else el.textContent = `${Number(value) | 0}%`;
    }

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
      const op = typeof layer.opacity === 'number' ? layer.opacity : 1;
      container.querySelector('[data-field="opacity"]').value = op;
      const bl = layer.blur || 0;
      container.querySelector('[data-field="blur"]').value = bl;
      setRangeVal('positionX', pos.x);
      setRangeVal('positionY', pos.y);
      setRangeVal('opacity', op);
      setRangeVal('blur', bl);
      const thumb = container.querySelector('[data-thumb]');
      if (layer.image) thumb.style.background = `url("${layer.image}") center/cover`;
      else thumb.style.background = '#222';
    }

    container.querySelectorAll('[data-field]').forEach((input) => {
      input.addEventListener('input', () => {
        const f = input.dataset.field;
        if (f === 'enabled') layer.enabled = input.checked;
        else if (f === 'opacity' || f === 'blur') {
          layer[f] = parseFloat(input.value);
          setRangeVal(f, layer[f]);
        } else if (f === 'positionX' || f === 'positionY') {
          const x = container.querySelector('[data-field="positionX"]').value;
          const y = container.querySelector('[data-field="positionY"]').value;
          layer.position = `${x}% ${y}%`;
          setRangeVal('positionX', x);
          setRangeVal('positionY', y);
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
    // Layer forms are rebuilt every time the editor loads a theme, so the
    // newly-created [data-info] labels need their (i) buttons re-attached.
    injectInfoIcons();
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

  /** Save the editor's current state into customs and persist to storage.
   *  Returns the saved (cloned) theme. */
  async function saveCurrentEditor() {
    const t = JSON.parse(JSON.stringify(state.editor));
    t.category = 'custom';
    if (!t.name || !t.name.trim()) t.name = 'Без названия';
    const idx = state.customs.findIndex((c) => c.id === t.id);
    if (idx >= 0) state.customs[idx] = t;
    else state.customs.push(t);
    await storage.set({ [STORAGE_CUSTOMS]: state.customs });
    return t;
  }

  document.getElementById('ed-save').addEventListener('click', async () => {
    await saveCurrentEditor();
    renderCustoms();
    toast('Тема сохранена');
  });

  document.getElementById('ed-apply').addEventListener('click', async () => {
    // 1) Persist editor → customs (so the id resolves on the content side).
    // 2) Atomically write tt:active + tt:customs in a single set so the
    //    content script never sees a stale customs list.
    const t = await saveCurrentEditor();
    await applyTheme(t, 'custom', { persistCustoms: true });
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
    injectInfoIcons();
  })();
})();
