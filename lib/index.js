/**
 * dsh-nav-pins — Host 半身。
 *
 * 只做一件事：声明配置项 `hiddenPanels`（不在侧栏显示的面板 id 列表）。
 * 浏览器半身通过 ctx.configForms 读写它，DSH 会把值写进 profile 的
 * cordis.patch.yml，因此重启后仍然生效 —— 这正是不再"每次启动全部显示"的关键。
 *
 * 为什么是 .volatile()：schemastery 的非 volatile 字段一改会重启整个插件，
 * volatile 字段原地更新。固定集合是用户点一下就要立刻生效的小状态，必须 volatile。
 *
 * @module index.js
 */

import Schema from '@deepseek-ai/schemastery';

export const name = 'nav-pins';

export const Config = Schema.object({
  /** 不在侧栏面板列表里显示的面板 id（'plugins' 永远显示，不会被写进来）。 */
  hiddenPanels: Schema.array(String).default([]).volatile(),
});

export function apply() {}
