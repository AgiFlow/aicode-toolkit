/**
 * Hook Types Constants
 *
 * DESIGN PATTERNS:
 * - Strongly-typed constant exports for compile-time safety
 * - Immutable by default (as const assertions)
 * - Related constants grouped into const objects
 *
 * CODING STANDARDS:
 * - Primitive constants: UPPER_SNAKE_CASE or PascalCase for event names
 * - Always include JSDoc with purpose and usage
 *
 * AVOID:
 * - Mutable exports (let, var)
 * - Magic strings without explanation
 */

/**
 * Grouped hook type identifiers for Claude Code hook events
 */
export const ClaudeCodeHookTypes = {
  /** Fires before a tool is executed, allowing interception or modification */
  PRE_TOOL_USE: 'PreToolUse',
  /** Fires after a tool has executed, allowing post-processing or blocking */
  POST_TOOL_USE: 'PostToolUse',
  /** Fires when a session is about to stop */
  STOP: 'Stop',
  /** Fires when the user submits a new prompt */
  USER_PROMPT_SUBMIT: 'UserPromptSubmit',
  /** Fires when an agentic task completes */
  TASK_COMPLETED: 'TaskCompleted',
} as const;

/**
 * Grouped hook type identifiers for Gemini CLI hook events
 */
export const GeminiCliHookTypes = {
  /** Fires before a tool is executed in Gemini CLI */
  BEFORE_TOOL_USE: 'BeforeTool',
  /** Fires after a tool is executed in Gemini CLI */
  AFTER_TOOL_USE: 'AfterTool',
} as const;

/** Hook event fired before a tool is executed in Claude Code */
export const PRE_TOOL_USE = ClaudeCodeHookTypes.PRE_TOOL_USE;
/** Hook event fired after a tool has executed in Claude Code */
export const POST_TOOL_USE = ClaudeCodeHookTypes.POST_TOOL_USE;
/** Hook event fired when a Claude Code session is about to stop */
export const STOP = ClaudeCodeHookTypes.STOP;
/** Hook event fired when the user submits a new prompt in Claude Code */
export const USER_PROMPT_SUBMIT = ClaudeCodeHookTypes.USER_PROMPT_SUBMIT;
/** Hook event fired when an agentic task completes in Claude Code */
export const TASK_COMPLETED = ClaudeCodeHookTypes.TASK_COMPLETED;

/** Hook event fired before a tool is executed in Gemini CLI */
export const BEFORE_TOOL_USE = GeminiCliHookTypes.BEFORE_TOOL_USE;
/** Hook event fired after a tool is executed in Gemini CLI */
export const AFTER_TOOL_USE = GeminiCliHookTypes.AFTER_TOOL_USE;

/**
 * Union type of all supported Claude Code hook types
 */
export type ClaudeCodeHookType = (typeof ClaudeCodeHookTypes)[keyof typeof ClaudeCodeHookTypes];

/**
 * Union type of all supported Gemini CLI hook types
 */
export type GeminiCliHookType = (typeof GeminiCliHookTypes)[keyof typeof GeminiCliHookTypes];

/**
 * Union type of all supported hook types across all agents
 */
export type HookType = ClaudeCodeHookType | GeminiCliHookType;
