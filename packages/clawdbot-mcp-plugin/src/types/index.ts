/**
 * @agiflowai/clawdbot-mcp-plugin - Type Definitions
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
 * Clawdbot plugin configuration for one-mcp bridge.
 * Simple config that just points to an mcp-config.yaml file.
 */
export interface PluginConfig {
  /** Path to mcp-config.yaml file (supports one-mcp's YAML format) */
  configFilePath?: string;

  /** Unique identifier for the toolkit */
  serverId?: string;

  /** Disable configuration caching */
  noCache?: boolean;
}

/**
 * Tool definition for Clawdbot tool registration.
 * Defines the structure and behavior of a Clawdbot tool.
 */
export interface ToolDefinition {
  /** Unique tool name identifier */
  name: string;

  /** Human-readable tool description */
  description: string;

  /** JSON Schema for tool input parameters */
  parameters: Record<string, unknown>;

  /**
   * Tool execution function
   * @param id - Execution ID
   * @param params - Tool input parameters
   * @returns Tool execution result
   */
  execute: (id: string, params: Record<string, unknown>) => Promise<ToolResult>;
}

/**
 * Tool execution result returned to Clawdbot.
 * Matches MCP SDK CallToolResult structure.
 */
export interface ToolResult {
  /** Result content array (can contain text, images, resources, etc.) */
  content: Array<Record<string, unknown>>;

  /** Whether the result represents an error */
  isError?: boolean;
}

/**
 * Tool registration options for Clawdbot.
 * Note: The name field must match ToolDefinition.name for proper registration.
 */
export interface ToolOptions {
  /** Tool name identifier (must match ToolDefinition.name) */
  name: string;
}

/**
 * Service definition for Clawdbot lifecycle management.
 * Services can perform startup and cleanup tasks.
 */
export interface ServiceDefinition {
  /** Unique service identifier */
  id: string;

  /**
   * Service startup function
   * Called when the gateway starts
   */
  start: () => Promise<void> | void;

  /**
   * Service shutdown function
   * Called when the gateway stops
   */
  stop: () => Promise<void> | void;
}

/**
 * Clawdbot API interface for plugin integration.
 * Provides methods for registering tools and services with the Clawdbot gateway.
 */
export interface ClawdbotApi {
  /**
   * Plugin configuration object.
   * Contains the configuration values for this plugin from clawdbot.json.
   * Always present, even if empty object when no config provided.
   */
  pluginConfig: PluginConfig;

  /**
   * Register a tool with the Clawdbot gateway
   * @param toolDef - The tool definition with name, description, and execute function
   * @param options - Tool registration options with name identifier
   * @example
   * ```typescript
   * api.registerTool(
   *   {
   *     name: 'mcp__describe_tools',
   *     description: 'Describe available MCP tools',
   *     parameters: { type: 'object', properties: {...} },
   *     execute: async (id, params) => ({
   *       content: [{ type: 'text', text: 'Tool list...' }]
   *     })
   *   },
   *   { name: 'mcp__describe_tools' }
   * );
   * ```
   */
  registerTool: (toolDef: ToolDefinition, options: ToolOptions) => void;

  /**
   * Register a service for lifecycle management
   * @param service - The service definition with start and stop methods
   */
  registerService: (service: ServiceDefinition) => void;

  /** Logging interface for plugin diagnostics */
  logger: {
    /**
     * Log informational messages
     * @param args - Message and optional additional data (strings, numbers, booleans)
     */
    info: (...args: (string | number | boolean)[]) => void;

    /**
     * Log error messages
     * @param args - Error message and optional error details
     */
    error: (...args: (string | Error)[]) => void;

    /**
     * Log warning messages
     * @param args - Warning message and optional additional data
     */
    warn: (...args: (string | number | boolean)[]) => void;
  };
}
