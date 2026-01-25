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
 */
export interface ToolOptions {
  /** Whether the tool is optional (default: true) */
  optional?: boolean;
}

/**
 * Service definition for Clawdbot lifecycle management.
 * Services can perform startup and cleanup tasks.
 */
export interface ServiceDefinition {
  /** Unique service name identifier */
  name: string;

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
   * Get plugin configuration by plugin ID
   * @param pluginId - The unique identifier of the plugin
   * @returns The plugin configuration if found, undefined otherwise
   */
  getConfig: (pluginId: string) => PluginConfig | undefined;

  /**
   * Register a tool with the Clawdbot gateway
   * @param toolDef - The tool definition with name, description, and execute function
   * @param options - Optional tool registration options (e.g., optional flag)
   */
  registerTool: (toolDef: ToolDefinition, options?: ToolOptions) => void;

  /**
   * Register a service for lifecycle management
   * @param service - The service definition with start and stop methods
   */
  registerService: (service: ServiceDefinition) => void;

  /** Logging interface for plugin diagnostics */
  log: {
    /**
     * Log informational messages
     * @param args - Message and optional additional data
     */
    info: (...args: string[]) => void;

    /**
     * Log error messages
     * @param args - Error message and optional error details
     */
    error: (...args: (string | Error)[]) => void;

    /**
     * Log warning messages
     * @param args - Warning message and optional additional data
     */
    warn: (...args: string[]) => void;
  };
}