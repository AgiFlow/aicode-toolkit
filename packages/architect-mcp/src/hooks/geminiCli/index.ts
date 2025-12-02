/**
 * Gemini CLI Hooks - Entry Point
 *
 * DESIGN PATTERNS:
 * - Barrel export pattern: Re-export all hook callbacks from this index
 * - Single entry point: Import hooks from './hooks/geminiCli' instead of individual files
 *
 * CODING STANDARDS:
 * - Export only hook callback functions
 * - Use named exports (avoid default exports)
 *
 * AVOID:
 * - Exporting internal implementation details
 * - Circular dependencies between modules
 */

export { beforeToolHook } from './beforeTool';
export { afterToolHook } from './afterTool';
