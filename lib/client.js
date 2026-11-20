/**
 * dsh-nav-pins — 浏览器半身。
 *
 * 手写 ModuleLoader bundle：零构建，只依赖 shell 已提供的服务（slots / configForms）。
 *
 * 两个能力：
 *   1. 折叠细线：点击侧栏面板列表底部那条细线，面板收成一排图标；再点一下回到列表。
 *   2. 面板固定持久化：展开态有一个「固定面板」入口，勾掉的面板从侧栏收起；
 *      选择通过 ctx.configForms 写回插件配置（落盘到 profile 的 cordis.patch.yml），
 *      重启 DSH 后依然是用户上次的选择 —— 不再「每次启动都全部显示」。
 *
 * 与宿主的关系（重要）：
 *   - 宿主的 panel 固定是纯内存 createPanelPins()，插件重载即失效；本插件不依赖它，
 *     而是自己维护 hiddenPanels 并用 DOM 隐藏面板行，所以宿主怎么重置都不影响持久化。
 *   - 宿主每行自带的「取消固定」按钮（class 含 panelUnpin）始终隐藏：
 *     折叠成图标时不该出现固定按键（用户明确要求），展开时统一由本插件入口管理，
 *     避免两套勾选互相打架。
 *
 * @module client.js
 */

window.__ModuleLoader__.load({
  id: '@duma520/dsh-nav-pins',
  factory: (require) => {
    const module = { exports: {} };

    /** cordis 实例 id，必须与 cordis.patch.yml 里 - id: nav-pins 一致。 */
    const ENTRY_ID = 'nav-pins';
    /** 折叠态存放位置（高频小状态，走 localStorage 即可）。 */
    const COLLAPSE_KEY = 'dsh-nav-pins:collapsed';
    /** 配置服务不可用时的兜底存放位置。 */
    const FALLBACK_KEY = 'dsh-nav-pins:hiddenPanels';
    /** 面板 id → 面板标题的缓存（宿主改名或换语言后自动刷新）。 */
    const LABEL_KEY = 'dsh-nav-pins:labels';
    /** 宿主的固定面板 id：永远显示，不允许被本插件隐藏。 */
    const FIXED_PANEL_ID = 'plugins';
    /** 只认这一条导航（宿主的面板列表）。 */
    const NAV_LABEL = /^(全局面板|Global panels)$/;

    const NAV_SELECTOR = 'nav[class*="panelList"]';
    const ROW_SELECTOR = 'button[class*="panelRow"]';
    const ENTRY_SELECTOR = '[class*="panelEntry"]';
    const TITLE_SELECTOR = '[class*="panelTitle"]';
    const GLYPH_SELECTOR = '[class*="panelGlyph"]';
    const TOGGLE_ATTR = 'data-nav-pins-toggle';
    const MANAGER_ATTR = 'data-nav-pins-manager';
    const HIDDEN_ATTR = 'data-nav-pins-hidden';

    const css = `
/* ---- 折叠细线 ---------------------------------------------------------- */
nav[class*="panelList"][data-nav-pins] { position: relative; padding-bottom: 24px; }
nav[class*="panelList"][data-nav-pins="collapsed"] {
  display: grid; grid-template-columns: repeat(auto-fit, 36px);
  align-items: center; align-content: start; justify-content: space-evenly;
  column-gap: 0; min-width: 0;
}
nav[class*="panelList"][data-nav-pins="collapsed"] [class*="panelEntry"] {
  width: 36px; display: flex; align-items: center; justify-content: center; min-width: 0;
}
nav[class*="panelList"][data-nav-pins="collapsed"] button[class*="panelRow"] {
  width: 36px; min-width: 36px; padding-inline: 8px; justify-content: center;
}
nav[class*="panelList"][data-nav-pins="collapsed"] [class*="panelTitle"] { display: none; }
nav[class*="panelList"][data-nav-pins="collapsed"] [class*="panelGlyph"] { flex: none; }

nav[class*="panelList"] > [data-nav-pins-toggle] {
  position: absolute; bottom: 0; left: 0; width: 100%; height: 24px;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  border: 0; background: transparent; color: inherit; cursor: pointer; padding: 0;
}
nav[class*="panelList"] > [data-nav-pins-toggle]::before,
nav[class*="panelList"] > [data-nav-pins-toggle]::after {
  content: ""; flex: 1 1 0; height: 0.5px; background: currentColor; opacity: .16;
}
nav[class*="panelList"] > [data-nav-pins-toggle]::before { mask-image: linear-gradient(to right, transparent, #000 22%); }
nav[class*="panelList"] > [data-nav-pins-toggle]::after { mask-image: linear-gradient(to left, transparent, #000 22%); }
nav[class*="panelList"] > [data-nav-pins-toggle]:hover::before,
nav[class*="panelList"] > [data-nav-pins-toggle]:hover::after { opacity: .32; }
nav[class*="panelList"] > [data-nav-pins-toggle]:focus-visible { outline: 2px solid currentColor; outline-offset: -2px; }
nav[class*="panelList"] > [data-nav-pins-toggle] svg {
  width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2;
  stroke-linecap: round; stroke-linejoin: round; opacity: .55; transition: opacity 90ms ease;
}
/* 两个箭头都在 DOM 里，靠状态切换显示：paint() 不去改 innerHTML，
   否则每次重绘都会产生 childList 变动，触发自己的 MutationObserver 空转。 */
nav[class*="panelList"] > [data-nav-pins-toggle] [data-nav-pins-caret] { display: none; }
nav[class*="panelList"][data-nav-pins="collapsed"] > [data-nav-pins-toggle] [data-nav-pins-caret="expand"] { display: block; }
nav[class*="panelList"][data-nav-pins="expanded"] > [data-nav-pins-toggle] [data-nav-pins-caret="collapse"] { display: block; }
nav[class*="panelList"] > [data-nav-pins-toggle]:hover svg { opacity: .95; }

/* ---- 展开态的「固定面板」入口 ------------------------------------------ */
nav[class*="panelList"] > [data-nav-pins-manager] {
  display: flex; align-items: center; gap: 6px;
  height: 28px; margin: 4px 0 2px; padding: 0 10px;
  border: 0; border-radius: 6px; background: transparent; cursor: pointer;
  color: var(--dsw-alias-label-secondary, inherit); font: inherit; font-size: 12px; line-height: 1;
  min-width: 0;
}
nav[class*="panelList"] > [data-nav-pins-manager]:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,.12));
  color: var(--dsw-alias-label-primary, inherit);
}
nav[class*="panelList"] > [data-nav-pins-manager] svg {
  width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.6;
  stroke-linecap: round; stroke-linejoin: round; flex: none;
}
nav[class*="panelList"][data-nav-pins="collapsed"] > [data-nav-pins-manager] { display: none; }

/* ---- 宿主自带的「取消固定」按钮：两种状态都不显示 ---------------------- */
[class*="panelUnpin"] { display: none !important; }
/* ---- 被用户收起来的面板 ------------------------------------------------ */
[data-nav-pins-hidden] { display: none !important; }

/* ---- 面板固定弹窗 ------------------------------------------------------ */
.np-overlay {
  position: fixed; inset: 0; z-index: 2147483000;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0, 0, 0, .32); padding: 16px;
}
.np-card {
  width: min(380px, 100%); max-height: min(70vh, 560px); display: flex; flex-direction: column;
  box-sizing: border-box; padding: 16px 16px 12px; border-radius: 12px;
  background: var(--dsw-alias-bg-layer-1, #fff); color: var(--dsw-alias-label-primary, #1f2329);
  box-shadow: 0 18px 48px rgba(0, 0, 0, .28); font: inherit;
}
.np-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.np-head h3 { margin: 0; font-size: 14px; font-weight: 600; }
.np-close {
  width: 26px; height: 26px; padding: 0; border: 0; border-radius: 6px; cursor: pointer;
  background: transparent; color: inherit; font-size: 18px; line-height: 1;
}
.np-close:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,.14)); }
.np-hint { margin: 8px 0 10px; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-secondary, #646a73); }
.np-list { overflow-y: auto; display: flex; flex-direction: column; gap: 2px; padding: 2px 0; }
.np-item {
  display: flex; align-items: center; gap: 8px; padding: 7px 8px; border-radius: 7px;
  font-size: 13px; cursor: pointer; user-select: none;
}
.np-item:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,.12)); }
.np-item input { width: 15px; height: 15px; margin: 0; cursor: pointer; flex: none; }
.np-item[data-nav-pins-locked] { cursor: default; opacity: .6; }
.np-item[data-nav-pins-locked]:hover { background: transparent; }
.np-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.np-lock { margin-left: auto; font-size: 11px; color: var(--dsw-alias-label-tertiary, #8f959e); }
.np-foot { margin-top: 10px; display: flex; flex-direction: column; gap: 4px; font-size: 11px; color: var(--dsw-alias-label-tertiary, #8f959e); }
.np-warn { color: var(--dsw-alias-label-warning, #b8860b); }
.np-empty { padding: 18px 8px; font-size: 12px; text-align: center; color: var(--dsw-alias-label-secondary, #646a73); }
`;

    /** 读 volatile 字段：既兼容 {get()} 包装，也兼容裸值。 */
    function readList(value, key) {
      if (!value || typeof value !== 'object') return null;
      const raw = value[key];
      if (raw === undefined || raw === null) return null;
      if (typeof raw.get === 'function') {
        try {
          const got = raw.get();
          return Array.isArray(got) ? got : null;
        } catch { return null; }
      }
      return Array.isArray(raw) ? raw : null;
    }

    function readJson(key) {
      try {
        const raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch { return null; }
    }

    function writeJson(key, value) {
      try { window.localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
    }

    function apply(ctx) {
      if (!ctx || !ctx.slots) return;
      ctx.effect(() => {
        const style = document.createElement('style');
        style.dataset.pluginCss = 'dsh-nav-pins';
        style.textContent = css;
        document.head.append(style);

        const form = ctx.configForms && typeof ctx.configForms.get === 'function'
          ? ctx.configForms.get(ENTRY_ID)
          : undefined;

        let hidden = [];
        let statusText = '选择实时保存，重启 DSH 后仍然有效。';
        let modal = null;
        const managed = new Set();
        /** 面板 id → 标题，用于宿主过滤掉部分行时仍能对上号。 */
        const labelCache = readJson(LABEL_KEY) || {};

        const sanitize = (list) => {
          const seen = new Set();
          const out = [];
          for (const item of list || []) {
            if (typeof item !== 'string' || item === FIXED_PANEL_ID || seen.has(item)) continue;
            seen.add(item);
            out.push(item);
          }
          return out;
        };

        const adopt = (list) => {
          const next = sanitize(list);
          const changed = next.length !== hidden.length || next.some((id, i) => id !== hidden[i]);
          hidden = next;
          return changed;
        };

        /** 从配置服务同步一次（启动 / 外部改动）。 */
        const loadFromConfig = () => {
          if (!form || typeof form.getSnapshot !== 'function') return false;
          let snapshot;
          try { snapshot = form.getSnapshot(); } catch { return false; }
          if (!snapshot || snapshot.status !== 'ready') return false;
          const list = readList(snapshot.value, 'hiddenPanels');
          if (list === null) return false;
          return adopt(list);
        };

        /** 兜底：配置服务不可用时用本机存储。 */
        const loadFromFallback = () => {
          const parsed = readJson(FALLBACK_KEY);
          return Array.isArray(parsed) ? adopt(parsed) : false;
        };

        let restored = false;
        if (form) restored = loadFromConfig();
        if (!restored) loadFromFallback();

        /** 写回配置；失败则退回本机存储。 */
        const persist = async () => {
          const list = [...hidden];
          if (form && typeof form.set === 'function') {
            try {
              const ok = await form.set('hiddenPanels', list);
              if (ok) { statusText = '已保存到插件配置，重启后继续生效。'; return true; }
              statusText = '配置写入未成功，已改用本机存储。';
            } catch {
              statusText = '配置写入异常，已改用本机存储。';
            }
          } else {
            statusText = '未找到配置服务，已改用本机存储。';
          }
          if (writeJson(FALLBACK_KEY, list)) return true;
          statusText = '保存失败：配置与本机存储都不可写。';
          return false;
        };

        /** 侧栏登记的面板 id（按 order 排序），用于把 DOM 行对齐到面板 id。 */
        const panelIds = () => {
          try {
            const entries = ctx.slots.entriesOfSlot('sidebar.panellist') || [];
            return entries
              .map((entry) => {
                const options = entry && entry.options ? entry.options : {};
                return { id: options.id, order: typeof options.order === 'number' ? options.order : 0 };
              })
              .filter((panel) => typeof panel.id === 'string')
              .sort((a, b) => a.order - b.order)
              .map((panel) => panel.id);
          } catch {
            return [];
          }
        };

        /** 面板行按钮：排除宿主的「更多」按钮（aria-haspopup）与我们自己插入的两个按钮。 */
        const panelRows = (nav) => {
          if (!nav) return [];
          return [...nav.querySelectorAll(ROW_SELECTOR)].filter((row) =>
            !row.hasAttribute('aria-haspopup') &&
            !row.hasAttribute(MANAGER_ATTR) &&
            !row.hasAttribute(TOGGLE_ATTR));
        };

        const rowWrap = (row) => {
          const entry = row.closest(ENTRY_SELECTOR);
          return entry || row.parentElement || row;
        };

        /**
         * 把 hidden 落到 DOM。
         *
         * 宿主会按内存里的 unpinned 过滤面板行，所以「行数 == 面板数」并不总成立：
         * 对齐时顺手刷新 id→标题缓存；对不上时用缓存按标题兜底匹配，
         * 保证用户的选择不会因为宿主那边的临时状态而整体失效。
         */
        const applyHidden = (nav) => {
          const rows = panelRows(nav);
          const ids = panelIds();
          const aligned = rows.length === ids.length && ids.length > 0;
          nav.dataset.navPinsAligned = aligned ? 'true' : 'false';

          if (aligned) {
            let dirty = false;
            rows.forEach((row, index) => {
              const label = row.getAttribute('aria-label') || '';
              if (label && labelCache[ids[index]] !== label) {
                labelCache[ids[index]] = label;
                dirty = true;
              }
            });
            if (dirty) writeJson(LABEL_KEY, labelCache);
          }

          for (const row of rows) {
            const wrap = rowWrap(row);
            let hide = false;
            if (aligned) {
              hide = hidden.indexOf(ids[rows.indexOf(row)]) >= 0;
            } else {
              const label = row.getAttribute('aria-label') || '';
              hide = label !== '' && hidden.some((id) => labelCache[id] === label);
            }
            if (hide) wrap.setAttribute(HIDDEN_ATTR, '');
            else wrap.removeAttribute(HIDDEN_ATTR);
          }
        };

        let collapsed = true;
        try { collapsed = window.localStorage.getItem(COLLAPSE_KEY) !== 'expanded'; } catch {}

        /**
         * 只在值真的变化时写属性。
         *
         * MutationObserver 监听的是 document.body 全树 + aria-label/class 属性；
         * 无脑 setAttribute 会不断产生新的 mutation 记录，重绘自己再触发自己，
         * 变成每帧一次的无意义空转。守卫后稳态是零写入。
         */
        const setAttr = (element, name, value) => {
          if (element.getAttribute(name) === value) return;
          element.setAttribute(name, value);
        };

        const paint = () => {
          for (const nav of managed) {
            setAttr(nav, 'data-nav-pins', collapsed ? 'collapsed' : 'expanded');
            setAttr(nav, 'data-sidebar-nav-collapsed', String(collapsed));
            const toggle = nav.querySelector(':scope > [' + TOGGLE_ATTR + ']');
            if (toggle) {
              setAttr(toggle, 'aria-expanded', String(!collapsed));
              setAttr(toggle, 'aria-label', collapsed ? '展开全局面板 / Expand global panels' : '折叠全局面板 / Collapse global panels');
            }
            applyHidden(nav);
            if (modal) {
              const note = modal.querySelector('.np-status');
              if (note) note.textContent = statusText;
              const warn = modal.querySelector('.np-warn');
              if (warn) warn.hidden = nav.dataset.navPinsAligned !== 'false';
            }
          }
        };

        const closeManager = () => {
          if (!modal) return;
          modal.remove();
          modal = null;
        };

        const openManager = () => {
          closeManager();
          const baseNav = managed.values().next().value;
          if (!baseNav) return;
          const ids = panelIds();
          const overlay = document.createElement('div');
          overlay.className = 'np-overlay';
          overlay.setAttribute('data-nav-pins-modal', '');
          const card = document.createElement('div');
          card.className = 'np-card';
          card.setAttribute('role', 'dialog');
          card.setAttribute('aria-modal', 'true');
          card.setAttribute('aria-label', '面板固定');
          const head = document.createElement('div');
          head.className = 'np-head';
          const title = document.createElement('h3');
          title.textContent = '面板固定';
          const closeBtn = document.createElement('button');
          closeBtn.type = 'button';
          closeBtn.className = 'np-close';
          closeBtn.setAttribute('aria-label', '关闭');
          closeBtn.textContent = '×';
          closeBtn.addEventListener('click', closeManager);
          head.append(title, closeBtn);
          const hint = document.createElement('p');
          hint.className = 'np-hint';
          hint.textContent = '取消勾选的面板会从侧栏收起，随时可以在这里恢复。选择会立即保存，重启 DSH 后仍然生效。';
          const list = document.createElement('div');
          list.className = 'np-list';
          if (ids.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'np-empty';
            empty.textContent = '还没有发现可固定的面板。';
            list.append(empty);
          }
          ids.forEach((id) => {
            const item = document.createElement('label');
            item.className = 'np-item';
            if (id === FIXED_PANEL_ID) item.setAttribute('data-nav-pins-locked', '');
            const box = document.createElement('input');
            box.type = 'checkbox';
            box.checked = hidden.indexOf(id) < 0;
            box.disabled = id === FIXED_PANEL_ID;
            box.addEventListener('change', () => { void setHidden(id, !box.checked); });
            const name = document.createElement('span');
            name.className = 'np-name';
            name.textContent = labelCache[id] || id;
            item.append(box, name);
            if (id === FIXED_PANEL_ID) {
              const lock = document.createElement('span');
              lock.className = 'np-lock';
              lock.textContent = '始终显示';
              item.append(lock);
            }
            list.append(item);
          });
          const foot = document.createElement('div');
          foot.className = 'np-foot';
          const note = document.createElement('span');
          note.className = 'np-status';
          note.textContent = statusText;
          const warn = document.createElement('span');
          warn.className = 'np-warn';
          warn.hidden = baseNav.dataset.navPinsAligned !== 'false';
          warn.textContent = '侧栏面板有临时变动，收起效果可能短暂不准；重新展开一次即可恢复。';
          foot.append(note, warn);
          card.append(head, hint, list, foot);
          overlay.append(card);
          overlay.addEventListener('pointerdown', (event) => { if (event.target === overlay) closeManager(); });
          document.body.append(overlay);
          modal = overlay;
          const first = list.querySelector('input:not([disabled])');
          if (first) first.focus();
        };

        const setHidden = async (id, hide) => {
          if (id === FIXED_PANEL_ID) return;
          const set = new Set(hidden);
          if (hide) set.add(id); else set.delete(id);
          hidden = sanitize([...set]);
          paint();
          await persist();
          paint();
        };

        const sync = () => {
          for (const nav of [...managed]) {
            if (!nav.isConnected) managed.delete(nav);
          }
          for (const nav of document.querySelectorAll(NAV_SELECTOR)) {
            if (!NAV_LABEL.test(nav.getAttribute('aria-label') || '')) continue;
            managed.add(nav);
            nav.dataset.navPins = collapsed ? 'collapsed' : 'expanded';
            if (!nav.querySelector(':scope > [' + TOGGLE_ATTR + ']')) {
              const toggle = document.createElement('button');
              toggle.type = 'button';
              toggle.setAttribute(TOGGLE_ATTR, '');
              // 两个箭头一次建好，显示交给 CSS（见上），避免重绘时改 innerHTML。
              toggle.innerHTML =
                '<svg data-nav-pins-caret="expand" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9l7 7 7-7"/></svg>' +
                '<svg data-nav-pins-caret="collapse" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 15l7-7 7 7"/></svg>';
              toggle.addEventListener('click', () => {
                collapsed = !collapsed;
                try { window.localStorage.setItem(COLLAPSE_KEY, collapsed ? 'collapsed' : 'expanded'); } catch {}
                paint();
              });
              nav.append(toggle);
            }
            if (!nav.querySelector(':scope > [' + MANAGER_ATTR + ']')) {
              const manager = document.createElement('button');
              manager.type = 'button';
              manager.setAttribute(MANAGER_ATTR, '');
              manager.setAttribute('aria-haspopup', 'dialog');
              manager.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5a4.5 4.5 0 0 0-4.5 4.5c0 4 2.2 5.6 3 9.6h3c.8-4 3-5.6 3-9.6A4.5 4.5 0 0 0 12 3.5Z"/></svg><span>固定面板</span>';
              manager.addEventListener('click', openManager);
              nav.append(manager);
            }
          }
          paint();
        };

        let pending = null;
        const observer = new MutationObserver((records) => {
          let relevant = false;
          for (const record of records) {
            const target = record.target;
            if (!target || target.nodeType !== 1) { relevant = true; break; }
            if (target.closest && target.closest('[data-nav-pins-modal]')) continue;
            relevant = true;
            break;
          }
          if (!relevant) return;
          if (pending !== null) return;
          pending = window.setTimeout(() => { pending = null; sync(); }, 0);
        });
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-label', 'class'] });

        let unsubscribe = null;
        if (form && typeof form.subscribe === 'function') {
          unsubscribe = form.subscribe(() => {
            if (loadFromConfig()) paint();
          });
        }

        const onKeyDown = (event) => {
          if (event.key !== 'Escape' || !modal) return;
          event.preventDefault();
          closeManager();
        };
        document.addEventListener('keydown', onKeyDown, true);

        sync();
        window.setTimeout(sync, 120);

        return () => {
          observer.disconnect();
          document.removeEventListener('keydown', onKeyDown, true);
          if (pending !== null) window.clearTimeout(pending);
          try { if (typeof unsubscribe === 'function') unsubscribe(); } catch {}
          closeManager();
          for (const nav of managed) {
            const toggle = nav.querySelector(':scope > [' + TOGGLE_ATTR + ']');
            const manager = nav.querySelector(':scope > [' + MANAGER_ATTR + ']');
            if (toggle) toggle.remove();
            if (manager) manager.remove();
            for (const node of nav.querySelectorAll('[' + HIDDEN_ATTR + ']')) node.removeAttribute(HIDDEN_ATTR);
            delete nav.dataset.navPins;
            delete nav.dataset.navPinsAligned;
            delete nav.dataset.sidebarNavCollapsed;
          }
          managed.clear();
          style.remove();
        };
      }, 'dsh-nav-pins: panel fold + pins');
    }

    module.exports.name = 'dsh-nav-pins-client';
    module.exports.inject = ['slots', 'configForms'];
    module.exports.apply = apply;
    return module.exports;
  },
});
