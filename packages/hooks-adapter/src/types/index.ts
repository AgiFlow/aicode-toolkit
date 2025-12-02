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
 * Normalized context passed to hook callback function
 */
export interface HookContext {
  /** Name of the tool being invoked (e.g., "Read", "Write", "Edit") */
  toolName: string;

  /** Input parameters passed to the tool */
  toolInput: Record<string, any>;

  /** File path if this is a file operation */
  filePath?: string;

  /** Type of file operation */
  operation?: 'read' | 'write' | 'edit';

  /** Current working directory */
  cwd: string;

  /** Unique session identifier */
  sessionId: string;

  /** Optional LLM tool to use for processing (e.g., "claude-code", "gemini") */
  llmTool?: string;
}

/**
 * Normalized decision types for hook responses
 */
export type Decision = 'allow' | 'deny' | 'ask' | 'skip';

/**
 * Normalized response from hook callback function
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

/**
 * Hook callback function signature
 * Takes normalized context and returns normalized response
 */
export type HookCallback = (context: HookContext) => Promise<HookResponse>;
