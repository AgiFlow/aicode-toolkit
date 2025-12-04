/**
 * @agiflowai/hooks-adapter - Adapters
 *
 * DESIGN PATTERNS:
 * - Barrel export pattern: Re-export all adapter classes from this index
 * - Single entry point: Import adapters from './adapters' instead of individual files
 *
 * CODING STANDARDS:
 * - Export only public adapter classes
 * - Use named exports (avoid default exports)
 *
 * AVOID:
 * - Exporting internal implementation details
 * - Circular dependencies between modules
 */

// Export adapter classes
export { BaseAdapter } from './BaseAdapter';
export { ClaudeCodeAdapter } from './ClaudeCodeAdapter';
export { GeminiCliAdapter } from './GeminiCliAdapter';

// Export adapter-specific types
export type { ClaudeCodePreToolUseInput } from './ClaudeCodeAdapter';
export type { ClaudeCodePostToolUseInput } from './ClaudeCodeAdapter';
export type { ClaudeCodeHookInput } from './ClaudeCodeAdapter';
export type { GeminiCliHookInput } from './GeminiCliAdapter';
