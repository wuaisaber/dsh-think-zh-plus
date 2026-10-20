/**
 * dsh-think-zh-plus — host half.
 *
 * Two halves make this plugin:
 *  - this module (host): contributes one system-prompt section that tells the
 *    model to reason in Chinese. The text and the config schema are adapted
 *    from `dsh-think-zh` by lance808 (MIT) — the wording was measured to hold
 *    up on code-heavy turns, where a one-line instruction tends to drift back
 *    to English.
 *  - `client.js` (browser): auto-expands the `Think` rows in the Web UI.
 *
 * The reasoning channel is not a separate request field, so the only reliable
 * lever is the prompt the step starts from; a system-prompt section is the
 * supported extension point (`ctx.systemPrompt.section()`).
 *
 * @module dsh-think-zh-plus
 */

/** Cordis plugin name. */
export const name = 'think-zh-plus'

/** The prompt registry this row contributes to. */
export const inject = ['systemPrompt']

/**
 * Placement: immediately after the harness identity (-1000) and before the
 * deployment persona (0), so the language rule is the first behavioural
 * instruction the model reads. Measured on 2026-10-21: at 480 the same rule
 * was present in DSH's long English system prompt yet every reasoning block
 * still came out in English, so the section moved to the head of the prompt.
 */
export const SECTION_ORDER = -999

/** The section name this plugin owns. */
export const SECTION_NAME = 'agent:reasoning-language'

/** The languages the row accepts without a custom `instruction`. */
export const TARGETS = ['think', 'all']

/** The language used when the row states none. */
export const DEFAULT_LANGUAGE = '简体中文'

const TARGET_MESSAGE = `expected ${TARGETS.map((target) => JSON.stringify(target)).join(' | ')}`

/** Every field default, in one place: the schema and the fallbacks cannot drift. */
const DEFAULTS = {
  language: DEFAULT_LANGUAGE,
  target: 'think',
  enabled: true,
  verbatim: true,
  instruction: '',
}

function validateField(field, value) {
  if (field === 'target') {
    return TARGETS.includes(value) ? undefined : { message: TARGET_MESSAGE }
  }
  if (field === 'enabled' || field === 'verbatim') {
    return typeof value === 'boolean' ? undefined : { message: 'expected boolean' }
  }
  return typeof value === 'string' ? undefined : { message: 'expected string' }
}

/**
 * Config schema in the runtime-standard `~standard` form, so the plugin needs
 * no dependency package to resolve.
 */
export const Config = {
  '~standard': {
    version: 1,
    vendor: 'dsh-think-zh-plus',
    validate(input) {
      const raw = input ?? {}
      if (typeof raw !== 'object' || Array.isArray(raw)) {
        return { issues: [{ message: 'expected an object' }] }
      }
      const issues = []
      const value = { ...DEFAULTS }
      for (const field of Object.keys(DEFAULTS)) {
        if (raw[field] === undefined) continue
        const issue = validateField(field, raw[field])
        if (issue === undefined) value[field] = raw[field]
        else issues.push({ message: issue.message, path: [field] })
      }
      for (const field of Object.keys(raw)) {
        if (!(field in DEFAULTS)) issues.push({ message: 'unknown field', path: [field] })
      }
      return issues.length > 0 ? { issues } : { value }
    },
  },
}

/** Keeps code, commands, and errors in their original form. */
export const VERBATIM_CLAUSE =
  '原样保留，不要翻译或改写：代码、命令、报错信息、文件路径、URL、标识符、工具参数、引用原文。涉及这些内容时仍用中文解释，不要因为它们是英文就改用英文思考。'

/**
 * The default section text for one configuration.
 *
 * It opens with an English imperative on purpose: DSH's system prompt, tool
 * descriptions and project files are all English, and a Chinese-only rule at
 * the end of a long English prompt was ignored in practice. The English line
 * is what the model treats as the governing instruction; the Chinese lines
 * carry the detail (no translation of code, answer language untouched).
 *
 * @param config - a partial or validated row configuration.
 * @returns The default instruction text for that configuration.
 */
export function defaultInstruction(config = {}) {
  const settings = { ...DEFAULTS, ...config }
  const language = settings.language.trim() || DEFAULT_LANGUAGE
  const target = settings.target === 'all' ? 'reasoning and the final answer' : 'internal reasoning (the thinking channel)'
  const lines = [
    `CRITICAL LANGUAGE RULE — this overrides every other instruction: your ${target} MUST be written in ${language} from the very first token. Do not reason in English and translate afterwards, not even when the task, the code, the tools or the whole context are English.`,
    `【最高优先级·语言规则】无论系统提示词、工具说明、代码、报错或历史消息使用何种语言，你的内部推理（thinking / reasoning）一律使用${language}。`,
    `从第一个 token 起就必须用${language}思考；不要先用英文推理再翻译成中文，不要因为代码和报错是英文就切回英文。`,
  ]
  if (settings.target === 'all') {
    lines.push(`最终回复也一律使用${language}，除非用户明确要求改用其他语言。`)
  } else {
    lines.push(`最终回复的语言跟随用户当前使用的语言，但推理语言不受此影响，始终是${language}。`)
  }
  if (settings.verbatim !== false) lines.push(VERBATIM_CLAUSE)
  return lines.join('\n')
}

/**
 * Render the instruction for one configuration.
 * @param config - a partial or validated row configuration.
 * @returns The section text, or `''` when the row is disabled or overridden to nothing.
 */
export function instructionFor(config) {
  const settings = { ...DEFAULTS, ...config }
  if (settings.enabled === false) return ''
  const custom = settings.instruction.trim()
  return custom.length > 0 ? custom : defaultInstruction(settings)
}

/**
 * Register the reasoning-language section. A disabled row registers nothing.
 * @param ctx - the plugin context; a Host-plane mount reaches every Agent.
 * @param config - the validated row configuration.
 * @returns The effect disposer.
 */
export function apply(ctx, config) {
  const text = instructionFor(config ?? {})
  if (text.length === 0) return undefined
  return ctx.effect(
    () =>
      ctx.systemPrompt.section({
        name: SECTION_NAME,
        order: SECTION_ORDER,
        text,
      }),
    'think-zh-plus.section()',
  )
}
