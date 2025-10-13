/**
 * @agiflowai/coding-agent-bridge - Type Definitions
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
 * MCP (Model Context Protocol) settings configuration
 * Used to configure MCP server connections and enable/disable features
 * @example
 * ```ts
 * const settings: McpSettings = {
 *   enabled: true,
 *   servers: {
 *     'my-server': { url: 'http://localhost:3000' }
 *   }
 * };
 * ```
 */
export interface McpSettings {
  /** Whether MCP integration is enabled */
  enabled?: boolean;
  /** MCP server configurations keyed by server name */
  servers?: Record<string, unknown>;
  /** Additional configuration properties for future extensibility */
  [key: string]: unknown;
}

/**
 * Prompt configuration for coding agent
 * Defines system and user prompts for LLM interactions
 * @example
 * ```ts
 * const config: PromptConfig = {
 *   systemPrompt: 'You are a helpful coding assistant',
 *   userPrompt: 'Generate a TypeScript function',
 *   context: 'Working on a Node.js project'
 * };
 * ```
 */
export interface PromptConfig {
  /** System-level instructions for the LLM */
  systemPrompt?: string;
  /** User's prompt or question */
  userPrompt?: string;
  /** Additional context for the prompt */
  context?: string;
  /** Additional prompt properties for future extensibility */
  [key: string]: unknown;
}

/**
 * LLM invocation parameters
 * @example
 * ```ts
 * const params: LlmInvocationParams = {
 *   prompt: 'Write a function to calculate fibonacci',
 *   model: 'claude-sonnet-4-20250514',
 *   temperature: 0.7,
 *   maxTokens: 1000
 * };
 * ```
 * @note temperature should be between 0 and 1, where 0 is deterministic and 1 is most creative
 * @note maxTokens limits output length; typical values range from 100 to 4096
 */
export interface LlmInvocationParams {
  /** The prompt text to send to the LLM */
  prompt: string;
  /** Optional model identifier (e.g., 'claude-sonnet-4-20250514') */
  model?: string;
  /** Optional temperature for response randomness (0-1), default varies by service */
  temperature?: number;
  /** Optional maximum tokens to generate, default varies by service */
  maxTokens?: number;
  /** Additional invocation properties for future extensibility */
  [key: string]: unknown;
}

/**
 * LLM invocation response
 * Contains the generated content and usage metrics
 * @example
 * ```ts
 * const response: LlmInvocationResponse = {
 *   content: 'function fibonacci(n) { ... }',
 *   model: 'claude-sonnet-4-20250514',
 *   usage: {
 *     inputTokens: 20,
 *     outputTokens: 150
 *   }
 * };
 * ```
 */
export interface LlmInvocationResponse {
  /** The generated text content from the LLM */
  content: string;
  /** The model that generated the response */
  model: string;
  /** Token usage information for billing and monitoring */
  usage?: {
    /** Number of tokens in the input prompt */
    inputTokens: number;
    /** Number of tokens in the generated output */
    outputTokens: number;
  };
  /** Additional response properties for future extensibility */
  [key: string]: unknown;
}

/**
 * Coding Agent Service Interface
 * Provides methods for managing coding agent functionality across different providers
 *
 * @remarks
 * This is an abstract contract that should be implemented by specific coding agent services
 * (e.g., ClaudeCodeService, CodexService, GeminiService)
 *
 * @example
 * ```ts
 * class MyAgentService implements CodingAgentService {
 *   async isEnabled() { return true; }
 *   async updateMcpSettings(settings) { ... }
 *   async updatePrompt(config) { ... }
 *   async invokeAsLlm(params) { ... }
 * }
 * ```
 */
export interface CodingAgentService {
  /**
   * Check if the coding agent is enabled
   * @returns Promise resolving to true if enabled, false otherwise
   * @remarks Returns false if the agent is disabled via settings or unavailable
   */
  isEnabled(): Promise<boolean>;

  /**
   * Update MCP (Model Context Protocol) settings for the coding agent
   * @param settings - MCP configuration settings
   * @returns Promise resolving when settings are updated
   * @throws Error if settings are invalid or cannot be applied
   * @remarks Updating settings may enable/disable the agent or configure server connections
   */
  updateMcpSettings(settings: McpSettings): Promise<void>;

  /**
   * Update prompt configuration for the coding agent
   * @param config - Prompt configuration
   * @returns Promise resolving when prompt is updated
   * @remarks System prompt changes affect all subsequent LLM invocations
   */
  updatePrompt(config: PromptConfig): Promise<void>;

  /**
   * Invoke the coding agent as an LLM
   * @param params - LLM invocation parameters
   * @returns Promise resolving to the LLM response
   * @throws Error if agent is not enabled, invocation fails, or times out
   * @remarks This performs a single-turn LLM completion without tool use
   */
  invokeAsLlm(params: LlmInvocationParams): Promise<LlmInvocationResponse>;
}
