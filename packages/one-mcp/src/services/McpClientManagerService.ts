/**
 * McpClientManagerService
 *
 * DESIGN PATTERNS:
 * - Service pattern for business logic encapsulation
 * - Single responsibility principle
 * - Connection pooling and lifecycle management
 * - Factory pattern for creating MCP clients
 *
 * CODING STANDARDS:
 * - Use async/await for asynchronous operations
 * - Throw descriptive errors for error cases
 * - Keep methods focused and well-named
 * - Document complex logic with comments
 *
 * AVOID:
 * - Mixing concerns (keep focused on single domain)
 * - Direct tool implementation (services should be tool-agnostic)
 */

import type { ChildProcess } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type {
  McpClientConnection,
  McpHttpConfig,
  McpServerConfig,
  McpServerTransportType,
  McpSseConfig,
  McpStdioConfig,
  PromptConfig,
} from '../types';

/** Default connection timeout in milliseconds (30 seconds) */
const DEFAULT_CONNECTION_TIMEOUT_MS = 30000;

/**
 * Checks if an error is a session-related error from an HTTP backend
 * (e.g., downstream server restarted and no longer recognizes the session ID).
 */
function isSessionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('unknown session') || message.includes('Session not found');
}

/**
 * MCP Client wrapper for managing individual server connections
 * This is an internal class used by McpClientManagerService
 */
class McpClient implements McpClientConnection {
  serverName: string;
  serverInstruction?: string;
  toolBlacklist?: string[];
  omitToolDescription?: boolean;
  prompts?: Record<string, PromptConfig>;
  transport: McpServerTransportType;
  private client: Client;
  private childProcess?: ChildProcess;
  private connected: boolean = false;
  private reconnectFn?: () => Promise<{ client: Client; childProcess?: ChildProcess }>;

  constructor(
    serverName: string,
    transport: McpServerTransportType,
    client: Client,
    config: {
      instruction?: string;
      toolBlacklist?: string[];
      omitToolDescription?: boolean;
      prompts?: Record<string, PromptConfig>;
    },
  ) {
    this.serverName = serverName;
    this.serverInstruction = config.instruction;
    this.toolBlacklist = config.toolBlacklist;
    this.omitToolDescription = config.omitToolDescription;
    this.prompts = config.prompts;
    this.transport = transport;
    this.client = client;
  }

  setChildProcess(process: ChildProcess): void {
    this.childProcess = process;
  }

  setConnected(connected: boolean): void {
    this.connected = connected;
  }

  /**
   * Sets a reconnection function that creates a fresh Client and transport.
   * Called automatically by withSessionRetry when a session error is detected
   * (e.g., downstream HTTP server restarted and the old session ID is invalid).
   */
  setReconnectFn(fn: () => Promise<{ client: Client; childProcess?: ChildProcess }>): void {
    this.reconnectFn = fn;
  }

  /**
   * Wraps an operation with automatic retry on session errors.
   * If the operation fails with a session error (e.g., downstream server restarted),
   * reconnects and retries once.
   */
  private async withSessionRetry<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (!this.reconnectFn || !isSessionError(error)) {
        throw error;
      }
      console.error(
        `Session error for ${this.serverName}, reconnecting: ${error instanceof Error ? error.message : String(error)}`,
      );
      try {
        await this.client.close();
      } catch (closeError) {
        // Safe to ignore: the stale client's transport is already broken,
        // so close() may fail with the same session error or a network error.
        console.error(`Failed to close stale client for ${this.serverName}:`, closeError);
      }
      const result = await this.reconnectFn();
      this.client = result.client;
      if (result.childProcess) {
        this.childProcess = result.childProcess;
      }
      return await operation();
    }
  }

  async listTools(): Promise<any[]> {
    if (!this.connected) {
      throw new Error(`Client for ${this.serverName} is not connected`);
    }
    return this.withSessionRetry(async () => {
      const response = await this.client.listTools();
      return response.tools;
    });
  }

  async listResources(): Promise<any[]> {
    if (!this.connected) {
      throw new Error(`Client for ${this.serverName} is not connected`);
    }
    return this.withSessionRetry(async () => {
      const response = await this.client.listResources();
      return response.resources;
    });
  }

  async listPrompts(): Promise<any[]> {
    if (!this.connected) {
      throw new Error(`Client for ${this.serverName} is not connected`);
    }
    return this.withSessionRetry(async () => {
      const response = await this.client.listPrompts();
      return response.prompts;
    });
  }

  async callTool(name: string, args: any, options?: { timeout?: number }): Promise<any> {
    if (!this.connected) {
      throw new Error(`Client for ${this.serverName} is not connected`);
    }
    return this.withSessionRetry(async () => {
      const requestOptions = options?.timeout ? { timeout: options.timeout } : undefined;
      return await this.client.callTool({ name, arguments: args }, undefined, requestOptions);
    });
  }

  async readResource(uri: string): Promise<any> {
    if (!this.connected) {
      throw new Error(`Client for ${this.serverName} is not connected`);
    }
    return this.withSessionRetry(async () => {
      return await this.client.readResource({ uri });
    });
  }

  async getPrompt(name: string, args?: any): Promise<any> {
    if (!this.connected) {
      throw new Error(`Client for ${this.serverName} is not connected`);
    }
    return this.withSessionRetry(async () => {
      return await this.client.getPrompt({ name, arguments: args });
    });
  }

  async close(): Promise<void> {
    if (this.childProcess) {
      this.childProcess.kill();
    }
    await this.client.close();
    this.connected = false;
  }
}

/**
 * Service for managing MCP client connections to remote servers
 */
export class McpClientManagerService {
  private clients: Map<string, McpClient> = new Map();
  private serverConfigs: Map<string, McpServerConfig> = new Map();
  private connectionPromises: Map<string, Promise<McpClient>> = new Map();

  /**
   * Synchronously kill all stdio MCP server child processes.
   * Must be called by the owner (e.g. transport/command layer) during shutdown.
   */
  cleanupChildProcesses(): void {
    // Kill all stdio MCP server child processes
    for (const [serverName, client] of this.clients) {
      try {
        // biome-ignore lint/complexity/useLiteralKeys: accessing private property intentionally
        const childProcess = client['childProcess'];
        if (childProcess && !childProcess.killed) {
          console.error(`Killing stdio MCP server: ${serverName} (PID: ${childProcess.pid})`);
          childProcess.kill('SIGTERM');

          // Force kill after timeout if process doesn't exit
          setTimeout(() => {
            if (!childProcess.killed) {
              console.error(`Force killing stdio MCP server: ${serverName} (PID: ${childProcess.pid})`);
              childProcess.kill('SIGKILL');
            }
          }, 1000);
        }
      } catch (error) {
        console.error(`Failed to kill child process for ${serverName}:`, error);
      }
    }
  }

  /**
   * Connect to an MCP server based on its configuration with timeout
   * Uses the timeout from server config, falling back to default (30s)
   */
  async connectToServer(serverName: string, config: McpServerConfig): Promise<void> {
    this.serverConfigs.set(serverName, config);
    await this.ensureConnected(serverName);
  }

  registerServerConfigs(configs: Record<string, McpServerConfig>): void {
    for (const [serverName, config] of Object.entries(configs)) {
      this.serverConfigs.set(serverName, config);
    }
  }

  getKnownServerNames(): string[] {
    return Array.from(this.serverConfigs.keys());
  }

  getServerRequestTimeout(serverName: string): number | undefined {
    return this.serverConfigs.get(serverName)?.requestTimeout;
  }

  async ensureConnected(serverName: string): Promise<McpClientConnection> {
    const existingClient = this.clients.get(serverName);
    if (existingClient) {
      return existingClient;
    }

    const inflightConnection = this.connectionPromises.get(serverName);
    if (inflightConnection) {
      return await inflightConnection;
    }

    const config = this.serverConfigs.get(serverName);
    if (!config) {
      throw new Error(`No configuration found for server "${serverName}"`);
    }

    const connectionPromise = this.createConnection(serverName, config);
    this.connectionPromises.set(serverName, connectionPromise);

    try {
      return await connectionPromise;
    } finally {
      this.connectionPromises.delete(serverName);
    }
  }

  private async createConnection(serverName: string, config: McpServerConfig): Promise<McpClient> {
    const timeoutMs = config.timeout ?? DEFAULT_CONNECTION_TIMEOUT_MS;

    const client = new Client(
      {
        name: `@agiflowai/one-mcp-client`,
        version: '0.1.0',
      },
      {
        capabilities: {},
      },
    );

    const mcpClient = new McpClient(serverName, config.transport, client, {
      instruction: config.instruction,
      toolBlacklist: config.toolBlacklist,
      omitToolDescription: config.omitToolDescription,
      prompts: config.prompts,
    });

    try {
      // Wrap connection with timeout
      await Promise.race([
        this.performConnection(mcpClient, config),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Connection timeout after ${timeoutMs}ms`)), timeoutMs),
        ),
      ]);

      mcpClient.setConnected(true);

      // Set up reconnection for HTTP/SSE transports (session-based backends).
      // When a downstream server restarts, its old session IDs become invalid.
      // This callback creates a fresh Client+transport so withSessionRetry can recover.
      if (config.transport === 'http' || config.transport === 'sse') {
        mcpClient.setReconnectFn(async () => {
          try {
            const newClient = new Client({ name: '@agiflowai/one-mcp-client', version: '0.1.0' }, { capabilities: {} });
            const newMcpClient = new McpClient(serverName, config.transport, newClient, {});
            await this.performConnection(newMcpClient, config);
            return { client: newClient };
          } catch (error) {
            console.error(`Failed to reconnect to ${serverName}:`, error);
            throw error;
          }
        });
      }

      // Get server instruction from MCP server if config instruction is not provided
      if (!mcpClient.serverInstruction) {
        try {
          // biome-ignore lint/complexity/useLiteralKeys: accessing private property intentionally
          const serverInstruction = mcpClient['client'].getInstructions();
          if (serverInstruction) {
            mcpClient.serverInstruction = serverInstruction;
          }
        } catch (error) {
          // Ignore errors when getting server instruction
          console.error(`Failed to get server instruction from ${serverName}:`, error);
        }
      }

      this.clients.set(serverName, mcpClient);
      return mcpClient;
    } catch (error) {
      await mcpClient.close();
      throw error;
    }
  }

  /**
   * Perform the actual connection to MCP server
   */
  private async performConnection(mcpClient: McpClient, config: McpServerConfig): Promise<void> {
    if (config.transport === 'stdio') {
      await this.connectStdioClient(mcpClient, config.config as McpStdioConfig);
    } else if (config.transport === 'http') {
      await this.connectHttpClient(mcpClient, config.config as McpHttpConfig);
    } else if (config.transport === 'sse') {
      await this.connectSseClient(mcpClient, config.config as McpSseConfig);
    } else {
      throw new Error(`Unsupported transport type: ${config.transport}`);
    }
  }

  private async connectStdioClient(mcpClient: McpClient, config: McpStdioConfig): Promise<void> {
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: { ...process.env, ...(config.env ?? {}) } as Record<string, string>,
    });

    // biome-ignore lint/complexity/useLiteralKeys: accessing private property intentionally
    await mcpClient['client'].connect(transport);

    // Capture the child process from the transport for proper cleanup
    // biome-ignore lint/complexity/useLiteralKeys: accessing private property intentionally
    const childProcess = transport['_process'];
    if (childProcess) {
      mcpClient.setChildProcess(childProcess);
    }
  }

  private async connectHttpClient(mcpClient: McpClient, config: McpHttpConfig): Promise<void> {
    const transport = new StreamableHTTPClientTransport(new URL(config.url), {
      requestInit: config.headers ? { headers: config.headers } : undefined,
    });

    // biome-ignore lint/complexity/useLiteralKeys: accessing private property intentionally
    await mcpClient['client'].connect(transport);
  }

  private async connectSseClient(mcpClient: McpClient, config: McpSseConfig): Promise<void> {
    const transport = new SSEClientTransport(new URL(config.url));

    // biome-ignore lint/complexity/useLiteralKeys: accessing private property intentionally
    await mcpClient['client'].connect(transport);
  }

  /**
   * Get a connected client by server name
   */
  getClient(serverName: string): McpClientConnection | undefined {
    return this.clients.get(serverName);
  }

  /**
   * Get all connected clients
   */
  getAllClients(): McpClientConnection[] {
    return Array.from(this.clients.values());
  }

  /**
   * Disconnect from a specific server
   */
  async disconnectServer(serverName: string): Promise<void> {
    const client = this.clients.get(serverName);
    if (client) {
      await client.close();
      this.clients.delete(serverName);
    }
  }

  /**
   * Disconnect from all servers
   */
  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.clients.values()).map((client) => client.close());
    await Promise.all(disconnectPromises);
    this.clients.clear();
    this.connectionPromises.clear();
  }

  /**
   * Check if a server is connected
   */
  isConnected(serverName: string): boolean {
    return this.clients.has(serverName);
  }
}
