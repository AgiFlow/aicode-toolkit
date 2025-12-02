/**
 * Hook Decision Constants
 *
 * DESIGN PATTERNS:
 * - Strongly-typed constant exports for compile-time safety
 * - Immutable by default (const exports)
 *
 * CODING STANDARDS:
 * - Primitive constants: UPPER_SNAKE_CASE
 * - Always include JSDoc with purpose and usage
 *
 * AVOID:
 * - Mutable exports (let, var)
 * - Magic strings without explanation
 */

import type { Decision } from '../types';

/**
 * Normalized hook decision types used across all adapters
 * Adapters convert platform-specific formats to these normalized values
 */
export const DECISION_ALLOW: Decision = 'allow';
export const DECISION_DENY: Decision = 'deny';
export const DECISION_SKIP: Decision = 'skip';
export const DECISION_ASK: Decision = 'ask';
