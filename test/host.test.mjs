import test from "node:test";
import assert from "node:assert/strict";

import {
  Config,
  SECTION_ORDER,
  apply,
  defaultInstruction,
  instructionFor,
} from "../index.js";

test("Config fills defaults and accepts a partial row", () => {
  const result = Config["~standard"].validate({ language: "简体中文" });
  assert.equal(result.issues, undefined);
  assert.deepEqual(result.value, {
    language: "简体中文",
    target: "think",
    enabled: true,
    verbatim: true,
    instruction: "",
  });
});

test("Config rejects a bad target and an unknown field", () => {
  const result = Config["~standard"].validate({ target: "everything", nope: 1 });
  assert.equal(result.value, undefined);
  assert.equal(result.issues.length, 2);
  assert.deepEqual(result.issues.map((issue) => issue.path[0]).sort(), ["nope", "target"]);
});

test("default text targets the reasoning channel and keeps code verbatim", () => {
  const text = defaultInstruction({});
  assert.match(text, /内部推理/);
  assert.match(text, /不要先用英文推理/);
  assert.match(text, /原样保留/);
});

test("target=all also constrains the reply language", () => {
  const text = defaultInstruction({ target: "all" });
  assert.match(text, /最终回复/);
  assert.doesNotMatch(text, /最终回复的语言跟随/);
});

test("a custom instruction and disabled rows short-circuit", () => {
  assert.equal(instructionFor({ instruction: "只用中文。" }), "只用中文。");
  assert.equal(instructionFor({ enabled: false }), "");
});

test("apply registers the section at order 480 and disposes it", () => {
  let registered = null;
  let disposed = false;
  const ctx = {
    effect(factory) {
      const dispose = factory();
      return () => {
        disposed = true;
        dispose();
      };
    },
    systemPrompt: {
      section(options) {
        registered = options;
        return () => {
          registered = null;
        };
      },
    },
  };

  const dispose = apply(ctx, {});
  assert.equal(registered.order, SECTION_ORDER);
  assert.equal(registered.name, "agent:reasoning-language");
  assert.match(registered.text, /简体中文/);

  dispose();
  assert.equal(disposed, true);
  assert.equal(registered, null);
});
