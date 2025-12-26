/**
 * generateServerId Utilities
 *
 * DESIGN PATTERNS:
 * - Pure functions with no side effects
 * - Single responsibility per function
 * - Functional programming approach
 *
 * CODING STANDARDS:
 * - Export individual functions, not classes
 * - Use descriptive function names with verbs
 * - Add JSDoc comments for complex logic
 * - Keep functions small and focused
 *
 * AVOID:
 * - Side effects (mutating external state)
 * - Stateful logic (use services for state)
 * - Complex external dependencies
 */

import { randomBytes } from 'node:crypto';

/**
 * Character set for generating human-readable IDs.
 * Excludes confusing characters: 0, O, 1, l, I
 */
const CHARSET = '23456789abcdefghjkmnpqrstuvwxyz';

/**
 * Default length for generated server IDs (6 characters)
 */
const DEFAULT_ID_LENGTH = 6;

/**
 * Generate a short, human-readable server ID.
 *
 * Uses Node.js crypto.randomBytes for cryptographically secure randomness.
 * The generated ID:
 * - Is 6 characters long by default
 * - Uses only lowercase alphanumeric characters
 * - Excludes confusing characters (0, O, 1, l, I)
 *
 * @param length - Length of the ID to generate (default: 6)
 * @returns A random, human-readable ID
 *
 * @example
 * generateServerId() // "abc234"
 * generateServerId(4) // "x7mn"
 */
export function generateServerId(length: number = DEFAULT_ID_LENGTH): string {
  const bytes = randomBytes(length);
  let result = '';

  for (let i = 0; i < length; i++) {
    result += CHARSET[bytes[i] % CHARSET.length];
  }

  return result;
}