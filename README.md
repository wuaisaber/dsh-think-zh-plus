# dsh-think-zh-plus

[English](README.en.md) | 中文

一个插件同时做两件事：

1. **中文思考**：向每个请求的 system prompt 注入一段语言规则（order `-999`，紧跟身份段、在所有人设/工具说明之前），要求内部推理使用简体中文，代码/命令/路径/报错原样保留。
2. **思考常显**：浏览器端用 `MutationObserver` 监听对话区，把折叠状态的 `Think` 行自动点开；流式输出时思考内容实时可见。你手动折叠/展开过的行会被记住，插件不再碰它。展开的思考块会加一条左侧细线，和最终回复区分开。

## 和另外两个插件的关系

| | dsh-think-zh | dsh-plugin-think-zh | 本插件 |
|---|---|---|---|
| 中文思考 | system prompt 段落（全局） | 拷贝一份 `code` 预设 | system prompt 段落（全局） |
| 自动展开 | 无 | 有（DOM 补丁） | 有（DOM 补丁） |
| 安装 | GitHub / 本地 | 手工跑 `install.ps1`、改配置 | 本地目录，`dsh plugin add` |
| 作用范围 | 所有会话、子代理 | 仅新建且选中该预设的会话 | 所有会话、子代理 |

**不要和 dsh-think-zh 同时装**：两者都注册 `agent:reasoning-language` 段落，会重复注入。

## 安装

```powershell
# 从 GitHub 安装（现在就能用）
dsh plugin --profile desktop add github:wuaisaber/dsh-think-zh-plus

# 从 npm 安装（发布后）
dsh plugin --profile desktop add dsh-think-zh-plus
```

`--profile` 用应用实际启动的那个：DSH Desktop 是 `desktop`，`dsh web` 是 `web`。装完重启应用或刷新页面。

### 让整个 Turn 不折叠

DSH 的 `standard`/`detailed` 模式会在 Turn 结束后折叠整段处理过程。把工作详情模式改成 `verbose`（唯一不折叠的模式），思考才会像回复一样直接铺在对话流里：

```yaml
- id: ui-chat
  name: "@deepseek-ai/dsh-client-ui-chat"
  config:
    transcriptView: verbose
```

### 本地开发安装

```powershell
dsh plugin --profile desktop add "file:<你的路径>/dsh-think-zh-plus"
```

## 配置

在 `<DSH_HOME>/profiles/desktop/cordis.patch.yml` 里覆盖（用户 patch 层，升级不丢）：

```yaml
- id: think-zh-plus
  config:
    language: 简体中文
    target: think      # think = 只约束思考；all = 思考 + 回复都强制
    enabled: true
    verbatim: true     # 代码/命令/路径不翻译
    # instruction: 自定义整段文案（设置后覆盖默认文案）
```

## 自动展开的边界

- 只处理 `[data-variant="think"]` 且未展开（无 `data-expanded`）的行；点击的是行自带的 `[data-disclosure-row][data-expandable]`，走组件自己的 `onToggle`，不碰 React 内部状态。
- 你**手动**点过（pointerdown / Enter / Space）的行会加入 `WeakSet`，之后不再自动展开——避免"想收起来却被立刻弹开"。
- 插件卸载 / 热更新时通过 `ctx.effect` 的 disposer 断开观察器并移除监听。
- 依赖的 DOM 契约来自 DSH 0.2.1-rc.2 的 `ReasoningRow`（`data-variant="think"`、`data-state`、`data-expanded`、`data-disclosure-row`、`aria-expanded`）。DSH 大版本升级后若 UI 结构变化，需要同步改 `client.js`。

## 卸载

```powershell
dsh plugin --profile desktop remove dsh-think-zh-plus
```

## 开发 / 测试

```powershell
node --test test/host.test.mjs test/client.test.mjs
```

- `test/host.test.mjs`：配置 schema、文案、section order、disposer。
- `test/client.test.mjs`：用最小 DOM mock 验证首屏展开、后续行展开、手动折叠后不再打扰、卸载后停止。

## 许可

MIT。Host 半段（system prompt 文案与配置 schema）改编自 [lance808/dsh-think-zh](https://github.com/lance808/dsh-think-zh)（MIT）；自动展开的 DOM 契约参考了 [cygrtt/dsh-plugin-think-zh](https://github.com/cygrtt/dsh-plugin-think-zh)（MIT）与 [dsh-think-ux](https://www.npmjs.com/package/dsh-think-ux)（MIT），代码为本仓库重写。
