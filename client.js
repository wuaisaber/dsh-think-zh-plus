/**
 * dsh-think-zh-plus — client half.
 *
 * Expands every collapsed reasoning ("Think") row in the Web UI, so the live
 * thinking stream is readable without clicking each row. A row the reader
 * toggles by hand is left alone from then on: auto-expansion must not fight
 * the reader.
 *
 * DOM contract (DSH 0.2.1-rc.2, `ReasoningRow` in `@deepseek-ai/dsh-client-ui-chat`):
 *   root   div[data-variant="think"][data-state="running"|"ok"][data-expanded?]
 *   header div[data-disclosure-row][data-expandable][aria-expanded]
 * Clicking the header runs the row's own `onToggle`, i.e. the supported way
 * to open it from the DOM layer. No React internals are touched.
 *
 * Diagnostics: the module publishes `window.__DSH_THINK_ZH_PLUS__` with
 * `{ loadedAt, applied, scans, rowsSeen, expanded, lastError }` so a page
 * reload can be checked from the DevTools console without any build step.
 */
(function () {
  const state = {
    loadedAt: Date.now(),
    applied: false,
    scans: 0,
    rowsSeen: 0,
    expanded: 0,
    lastError: null,
  };
  if (typeof window !== "undefined") window.__DSH_THINK_ZH_PLUS__ = state;

  if (typeof window === "undefined") return;
  if (!window.__ModuleLoader__) {
    state.lastError = "__ModuleLoader__ missing";
    console.error("[dsh-think-zh-plus] window.__ModuleLoader__ is missing; the client half cannot register");
    return;
  }

  window.__ModuleLoader__.load({
    id: "dsh-think-zh-plus",
    factory: (require) => {
      const module = { exports: {} };

      const ROW_SELECTOR = '[data-variant="think"]';
      const HEADER_SELECTOR = "[data-disclosure-row][data-expandable]";
      /** Do not re-click a row that did not open within this window. */
      const RETRY_MS = 400;

      let observer = null;
      let scheduled = false;
      let installed = false;
      let userToggled = new WeakSet();
      let attemptedAt = new WeakMap();

      const STYLE_ID = "dsh-think-zh-plus";
      /**
       * Keep thinking visually distinct from the answer: an expanded Think
       * block gets a thin left rule, so a reader never confuses the reasoning
       * with the final reply. Token first, literal fallback for older themes.
       */
      const THINK_CSS =
        '[data-variant="think"][data-expanded]{border-left:2px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.28));padding-left:12px;margin-left:-2px;}';

      function injectStyle() {
        if (typeof document === "undefined" || !document.head) return;
        if (document.querySelector('style[data-plugin="' + STYLE_ID + '"]')) return;
        const style = document.createElement("style");
        style.setAttribute("data-plugin", STYLE_ID);
        style.textContent = THINK_CSS;
        document.head.appendChild(style);
      }

      function isExpanded(root) {
        return root.hasAttribute("data-expanded");
      }

      function expand(root) {
        if (userToggled.has(root) || isExpanded(root)) return;
        const header = root.querySelector(HEADER_SELECTOR);
        if (!header) return;
        if (header.getAttribute("aria-expanded") === "true") return;
        const now = Date.now();
        const last = attemptedAt.get(root) || 0;
        if (now - last < RETRY_MS) return;
        attemptedAt.set(root, now);
        header.click();
        state.expanded += 1;
      }

      function scan() {
        scheduled = false;
        if (typeof document === "undefined" || !document.body) return;
        state.scans += 1;
        const rows = document.querySelectorAll(ROW_SELECTOR);
        state.rowsSeen = rows.length;
        for (let i = 0; i < rows.length; i += 1) expand(rows[i]);
      }

      function schedule() {
        if (scheduled) return;
        scheduled = true;
        const raf =
          typeof requestAnimationFrame === "function"
            ? requestAnimationFrame
            : (callback) => setTimeout(callback, 0);
        raf(scan);
      }

      /** A reader gesture on a Think header opts that row out for good. */
      function onReaderGesture(event) {
        const target = event.target;
        if (!target || typeof target.closest !== "function") return;
        const header = target.closest(HEADER_SELECTOR);
        if (!header) return;
        const root = header.closest(ROW_SELECTOR);
        if (root) userToggled.add(root);
      }

      function onKeyDown(event) {
        if (event.key !== "Enter" && event.key !== " ") return;
        onReaderGesture(event);
      }

      function start() {
        if (installed || typeof document === "undefined") return;
        if (!document.body) {
          document.addEventListener("DOMContentLoaded", start, { once: true });
          return;
        }
        installed = true;
        userToggled = new WeakSet();
        attemptedAt = new WeakMap();
        injectStyle();
        document.addEventListener("pointerdown", onReaderGesture, true);
        document.addEventListener("keydown", onKeyDown, true);
        observer = new MutationObserver(schedule);
        observer.observe(document.body, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ["data-state", "data-expanded"],
        });
        scan();
        setTimeout(scan, 0);
        setTimeout(scan, 300);
      }

      function stop() {
        installed = false;
        if (observer !== null) {
          observer.disconnect();
          observer = null;
        }
        if (typeof document !== "undefined") {
          document.removeEventListener("pointerdown", onReaderGesture, true);
          document.removeEventListener("keydown", onKeyDown, true);
        }
      }

      /**
       * Client entry point: installs the observer for the lifetime of the
       * client entry (the loader disposes it on unload / update).
       */
      function apply(ctx) {
        if (typeof document === "undefined") return undefined;
        state.applied = true;
        try {
          const setup = () => {
            start();
            return stop;
          };
          if (ctx && typeof ctx.effect === "function") {
            return ctx.effect(setup, "dsh-think-zh-plus: expand Think rows");
          }
          return setup();
        } catch (error) {
          state.lastError = String(error && error.stack ? error.stack : error);
          console.error("[dsh-think-zh-plus] apply failed", error);
          return undefined;
        }
      }

      module.exports.apply = apply;
      module.exports.inject = [];
      return module.exports;
    },
  });
})();
