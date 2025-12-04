/**
 * @agiflowai/hooks-adapter - Constants
 *
 * DESIGN PATTERNS:
 * - Barrel export pattern for centralized constant imports
 * - Strongly-typed constant exports for compile-time safety
 *
 * CODING STANDARDS:
 * - Re-export all constants using wildcard exports
 * - Keep barrel file simple - only re-exports
 *
 * AVOID:
 * - Adding business logic to barrel files
 * - Selective exports (use wildcard)
 */

// Hook type constants
export * from './hookTypes';

// Decision constants
export * from './decisions';
