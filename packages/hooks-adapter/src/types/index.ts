/**
 * @agiflowai/hooks-adapter - Type Definitions
 *
 * DESIGN PATTERNS:
 * - Interface segregation: Keep interfaces focused and minimal
 * - Type composition: Build complex types from simple primitives
 * - Generics: Use type parameters for reusable, type-safe abstractions
 *
 * CODING STANDARDS:
 * - Use PascalCase for type/interface names
 * - Prefix interfaces with 'I' only for abstract contracts
 * - Document complex types with JSDoc comments
 * - Export all public types
 *
 * AVOID:
 * - Any type unless absolutely necessary
 * - Overly complex type gymnastics
 * - Coupling types to implementation details
 */

/**
 * Decision types for hook responses
 */
export type Decision = 'allow' | 'deny' | 'ask' | 'skip';

/**
 * Response from hook callback function
 */
export interface HookResponse {
  /** Permission decision for the tool execution */
  decision: Decision;

  /** Message shown to the LLM (e.g., design patterns, warnings) */
  message: string;

  /** Optional message shown only to the user (not the LLM) */
  userMessage?: string;

  /** Optional updated input parameters for the tool */
  updatedInput?: Record<string, any>;
}
