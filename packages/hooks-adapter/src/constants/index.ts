/**
 * @agiflowai/hooks-adapter - Constants
 *
 * DESIGN PATTERNS:
 * - Strongly-typed constant exports for compile-time safety
 * - Immutable by default (as const assertions)
 *
 * CODING STANDARDS:
 * - Primitive constants: UPPER_SNAKE_CASE
 * - Always include JSDoc with purpose and usage
 *
 * AVOID:
 * - Mutable exports (let, var)
 * - Magic strings without explanation
 */

/**
 * Hook type identifiers for different hook events
 */
export const PRE_TOOL_USE = 'PreToolUse';
export const POST_TOOL_USE = 'PostToolUse';

/**
 * Union type of all supported hook types
 */
export type HookType = typeof PRE_TOOL_USE | typeof POST_TOOL_USE;
