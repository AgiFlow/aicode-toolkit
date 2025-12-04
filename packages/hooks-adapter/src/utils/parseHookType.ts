/**
 * parseHookType Utilities
 *
 * DESIGN PATTERNS:
 * - Pure function pattern: No side effects, deterministic output
 * - Single domain focus: All functions related to hook type parsing
 * - Early validation with descriptive error messages
 *
 * CODING STANDARDS:
 * - Function names use camelCase with descriptive verbs (validate, format, parse, transform)
 * - All functions should be pure (same input = same output, no side effects)
 * - Use explicit return types
 * - Document complex logic with JSDoc comments
 * - Keep functions small and focused on single responsibility
 *
 * AVOID:
 * - Side effects (mutations, I/O, random values, Date.now(), etc.)
 * - Stateful behavior or closures with mutable state
 * - Dependencies on external services or global variables
 * - Classes (use pure functions instead)
 */

/**
 * Parsed hook type result containing agent and hook method
 */
export interface ParsedHookType {
  /** Agent identifier (e.g., 'claude-code', 'gemini-cli') */
  agent: string;
  /** Hook method name (e.g., 'preToolUse', 'afterTool') */
  hookMethod: string;
}

/**
 * Parse hook type option in format: agent.hookMethod
 *
 * @param hookType - Hook type string in format '<agent>.<hookMethod>'
 * @returns Parsed hook type with agent and hookMethod
 * @throws Error if hook type format is invalid
 *
 * @example
 * parseHookType('claude-code.preToolUse')
 * // Returns: { agent: 'claude-code', hookMethod: 'preToolUse' }
 *
 * @example
 * parseHookType('gemini-cli.afterTool')
 * // Returns: { agent: 'gemini-cli', hookMethod: 'afterTool' }
 */
export function parseHookType(hookType: string): ParsedHookType {
  const [agent, hookMethod] = hookType.split('.');

  if (!agent || !hookMethod) {
    throw new Error(`Invalid hook type: ${hookType}. Expected: <agent>.<hookMethod>`);
  }

  return { agent, hookMethod };
}
