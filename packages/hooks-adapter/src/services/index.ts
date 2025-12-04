/**
 * @agiflowai/hooks-adapter - Services
 *
 * DESIGN PATTERNS:
 * - Barrel export pattern: Re-export all service classes from this index
 * - Single entry point: Import services from './services' instead of individual files
 *
 * CODING STANDARDS:
 * - Export only public service classes and types
 * - Use named exports (avoid default exports)
 *
 * AVOID:
 * - Exporting internal implementation details
 * - Circular dependencies between modules
 */

// Export execution logging service
export {
  ExecutionLogService,
  type LogExecutionParams,
  type LogStats,
} from './ExecutionLogService';
