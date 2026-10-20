import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const SOURCE = readFileSync(new URL("../client.js", import.meta.url), "utf8");

class El {
  constructor(tag = "div") {
    this.tag = tag;
    this.attrs = new Map();
    this.children = [];
    this.parent = null;
    this.listeners = new Map();
  }

  setAttribute(name, value) {
    this.attrs.set(name, String(value));
  }

  getAttribute(name) {
    return this.attrs.has(name) ? this.attrs.get(name) : null;
  }

  hasAttribute(name) {
    return this.attrs.has(name);
  }

  removeAttribute(name) {
    this.attrs.delete(name);
  }

  append(child) {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  removeEventListener(type, handler) {
    const list = this.listeners.get(type);
    if (!list) return;
    const index = list.indexOf(handler);
    if (index >= 0) list.splice(index, 1);
  }

  matches(selector) {
    if (selector === '[data-variant="think"]') {
      return this.getAttribute("data-variant") === "think";
    }
    if (selector === "[data-disclosure-row][data-expandable]") {
      return this.hasAttribute("data-disclosure-row") && this.hasAttribute("data-expandable");
    }
    throw new Error(`unsupported selector in test DOM: ${selector}`);
  }

  closest(selector) {
    let node = this;
    while (node !== null) {
      if (node.matches(selector)) return node;
      node = node.parent;
    }
    return null;
  }

  querySelector(selector) {
    for (const child of this.children) {
      if (child.matches(selector)) return child;
      const found = child.querySelector(selector);
      if (found !== null) return found;
    }
    return null;
  }

  click() {
    for (const handler of this.listeners.get("click") ?? []) handler({ target: this });
  }
}

function walk(node, visit) {
  visit(node);
  for (const child of node.children) walk(child, visit);
}

function createEnvironment() {
  const listeners = new Map();
  const document = {
    body: new El("body"),
    createElement: (tag) => new El(tag),
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(handler);
    },
    removeEventListener(type, handler) {
      const list = listeners.get(type);
      if (!list) return;
      const index = list.indexOf(handler);
      if (index >= 0) list.splice(index, 1);
    },
    querySelectorAll(selector) {
      const found = [];
      walk(document.body, (node) => {
        if (node !== document.body && node.matches(selector)) found.push(node);
      });
      return found;
    },
    dispatch(type, event) {
      for (const handler of [...(listeners.get(type) ?? [])]) handler(event);
    },
  };

  const observers = [];
  class FakeMutationObserver {
    constructor(callback) {
      this.callback = callback;
      this.disconnected = false;
      observers.push(this);
    }
    observe() {}
    disconnect() {
      this.disconnected = true;
    }
    trigger() {
      if (!this.disconnected) this.callback([]);
    }
  }

  const state = { factory: null, clicks: 0 };
  const window = {
    __ModuleLoader__: {
      load(options) {
        state.factory = options.factory;
        state.id = options.id;
      },
    },
  };

  const context = createContext({
    window,
    document,
    MutationObserver: FakeMutationObserver,
    requestAnimationFrame: (callback) => callback(),
    setTimeout: (callback) => {
      callback();
      return 0;
    },
    console,
  });
  runInContext(SOURCE, context);

  const module = state.factory(() => ({}));
  return { module, document, observers, state };
}

function makeRow() {
  const root = new El();
  root.setAttribute("data-variant", "think");
  root.setAttribute("data-state", "running");
  const header = root.append(new El());
  header.setAttribute("data-disclosure-row", "");
  header.setAttribute("data-expandable", "");
  header.setAttribute("aria-expanded", "false");
  header.addEventListener("click", () => {
    const expanded = header.getAttribute("aria-expanded") === "true";
    header.setAttribute("aria-expanded", String(!expanded));
    if (expanded) root.removeAttribute("data-expanded");
    else root.setAttribute("data-expanded", "");
  });
  return { root, header };
}

test("expands rows rendered before the plugin booted", () => {
  const env = createEnvironment();
  const first = makeRow();
  env.document.body.append(first.root);
  let clicks = 0;
  first.header.addEventListener("click", () => clicks++);

  env.module.apply({ effect: (factory) => factory() });

  assert.equal(clicks, 1);
  assert.equal(first.header.getAttribute("aria-expanded"), "true");
});

test("expands a collapsed Think row and leaves an open one alone", () => {
  const env = createEnvironment();
  const first = makeRow();
  const second = makeRow();
  second.root.setAttribute("data-expanded", "");
  second.header.setAttribute("aria-expanded", "true");
  env.document.body.append(first.root);
  env.document.body.append(second.root);

  let clicks = 0;
  first.header.addEventListener("click", () => clicks++);

  env.module.apply({ effect: (factory) => factory() });

  assert.equal(clicks, 1);
  assert.equal(first.header.getAttribute("aria-expanded"), "true");
});

test("expands rows that appear later, through the observer", () => {
  const env = createEnvironment();
  env.module.apply({ effect: (factory) => factory() });
  const observer = env.observers.at(-1);

  const late = makeRow();
  let clicks = 0;
  late.header.addEventListener("click", () => clicks++);
  env.document.body.append(late.root);

  observer.trigger();
  assert.equal(clicks, 1);
  assert.equal(late.header.getAttribute("aria-expanded"), "true");
});

test("never re-expands a row the reader toggled by hand", () => {
  const env = createEnvironment();
  const row = makeRow();
  env.document.body.append(row.root);
  env.module.apply({ effect: (factory) => factory() });
  const observer = env.observers.at(-1);

  // The reader collapses the row: pointerdown opts it out, the collapse lands.
  env.document.dispatch("pointerdown", { target: row.header });
  row.header.setAttribute("aria-expanded", "false");
  row.root.removeAttribute("data-expanded");

  observer.trigger();
  assert.equal(row.header.getAttribute("aria-expanded"), "false");
});

test("keyboard toggles also opt the row out", () => {
  const env = createEnvironment();
  const row = makeRow();
  env.document.body.append(row.root);
  env.module.apply({ effect: (factory) => factory() });
  const observer = env.observers.at(-1);

  env.document.dispatch("keydown", { key: "Enter", target: row.header });
  row.header.setAttribute("aria-expanded", "false");
  row.root.removeAttribute("data-expanded");

  observer.trigger();
  assert.equal(row.header.getAttribute("aria-expanded"), "false");
});

test("disposal stops the observer", () => {
  const env = createEnvironment();
  let dispose = null;
  env.module.apply({
    effect: (factory) => {
      dispose = factory();
      return dispose;
    },
  });
  const observer = env.observers.at(-1);

  dispose();
  const late = makeRow();
  env.document.body.append(late.root);
  observer.trigger();
  assert.equal(late.header.getAttribute("aria-expanded"), "false");
});
