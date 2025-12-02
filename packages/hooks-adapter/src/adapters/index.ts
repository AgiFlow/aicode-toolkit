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

export { BaseAdapter } from './BaseAdapter';
export { ClaudeCodeAdapter } from './ClaudeCodeAdapter';
export { ClaudeCodePostToolUseAdapter } from './ClaudeCodePostToolUseAdapter';
export { GeminiCliAdapter } from './GeminiCliAdapter';
