/**
 * Runtime Type Guards
 *
 * DESIGN PATTERNS:
 * - Type guard pattern: Runtime validation of external data structures
 * - Pure function pattern: No side effects, deterministic output
 *
 * CODING STANDARDS:
 * - Use TypeScript 'is' return type for type narrowing
 * - Validate at system boundaries (stdin parsing, external data)
 * - Use 'in' operator for safe property narrowing (no type assertions)
 *
 * AVOID:
 * - Complex validation logic (use a schema library for that)
 * - Side effects in guard functions
 * - Type assertions (as) to bypass type checking
 */

import type { Decision, HookResponse, HookContext } from '../types';

/**
 * Set of valid decision values for efficient runtime lookup.
 * Mirrors the Decision type: 'allow' | 'deny' | 'ask' | 'skip'
 */
const VALID_DECISIONS: ReadonlySet<string> = new Set<Decision>(['allow', 'deny', 'ask', 'skip']);

/**
 * Type guard for HookResponse objects.
 * Validates that a value conforms to the HookResponse interface at runtime.
 *
 * @param value - Unknown value to check
 * @returns True if value is a valid HookResponse
 */
export function isHookResponse(value: unknown): value is HookResponse {
  if (typeof value !== 'object' || value === null) return false;
  if (!('decision' in value) || typeof value.decision !== 'string') return false;
  if (!VALID_DECISIONS.has(value.decision)) return false;
  if (!('message' in value) || typeof value.message !== 'string') return false;
  return true;
}

/**
 * Type guard for HookContext objects.
 * Validates that a value conforms to the HookContext interface at runtime.
 * toolInput is shallowly validated because its internal structure varies by tool
 * and is not constrained by the interface.
 *
 * @param value - Unknown value to check
 * @returns True if value is a valid HookContext
 */
export function isHookContext(value: unknown): value is HookContext {
  if (typeof value !== 'object' || value === null) return false;
  if (!('toolName' in value) || typeof value.toolName !== 'string') return false;
  if (!('toolInput' in value) || typeof value.toolInput !== 'object' || value.toolInput === null) {
    return false;
  }
  if (!('cwd' in value) || typeof value.cwd !== 'string') return false;
  if (!('sessionId' in value) || typeof value.sessionId !== 'string') return false;
  return true;
}
