/**
 * Utils Barrel Export
 *
 * DESIGN PATTERNS:
 * - Barrel pattern: Re-export all utilities from a single entry point
 * - Clean imports: Consumers import from '@package/utils' instead of individual files
 *
 * CODING STANDARDS:
 * - Export all utility functions and instances
 * - Use named exports (no default exports)
 * - Keep alphabetically sorted for maintainability
 *
 * AVOID:
 * - Exporting internal implementation details
 * - Re-exporting types (types should come from '../types')
 */

export * from './fsHelpers';
export * from './logger';
export * from './print';
export * from './projectTypeDetector';
