/**
 * Hook Types Constants
 *
 * DESIGN PATTERNS:
 * - Strongly-typed constant exports for compile-time safety
 * - Immutable by default (as const assertions)
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
 * Hook type identifiers for Claude Code hook events
 */
export const PRE_TOOL_USE = 'PreToolUse';
export const POST_TOOL_USE = 'PostToolUse';

/**
 * Hook type identifiers for Gemini CLI hook events
 */
export const BEFORE_TOOL_USE = 'BeforeTool';
export const AFTER_TOOL_USE = 'AfterTool';

/**
 * Union type of all supported hook types
 */
export type HookType =
  | typeof PRE_TOOL_USE
  | typeof POST_TOOL_USE
  | typeof BEFORE_TOOL_USE
  | typeof AFTER_TOOL_USE;
