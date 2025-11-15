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

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * Tool definition for MCP
 */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

/**
 * Base tool interface following MCP SDK patterns
 */
export interface Tool<TInput = any> {
  getDefinition(): ToolDefinition | Promise<ToolDefinition>;
  execute(input: TInput): Promise<CallToolResult>;
}

/**
 * Transport mode types
 */
export enum TransportMode {
  STDIO = 'stdio',
  HTTP = 'http',
  SSE = 'sse',
}

/**
 * Transport configuration options
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

export interface McpStdioConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface McpHttpConfig {
  url: string;
  headers?: Record<string, string>;
}

export interface McpSseConfig {
  url: string;
  headers?: Record<string, string>;
}

export type McpServerTransportConfig = McpStdioConfig | McpHttpConfig | McpSseConfig;

export interface McpServerConfig {
  name: string;
  instruction?: string;
  toolBlacklist?: string[];
  transport: McpServerTransportType;
  config: McpServerTransportConfig;
}

/**
 * Remote configuration response
 */
export interface RemoteMcpConfiguration {
  mcpServers: Record<string, McpServerConfig>;
}

/**
 * MCP client connection interface
 */
export interface McpClientConnection {
  serverName: string;
  serverInstruction?: string;
  toolBlacklist?: string[];
  transport: McpServerTransportType;
  listTools(): Promise<any[]>;
  listResources(): Promise<any[]>;
  listPrompts(): Promise<any[]>;
  callTool(name: string, args: any): Promise<any>;
  readResource(uri: string): Promise<any>;
  getPrompt(name: string, args?: any): Promise<any>;
  close(): Promise<void>;
}
