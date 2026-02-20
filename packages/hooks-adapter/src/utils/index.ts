/**
 * Utils Barrel Export
 *
 * DESIGN PATTERNS:
 * - Barrel pattern: Re-export all utilities from a single entry point
 * - Clean imports: Consumers import from '@package/utils' instead of individual files
 *
 * CODING STANDARDS:
 * - Export all utility functions using named exports
 * - Use named exports (no default exports)
 * - Keep alphabetically sorted for maintainability
 *
 * AVOID:
 * - Re-exporting types (types should come from '../types')
 * - Exporting classes or stateful objects
 * - Namespace exports (export *)
 */

export { isHookContext, isHookResponse } from './guards';
export { parseHookType } from './parseHookType';
