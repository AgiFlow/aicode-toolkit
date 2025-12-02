/**
 * @agiflowai/hooks-adapter - Main Entry Point
 *
 * DESIGN PATTERNS:
 * - Barrel export pattern: Re-export all public APIs from submodules
 * - Single entry point: All library consumers import from this file
 *
 * CODING STANDARDS:
 * - Export only stable, public APIs
 * - Use named exports (avoid default exports)
 * - Group exports by feature/domain
 *
 * AVOID:
 * - Exporting internal implementation details
 * - Circular dependencies between modules
 * - Side effects at module initialization
 */

// Export types
export * from './types';

// Export adapters
export { BaseAdapter } from './adapters/BaseAdapter';
export { ClaudeCodeAdapter } from './adapters/ClaudeCodeAdapter';
export { ClaudeCodePostToolUseAdapter } from './adapters/ClaudeCodePostToolUseAdapter';

// Export services
export { ExecutionLogService } from './services/ExecutionLogService';
export {
  AdapterProxyService,
  type HookCallbackRegistry,
} from './services/AdapterProxyService';
