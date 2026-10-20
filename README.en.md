# dsh-think-zh-plus

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin with two halves:

1. **Chinese reasoning** — contributes a system-prompt section that asks the model to think in Simplified Chinese, with code, commands, paths and errors kept verbatim.
2. **Always-visible thinking** — a browser half that auto-expands every collapsed `Think` row in the Web UI and keeps thinking visually distinct from the final answer.

## Why

DSH's model usually reasons in English even when the user writes Chinese, and every reasoning row starts folded; a long Turn additionally folds its whole process block. This plugin makes the reasoning channel Chinese and keeps every Think row open, without touching React internals.

## Install

```sh
# from GitHub (works today)
dsh plugin --profile desktop add github:wuaisaber/dsh-think-zh-plus

# from npm, once published
dsh plugin --profile desktop add dsh-think-zh-plus
```

Use the profile that the app actually boots (`desktop` for DSH Desktop, `web` for `dsh web`). Restart the app or refresh the page afterwards.

To avoid DSH folding the whole completed Turn (not just the Think row), set the work-details mode to `verbose` in the profile patch:

```yaml
- id: ui-chat
  name: "@deepseek-ai/dsh-client-ui-chat"
  config:
    transcriptView: verbose
```

## Config

```yaml
- id: think-zh-plus
  name: dsh-think-zh-plus
  config:
    language: 简体中文   # any language name
    target: think        # think = reasoning only; all = reasoning + reply
    enabled: true
    verbatim: true       # keep code/commands/paths untranslated
    # instruction: custom text, overrides the default section
```

Section order is `-999` (right after the harness identity, before the persona) — a rule placed late in DSH's long English prompt was ignored in practice.

## Behaviour notes

- Auto-expansion clicks the row's own `data-disclosure-row` element, i.e. the component's supported toggle. It never calls React internals.
- A row the reader toggles by hand is remembered in a `WeakSet` and left alone.
- Injected style: an expanded Think block gets a thin left rule so it cannot be confused with the answer.
- Diagnostics: `window.__DSH_THINK_ZH_PLUS__` exposes `{ loadedAt, applied, scans, rowsSeen, expanded, lastError }`.
- Tested against DSH `0.2.1-rc.2` (DOM contract of `ReasoningRow` in `@deepseek-ai/dsh-client-ui-chat`).

## Development

```sh
node --test test/host.test.mjs test/client.test.mjs
```

## License

MIT. The host-half instruction text and config schema are adapted from [lance808/dsh-think-zh](https://github.com/lance808/dsh-think-zh) (MIT). The DOM contract follows DSH's own `ReasoningRow`; the client code is original.
