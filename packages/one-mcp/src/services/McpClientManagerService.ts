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
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type {
  McpServerConfig,
  McpStdioConfig,
  McpSseConfig,
  McpClientConnection,
  McpServerTransportType,
} from '../types';

/**
 * MCP Client wrapper for managing individual server connections
 */
class McpClient implements McpClientConnection {
  serverName: string;
  serverInstruction?: string;
  toolBlacklist?: string[];
  transport: McpServerTransportType;
  private client: Client;
  private childProcess?: ChildProcess;
  private connected: boolean = false;

  constructor(
    serverName: string,
    transport: McpServerTransportType,
    client: Client,
    config: {
      instruction?: string;
      toolBlacklist?: string[];
    },
  ) {
    this.serverName = serverName;
    this.serverInstruction = config.instruction;
    this.toolBlacklist = config.toolBlacklist;
    this.transport = transport;
    this.client = client;
  }

  setChildProcess(process: ChildProcess): void {
    this.childProcess = process;
  }

  setConnected(connected: boolean): void {
    this.connected = connected;
  }

  async listTools(): Promise<any[]> {
    if (!this.connected) {
      throw new Error(`Client for ${this.serverName} is not connected`);
    }
    const response = await this.client.listTools();
    return response.tools;
  }

  async listResources(): Promise<any[]> {
    if (!this.connected) {
      throw new Error(`Client for ${this.serverName} is not connected`);
    }
    const response = await this.client.listResources();
    return response.resources;
  }

  async listPrompts(): Promise<any[]> {
    if (!this.connected) {
      throw new Error(`Client for ${this.serverName} is not connected`);
    }
    const response = await this.client.listPrompts();
    return response.prompts;
  }

  async callTool(name: string, args: any): Promise<any> {
    if (!this.connected) {
      throw new Error(`Client for ${this.serverName} is not connected`);
    }
    return await this.client.callTool({ name, arguments: args });
  }

  async readResource(uri: string): Promise<any> {
    if (!this.connected) {
      throw new Error(`Client for ${this.serverName} is not connected`);
    }
    return await this.client.readResource({ uri });
  }

  async getPrompt(name: string, args?: any): Promise<any> {
    if (!this.connected) {
      throw new Error(`Client for ${this.serverName} is not connected`);
    }
    return await this.client.getPrompt({ name, arguments: args });
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

  constructor() {
    // Cleanup resources on exit
    process.on('exit', () => {
      this.cleanupOnExit();
    });
    process.on('SIGINT', () => {
      this.cleanupOnExit();
      process.exit(0);
    });
    process.on('SIGTERM', () => {
      this.cleanupOnExit();
      process.exit(0);
    });
  }

  /**
   * Cleanup all resources on exit (child processes)
   */
  private cleanupOnExit(): void {
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
   */
  async connectToServer(
    serverName: string,
    config: McpServerConfig,
    timeoutMs: number = 10000,
  ): Promise<void> {
    if (this.clients.has(serverName)) {
      throw new Error(`Client for ${serverName} is already connected`);
    }

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
      env: config.env,
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
  }

  /**
   * Check if a server is connected
   */
  isConnected(serverName: string): boolean {
    return this.clients.has(serverName);
  }
}
