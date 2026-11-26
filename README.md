# dsh-nav-pins — 侧栏面板：一条细线收起，固定选择永久记住

把 DSH 左侧「全局面板」那一列收成一条细线 —— 点一下收成一排图标，再点一下回到熟悉的列表。
更关键的是：**哪些面板固定、哪些收起，选择会真的落盘，重启 DSH 之后还是你上次的样子。**

- 适合谁：面板很多、侧栏太长、每次启动都要重新摆一遍的用户。
- 解决什么：DSH 自带的 panel pin 是**纯内存**的（插件重载 / 重启就回到全部显示），本插件把这份选择交给 DSH 的配置服务，写进 profile 的 `cordis.patch.yml`，重启不丢。

---

## 界面截图

<img src="docs/screenshots/nav-pins.png" width="254" alt="侧栏面板与折叠细线">

> 上图为真机实拍（本机 DSH 桌面版）。截图里的账号名、ID、发送记录已做像素化处理，只保留界面结构。

> 只想快点装起来？直接看根目录的 [INSTALL.txt](INSTALL.txt)：三步安装 + 三处验证 + 配置在哪 + 怎么卸。

---

## 目录

- [界面截图](#界面截图)
- [它做了什么](#它做了什么)
- [零基础安装](#零基础安装)
- [第一次使用（三步）](#第一次使用三步)
- [逐项功能说明](#逐项功能说明)
- [完整操作示例](#完整操作示例)
- [配置文件详解](#配置文件详解)
- [工作原理（技术参考）](#工作原理技术参考)
- [排错手册](#排错手册)
- [FAQ](#faq)
- [版本更新简介](#版本更新简介)
- [已知限制与安全说明](#已知限制与安全说明)
- [目录结构 / 开发 / 许可](#目录结构--开发--许可)

---

## 它做了什么

| 能力 | 表现 |
| --- | --- |
| 折叠细线 | 面板列表底部有一条细线（两侧渐隐 + 一个箭头）。点它，面板收成一排 36px 图标；再点一下，回到带文字的列表。折叠/展开状态本机记住。 |
| 固定管理 | **展开时**列表里有一个「📌 固定面板」入口，点开是勾选弹窗；取消勾选的面板立刻从侧栏收起。 |
| 折叠时无固定按键 | 收成图标行时，「固定面板」入口与每行的取消固定按钮**都消失**（`display:none`，不是透明）。 |
| 永久记住 | 勾选结果写入插件配置 `hiddenPanels`，落盘到 profile 的 `cordis.patch.yml`。重启 DSH 后依然生效。 |
| 「插件」面板不可收起 | 对应 DSH 的 `FIXED_PANEL_ID = 'plugins'`，弹窗里标注「始终显示」，复选框禁用。 |

> 说明：本插件**不**调用 DSH 自己的内存 pin（`setPinned`）。它自己维护一份 `hiddenPanels` 并用 DOM 隐藏面板行，所以宿主怎么重置 pin 都不影响你的持久化选择。

---

## 零基础安装

本插件是本地插件（`link:` 方式），跟 `@duma520/dsh-push-hub` 等同一套路。

1. **确认文件在位**：`<插件根目录>\dsh-nav-pins\package.json` 存在。
2. **在 profile 里登记依赖**：编辑 `<用户目录>\.dsh\profiles\desktop\package.json`
   - `dependencies` 里加一行：`"@duma520/dsh-nav-pins": "link:<插件根目录>/dsh-nav-pins",`
   - `dsh.profile.bundles` 数组里加一项：`"@duma520/dsh-nav-pins",`
3. **建符号链接**（让 node 能解析包名）：
   `<用户目录>\.dsh\profiles\desktop\node_modules\@duma520\dsh-nav-pins` → `<插件根目录>\dsh-nav-pins`
   （Windows 用 junction 即可，不需要管理员权限。）
4. **加实例到 profile 配置**：编辑 `<用户目录>\.dsh\profiles\desktop\cordis.patch.yml`，在任意一个兄弟实例旁边加：

   ```yaml
   - id: nav-pins
     name: "@duma520/dsh-nav-pins"
     config:
       hiddenPanels: []
   ```

5. **重启 DSH**（不是刷新页面，是退出再开）。

> ⚠️ `id: nav-pins` 这个 id 是硬约定：浏览器半身用它去 `ctx.configForms.get('nav-pins')` 取配置。**改了 id 必须同步改 `lib/client.js` 里的 `ENTRY_ID`**，否则配置永远读不到，会退回本机 localStorage 兜底。

如果之前装过 `dsh-nav-fold`：请从 `dependencies`、`dsh.profile.bundles`、`cordis.patch.yml` 三处一起摘掉（本插件已取代它）。两套同时启用会导致两套折叠按钮互相打架。

---

## 第一次使用（三步）

1. 打开 DSH，看左侧面板列表底部 —— 应该有一条**两侧渐隐的细线**，中间一个小箭头。
2. **点细线**：面板收成一排图标。此时**没有**任何固定按钮（这是设计）。
3. **再点一次细线**（箭头朝上）：回到带文字的列表；列表里多出「📌 固定面板」一行；点它，勾选你想留在侧栏的面板。

---

## 逐项功能说明

### 细线（`button[data-nav-pins-toggle]`）

| 项 | 取值 | 推荐 | 什么时候改 |
| --- | --- | --- | --- |
| 折叠 / 展开 | 点一下切换 | 面板多就默认折叠 | —— |
| 记忆位置 | `localStorage['dsh-nav-pins:collapsed']` = `collapsed` / `expanded` | 不用管 | 想恢复默认折叠：删掉这个键 |
| 无障碍标签 | `aria-label` = 「展开全局面板 / Expand global panels」或「折叠全局面板 / Collapse global panels」 | —— | —— |
| 初始态 | 默认 `collapsed`（收成图标） | —— | —— |
| 折叠态排版 | 槽宽固定 36px，flex 换行、**每行各自居中**，一行放几个由浏览器按侧栏宽度自己算（纯 CSS，无 JS 参与） | 不用管 | —— |
| 折叠态「更多」位置 | 与其他面板**同一套 36px 槽位**，跟着换行、跟队对齐 | 不用管 | —— |
| 折叠态隐藏项 | 直接不占位（`display: none`），该行自动重新均分居中 | 不用管 | 想临时看回被收起的面板：展开后「📌 固定面板」里勾回来 |
| 折叠态行尾角标 | 宿主行尾那一格（`panelTrailing`，未读角标/快捷键提示）改为绝对定位，不占位 | 不用管 | —— |

#### 折叠态为什么不会再「位置偏移」

早期版本折叠态用的是 `grid-template-columns: repeat(auto-fit, 36px)` + `justify-content: space-evenly`：
侧栏越宽，多余空闲被均匀撒到图标之间，5 个图标就被摊满整条侧栏；侧栏变窄时列数还会跳变。
现在改成五件事：

1. **固定 36px 槽 + flex 换行、每行独立居中**（纯 CSS，`flex-wrap: wrap` + `justify-content: center`）。
   一行能放几个由浏览器按侧栏内宽自己算，拖动窗口即时重排，不需要 JS 量宽度、不写任何 CSS 变量。
   侧栏窄到一行只放 3 个时，每行依然各自居中，不会整块贴左。
2. **宿主「更多」按钮纳入同一套槽位**。宿主的「更多」是 `span.JGoLlq_root.wtg9ga_moreAnchor > button.panelRow`
   （Menu 原语的根 `<span>`，自带 `display: inline-flex`），和其它面板的 `div.panelEntry > button.panelRow`
   **不是同一种盒子**，早期只给 `panelEntry` 定槽宽，它便按内容宽度落格。
   现在 `panelEntry` 与 `moreAnchor` 共用同一条 36px 槽规则，两者严丝合缝排在同一列上。
3. **折叠态把行尾 `panelTrailing` 也脱离文档流**。宿主自己的折叠样式是
   `.wtg9ga_collapsed .panelTrailing{position:absolute;top:5px;right:5px}`，但它要求**侧栏本身**带宿主的 `_collapsed` 类；
   本插件折叠的是 `panelList`，侧栏不是宿主折叠态，于是这条规则不生效 —— `panelTrailing` 仍以 `position: static`
   占着 30px 左右宽度，把 `button` 里 `justify-content: center` 的图标整体挤到左边半槽（实测 glyph 中心比槽中心左偏 8~10px）。
   **这才是「图标看着不齐」的真正原因**：普通面板都被挤左，唯独宿主的「更多」按钮没有 trailing，于是它反而是唯一居中的那个。
   现在插件自己补上 `position: absolute; top: 5px; right: 5px`。
4. **折叠态隐藏面板直接不占位**（`[data-nav-pins-hidden] { display: none !important }`）。
   视觉上删掉槽位后，这一行由 flex 自己重新均分居中，其余图标不会整体位移。
   早期为了「grid 固定列数不整体位移」用过 `visibility: hidden` 保留空槽，那在 flex 换行下反而会在行首/行中留下空洞，
   看起来像「图标被拆成两半」——已经删掉。
5. **挂载先清旧样式**。DSH 的客户端热重建（HMR）不保证调用上一次 effect 的清理函数，
   历史版本留在 `<head>` 里的 `style[data-plugin-css="dsh-nav-pins"]` 会一直叠着；
   旧规则特异性更高时会盖掉新规则（踩过：折叠态隐藏项改成 `display: none` 后真机不生效，就是被三份旧样式盖掉的）。
   现在 `apply()` 一开始就把同名旧 `<style>` 全部移除，只保留本次这一份。

高亮盒子也一并修了：宿主 `.panelEntryActive` 把背景挂在**外层** `.panelEntry` 上，而图标在**里层** `.panelRow`，
且 `.panelEntry` 带 `border-inline: var(--dsh-sidebar-paint-inset)` + `background-clip: padding-box`，背景被内缩一圈。
折叠态现在把 `border-inline-width` 归零、`background-clip` 改回 `border-box`，高亮直接挂到 `button[panelRow]`（36×36、圆角 8），
和图标严格同盒同心。

> **测量提示（写给以后的自己）**：判断折叠态图标是否对齐，必须读 `getBoundingClientRect()`，
> 不要拿截图里「暗像素连续段的中心」当图标中心。`⊞+` 由两个方块加右上加号组成，墨迹重心天然右偏，
> 于是像素重心会报出「『更多』偏右半个槽」——而真实情况完全相反：**是普通面板被 `panelTrailing` 挤左了半槽，
> 「更多」因为没 trailing 才是唯一居中的那个**。这个坑本轮踩了两遍：先被像素重心误导去查「更多为什么偏右」，
> 后来挂调试浮层打印每一个 `nav.children` 的 rect 才对上。结论：**怀疑对不齐时，先打印 rect，别先量像素。**

### 「📌 固定面板」入口（`button[data-nav-pins-manager]`）

- **只在展开态出现**；折叠态 CSS `display:none`。
- 点开一个居中弹窗，逐面板一行复选框：
  - 勾上 = 面板留在侧栏（= 不在 `hiddenPanels` 里）
  - 取消 = 面板从侧栏收起（= 加进 `hiddenPanels`）
- 「插件 / Plugins」一行带「始终显示」，复选框禁用。
- 每次勾选**立即**写盘，弹窗底部会显示「已保存到插件配置，重启后继续生效。」或降级提示。
- `Esc` 或点遮罩关闭。

### 隐藏的宿主按钮

| 宿主元素 | 处理 | 为什么 |
| --- | --- | --- |
| 每行「取消固定」按钮（`class*="panelUnpin"`） | `display:none !important` | 它默认 `opacity:0`、hover 才显形；折叠成图标时若仍能 hover 出现，就是用户抱怨的「细线上出现是否固定按键」。用 `display:none` 才能彻底不出现。 |
| 自带「更多」菜单里的固定行 | （本插件不隐藏） | 本插件用 id 精确匹配，用户若从那里操作也不会制造重复勾选；但两份状态互不影响，建议统一用本插件的弹窗。 |

---

## 完整操作示例

### 场景 1 · 只想让侧栏短一点（最简单）

面板 8 个，只想留 3 个。

1. 点细线展开列表（若当前是展开态，跳过）。
2. 点「📌 固定面板」。
3. 取消勾选不想要的 5 个 → 它们立刻消失。
4. 关掉弹窗，点细线收成图标。
5. 重启 DSH → 侧栏还是这 3 个。

### 场景 2 · 换着用（常见组合）

白天要「会话 + 文件」，晚上做插件开发要「插件 + 设置」。

1. 打开弹窗，把白天不需要的取消 → 保存。
2. 要做别的事时再打开弹窗重新勾。
3. 每次都会立刻落盘，不用点「保存」按钮（也没有这个按钮）。

### 场景 3 · 键盘操作（进阶）

1. `Tab` 走到细线 → `Enter` 折叠。
2. `Tab` 走到「固定面板」→ `Enter` 打开弹窗。
3. 弹窗打开时焦点自动落在第一个可用复选框；`Space` 勾选；`Esc` 关闭。

---

## 配置文件详解

### `<插件根目录>\dsh-nav-pins\cordis.patch.yml`

```yaml
- insert:
    - id: nav-pins
      name: '@duma520/dsh-nav-pins'
      config:
        hiddenPanels: []
```

### 插件配置字段（Host 半身 `lib/index.js`）

| 字段 | 类型 | 默认 | 取值 | 改错会怎样 |
| --- | --- | --- | --- | --- |
| `hiddenPanels` | `string[]`（`Schema.array(String)`，`.volatile()`） | `[]` | 面板 id 列表，例如 `["files","plugins"]` 的**反集**语义：在里面 = 收起 | 写进不存在的 id 只是无效项（不报错）；写 `"plugins"` 会被前半身 sanitize 掉 |

> `.volatile()` 是必须的：schemastery 的非 volatile 字段一改会**重启整个插件**；volatile 字段原地更新。用户勾一下就重启插件显然不可接受。

### 落盘后的样子（`<用户目录>\.dsh\profiles\desktop\cordis.patch.yml`）

```yaml
- id: nav-pins
  name: "@duma520/dsh-nav-pins"
  config:
    hiddenPanels:
      - files
      - sessions
```

### 本机兜底存储（配置服务不可用时才用）

| 键 | 值 |
| --- | --- |
| `dsh-nav-pins:collapsed` | `"collapsed"` / `"expanded"` |
| `dsh-nav-pins:hiddenPanels` | JSON 数组，如 `["files"]` |
| `dsh-nav-pins:labels` | `{面板id: 标题}` 缓存，用于宿主过滤行时按标题兜底匹配 |

---

## 工作原理（技术参考）

### 挂载

```js
window.__ModuleLoader__.load({ id: '@duma520/dsh-nav-pins', factory: (require) => { ... } });
module.exports.inject = ['slots', 'configForms'];
module.exports.apply = apply;
```

`apply(ctx)` 整体包在 `ctx.effect(() => {...}, 'dsh-nav-pins: panel fold + pins')` 里，返回的 cleanup 会卸掉 Observer、监听、注入的按钮与 `<style>`。

### 定位目标导航

```js
const NAV_SELECTOR = 'nav[class*="panelList"]';
const NAV_LABEL = /^(全局面板|Global panels)$/;
```

CSS `class` 用**子串匹配**（`[class*="panelRow"]`），不依赖 hash 前缀，宿主升级改 hash 也不会立刻失效。

### 面板 id ↔ DOM 行对齐

1. `ctx.slots.entriesOfSlot('sidebar.panellist')` 取注册项，按 `options.order` 升序 → id 数组（与宿主内部 `panels` store 的排序一致）。
2. DOM 侧取 `button[class*="panelRow"]`，**排除** `aria-haspopup`（宿主的「更多」按钮）与本插件插入的两个按钮。
3. 数量相等 → 按下标一一对应；数量不等（宿主按内存 unpinned 过滤了行）→ 用 `labels` 缓存按 `aria-label` 兜底匹配，并在弹窗里提示「收起效果可能短暂不准」。

### 持久化

```js
const form = ctx.configForms.get('nav-pins');
const snap = form.getSnapshot();        // { status:'ready', value:{ hiddenPanels: [...] }, writable, revision }
await form.set('hiddenPanels', list);   // Promise<boolean>，false = 写入失败
form.subscribe(() => { /* 外部改动时同步 */ });
```

写入最终走 `ctx.remote.settings.mutate(namespace, ops, revision)`，由 DSH 落盘到 profile 配置。`form.set` 返回 `false` 时本插件会退回 `localStorage` 并在弹窗里说明。

### 变更监听

`MutationObserver(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:['aria-label','class'] })` + 去抖（`setTimeout(0)`）→ `sync()`。侧栏重渲染时会自动补回按钮并重新套用隐藏。

---

## 排错手册

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| 侧栏底部没有细线 | 插件没加载 | 查 `cordis.patch.yml` 是否有 `- id: nav-pins`；查 `node_modules/@duma520/dsh-nav-pins` 链接是否存在；重启 DSH |
| 有细线，但点「固定面板」弹窗是空的 | `entriesOfSlot('sidebar.panellist')` 还没注册完 | 折叠再展开一次；或重启；仍旧空说明侧栏插件版本变了 |
| 勾选后重启又全部显示 | 配置没写进去（`form.set` 返回 false） | 看弹窗底部提示；检查 `cordis.patch.yml` 是否有 `hiddenPanels:`；确认实例 id 是 `nav-pins`（不是别的） |
| 折叠时还能看到固定按钮 | CSS 被覆盖 | 确认 `<style data-plugin-css="dsh-nav-pins">` 在 `<head>` 里；本插件用 `display:none !important`，优先级已最高 |
| 收起的面板又冒出来 | 宿主重新渲染了那一行 | 正常情况下 Observer 会补；若持续出现，看 `nav.dataset.navPinsAligned` 是否为 `false` |
| 出现两个折叠按钮 | `dsh-nav-fold` 没摘干净 | 从 `dependencies` / `bundles` / `cordis.patch.yml` 三处一起删 |

日志在哪：DSH 桌面版日志在 `%APPDATA%\@deepseek-ai\dsh-desktop\`；浏览器半身的报错在 DevTools Console（本机启动参数没有 `--remote-debugging-port`，需人工开 DevTools）。

---

## FAQ

1. **和 `dsh-nav-fold` 能共存吗？** 不能，两个都会往面板列表插按钮。本插件已取代它。
2. **为什么不直接用宿主自带的 pin？** 因为它是 `createPanelPins()` 纯内存实现，插件重载就清空 —— 正是「每次启动都全部显示」的根因。
3. **固定集合存在哪？** 优先 `cordis.patch.yml` 的 `hiddenPanels`；配置服务不可用时退回 `localStorage['dsh-nav-pins:hiddenPanels']`。
4. **「插件」面板能收起吗？** 不能。宿主 `FIXED_PANEL_ID = 'plugins'`，强行收起会让设置入口消失。
5. **折叠状态也会持久化吗？** 会，存 `localStorage['dsh-nav-pins:collapsed']`，默认 `collapsed`。
6. **支持远程控制页吗？** 本插件作用于侧栏面板列表；RDS 侧若渲染同一侧栏，同样生效。
7. **面板改名后选择会丢吗？** 不会。存储的是 id 不是标题；标题缓存只用于兜底匹配。
8. **能拖动排序吗？** 本版本不做排序（`dsh-nav-fold` 有），避免与其拖拽逻辑冲突。
9. **勾选后需要点保存吗？** 不需要，也没有保存按钮（实时落盘）。
10. **卸载会留下什么？** `cordis.patch.yml` 里那 4 行实例块 + 3 个 localStorage 键。删掉即可。

---

## 版本更新简介

> **开源发布**：本仓库于 2026-11-21 首次公开，内容与 v0.1.1 一致（版本号未变，仅做脱敏与发布动作，按归档号记录）。
>
> **最新发布**：[v0.1.4 Release](https://github.com/duma520/dsh-nav-pins/releases/tag/v0.1.4)（2026-11-26 发布，资产 `dsh-nav-pins-0.1.4.zip`）。详见[软件升级迭代记录](软件升级迭代记录.md)对应段。
>
> **重启复核**：2026-11-26 真实重启 DSH 后重新测量折叠态 —— 6 个槽间距恒 36px、整块居中、高亮与图标偏差 0.5px、展开切换正常。折叠态去重、隐藏项不留洞在全新进程里同样成立。

| 版本 | 日期 | 一句话变更 |
| --- | --- | --- |
| v0.1.4 | 2026-11-25 | 三重修复：① 折叠态隐藏面板改为直接不占位（不再留空洞）；② 挂载时清掉热重建残留的旧 `<style>`（旧规则曾盖掉新规则）；③ 折叠态给行尾角标 `panelTrailing` 补绝对定位 —— 它原本以 `position: static` 占 33px 把图标挤偏半槽，这才是「看着不齐」的真根因。回归 227 项 |
| v0.1.3 | 2026-11-25 | 折叠态改用 flex 换行 + 每行独立居中，宿主的「更多」按钮纳入同一套 36px 槽位；删掉 `syncCols`/`ResizeObserver` 等一套 JS 量宽度逻辑。回归 207 项（注：本版曾误判「更多偏出 40~50px」，实为像素测量误差，详见 v0.1.4） |
| v0.1.2 | 2026-11-25 | 修复折叠态图标「位置偏移」：列数改按侧栏实测宽度算（不再 `space-evenly` 撒满全宽），隐藏面板留空位不塌缩，高亮背景改挂 `panelRow` 与图标同心；新增 `ResizeObserver` 跟随宽度重算。回归 203 项 |
| v0.1.1 | 2026-11-20 | 修复：折叠箭头改为 CSS 双图切换、属性写入加同值守卫，消除自触发重绘空转；新增无头冒烟测试（155 项） |
| v0.1.0 | 2026-11-20 | 首版：细线折叠 + 折叠态无固定按键 + 「固定面板」弹窗 + `hiddenPanels` 落盘持久化 |

---

## 已知限制与安全说明

- **依赖宿主 DOM 结构**：靠 `class*="panelList"` / `panelRow` / `panelEntry` / `aria-label`。宿主大改 DOM 时需要跟进。
- **行对齐依赖数量相等**：宿主若按内存 unpinned 过滤掉行，会用标题缓存兜底，可能短暂不准（弹窗会提示）。
- **不接管宿主「更多」菜单里的固定行**：那份状态是内存的，与插件无关；建议只用本插件弹窗。
- **安全**：不联网、不读凭据、不写文件；只读写自己的配置字段与三个 localStorage 键。

---

## 目录结构 / 开发 / 许可

> **开源仓库说明**：本仓库只放插件本体（`lib/`、`cordis.patch.yml`、`package.json`、`README.md`、`docs/`、`LICENSE`、`config.example.json`、迭代记录与界面截图）。**`scaffold/`（开发探针与回归脚本）和 `version/`（历次备份快照）不在仓库里** —— 它们绑定本机路径、本机真实账号与历史数据，公开即泄露。下文凡是 `node scaffold/...` 之类的命令都只在作者本机跑得通，clone 本仓库后这些文件并不存在。

```
dsh-nav-pins/
├── package.json          # dsh.bundle.patch + dsh.client 声明
├── cordis.patch.yml      # 挂载 Host 半身的 insert 段
├── lib/
│   ├── index.js          # Host 半身：Schema 配置项
│   └── client.js         # 浏览器半身：折叠 + 固定弹窗 + 落盘
├── scaffold/
│   └── smoke_test.cjs    # 无头冒烟测试（最小 DOM 影子对象，不装依赖）
├── README.md
├── 软件升级迭代记录.md
└── version/              # 历次改动备份
```

- 语法自检：`node --check lib/index.js && node --check lib/client.js`
- 回归测试：`node scaffold/smoke_test.cjs`（应输出「检查项 227 条，失败 0 条 / 结果：ALL PASS」）
- 无构建步骤（手写 ModuleLoader bundle，零依赖）。
- 许可：AGPL-3.0（见下文「许可」小节）。

> 冒烟测试只覆盖逻辑与 DOM 契约（注入、对齐、隐藏、写盘、清理）；细线的视觉外观与图标排布必须在 GUI 里人工目视，测试里没有 CSS 引擎。

## 许可

本项目采用 **GNU Affero General Public License v3.0（AGPL-3.0）** 发布。

- 完整许可证条文见仓库根目录 [LICENSE](LICENSE)。
- 你可以自由使用、修改、分发，包括用于商业用途，无需另行获得授权。
- 若你修改后分发，或以网络服务方式提供本软件，必须按 AGPL-3.0 公开相应源代码。
- 本仓库自 2026-11-23 起改用 AGPL-3.0；此前已按 MIT / BSD-3-Clause 发布的版本，其接收者依原许可证获得的授权继续有效。
