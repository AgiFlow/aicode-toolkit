/**
 * Shared TypeScript Types
 *
 * DESIGN PATTERNS:
 * - Type-first development
 * - Interface segregation
 *
 * CODING STANDARDS:
 * - Export all shared types from this file
 * - Use descriptive names for types and interfaces
 */

import type {
  CallToolResult,
  ReadResourceResult,
  GetPromptResult,
} from '@modelcontextprotocol/sdk/types.js';

/**
 * Tool definition for MCP
 * @property name - The unique name of the tool
 * @property description - Human-readable description of what the tool does
 * @property inputSchema - JSON Schema defining the tool's input parameters
 */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

/**
 * Base tool interface following MCP SDK patterns
 * @template TInput - The type of input the tool accepts
 */
export interface Tool<TInput = unknown> {
  getDefinition(): ToolDefinition | Promise<ToolDefinition>;
  execute(input: TInput): Promise<CallToolResult>;
}

/**
 * Transport mode constants
 */
export const TRANSPORT_MODE = {
  STDIO: 'stdio',
  HTTP: 'http',
  SSE: 'sse',
} as const;

/**
 * Transport mode type derived from TRANSPORT_MODE constants
 */
export type TransportMode = (typeof TRANSPORT_MODE)[keyof typeof TRANSPORT_MODE];

/**
 * Transport configuration options
 * @property mode - The transport mode to use (stdio, http, or sse)
 * @property port - Port number for HTTP/SSE modes (not used for STDIO)
 * @property host - Host address for HTTP/SSE modes (not used for STDIO)
 */
export interface TransportConfig {
  mode: TransportMode;
  port?: number;
  host?: string;
}

/**
 * Base interface for all transport handlers
 */
export interface TransportHandler {
  start(): Promise<void>;
  stop(): Promise<void>;
}

/**
 * HTTP transport specific types
 */
export interface HttpTransportHandler extends TransportHandler {
  getPort(): number;
  getHost(): string;
}

/**
 * Remote MCP server configuration types
 */
export type McpServerTransportType = 'stdio' | 'http' | 'sse';

/**
 * Configuration for stdio-based MCP server connections
 * @property command - The command to execute to start the server
 * @property args - Optional arguments to pass to the command
 * @property env - Optional environment variables for the subprocess
 */
export interface McpStdioConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

/**
 * Configuration for HTTP-based MCP server connections
 * @property url - The URL of the HTTP endpoint
 * @property headers - Optional HTTP headers to include in requests
 */
export interface McpHttpConfig {
  url: string;
  headers?: Record<string, string>;
}

/**
 * Configuration for SSE-based MCP server connections
 * @property url - The URL of the SSE endpoint
 * @property headers - Optional HTTP headers to include in requests
 */
export interface McpSseConfig {
  url: string;
  headers?: Record<string, string>;
}

/**
 * Union type for MCP server transport configurations
 * - McpStdioConfig: Used for local subprocess communication via stdio (has 'command' property)
 * - McpHttpConfig: Used for HTTP-based remote connections (has 'url' property)
 * - McpSseConfig: Used for Server-Sent Events streaming connections (has 'url' property)
 *
 * Note: McpHttpConfig and McpSseConfig have identical structure. Discrimination between
 * them should be done using the transport type field in McpServerConfig, not by
 * structural inspection of the config object.
 */
export type McpServerTransportConfig = McpStdioConfig | McpHttpConfig | McpSseConfig;

/**
 * Configuration for an MCP server connection
 * @property name - Unique identifier for the server
 * @property instruction - Optional instruction text describing the server's purpose
 * @property toolBlacklist - Optional list of tool names to exclude from this server
 * @property omitToolDescription - Whether to omit tool descriptions in listings
 * @property prompts - Optional prompts configuration for skill conversion
 * @property transport - The transport type (stdio, http, or sse)
 * @property config - Transport-specific configuration options
 * @property timeout - Optional connection timeout in milliseconds (default: 30000)
 * @property disabled - Whether this server is disabled and should not be started
 */
export interface McpServerConfig {
  name: string;
  instruction?: string;
  toolBlacklist?: string[];
  omitToolDescription?: boolean;
  prompts?: Record<string, PromptConfig>;
  transport: McpServerTransportType;
  config: McpServerTransportConfig;
  timeout?: number;
  disabled?: boolean;
}

/**
 * Skills configuration
 * @property paths - Array of paths to skills directories
 */
export interface SkillsConfig {
  paths: string[];
}

/**
 * Prompt skill configuration for converting prompts to executable skills
 * @property name - Skill name identifier
 * @property description - Skill description shown in describe_tools
 * @property folder - Optional folder path for skill resources
 */
export interface PromptSkillConfig {
  name: string;
  description: string;
  folder?: string;
}

/**
 * Prompt configuration that can be converted to a skill
 * @property skill - Optional skill conversion configuration
 */
export interface PromptConfig {
  skill?: PromptSkillConfig;
}

/**
 * Remote configuration response containing MCP server definitions
 * @property id - Optional unique server identifier
 * @property mcpServers - Map of server names to their configurations
 * @property skills - Optional skills configuration with paths
 */
export interface RemoteMcpConfiguration {
  id?: string;
  mcpServers: Record<string, McpServerConfig>;
  skills?: SkillsConfig;
}

/**
 * MCP tool information returned from listTools
 * @property name - The tool name
 * @property description - Human-readable description
 * @property inputSchema - JSON Schema for tool inputs
 */
export interface McpToolInfo {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

/**
 * MCP resource information returned from listResources
 * @property uri - Resource URI
 * @property name - Display name
 * @property description - Human-readable description
 * @property mimeType - Optional MIME type
 */
export interface McpResourceInfo {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

/**
 * MCP prompt information returned from listPrompts
 * @property name - Prompt name
 * @property description - Human-readable description
 * @property arguments - Optional argument definitions
 */
export interface McpPromptInfo {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

/**
 * MCP client connection interface for communicating with remote MCP servers
 * @property serverName - The name identifier for this server connection
 * @property serverInstruction - Optional instruction text for the server
 * @property toolBlacklist - Optional list of tool names to exclude
 * @property omitToolDescription - Whether to omit tool descriptions
 * @property prompts - Optional prompts configuration for skill conversion
 * @property transport - The transport type used for this connection
 */
export interface McpClientConnection {
  serverName: string;
  serverInstruction?: string;
  toolBlacklist?: string[];
  omitToolDescription?: boolean;
  prompts?: Record<string, PromptConfig>;
  transport: McpServerTransportType;
  /** List available tools from the server */
  listTools(): Promise<McpToolInfo[]>;
  /** List available resources from the server */
  listResources(): Promise<McpResourceInfo[]>;
  /** List available prompts from the server */
  listPrompts(): Promise<McpPromptInfo[]>;
  /** Call a tool with the given name and arguments */
  callTool(name: string, args: Record<string, unknown>): Promise<CallToolResult>;
  /** Read a resource by URI */
  readResource(uri: string): Promise<ReadResourceResult>;
  /** Get a prompt by name with optional arguments */
  getPrompt(name: string, args?: Record<string, unknown>): Promise<GetPromptResult>;
  /** Close the connection */
  close(): Promise<void>;
}

/**
 * Skill metadata from YAML frontmatter in SKILL.md files
 * @property name - Skill identifier used with skill__ prefix
 * @property description - Short description shown in describe_tools
 * @property license - Optional license information
 */
export interface SkillMetadata {
  name: string;
  description: string;
  license?: string;
}

/**
 * Skill definition loaded from skill files
 * @property name - Skill identifier used with skill__ prefix
 * @property description - Short description shown in describe_tools
 * @property location - Where the skill was loaded from ('project' or 'user')
 * @property content - The markdown content of the skill (without frontmatter)
 * @property basePath - The directory path where the skill is located
 */
export interface Skill {
  name: string;
  description: string;
  location: 'project' | 'user';
  content: string;
  basePath: string;
}
