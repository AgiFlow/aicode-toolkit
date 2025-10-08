import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { TransportHandler } from './types.js';

/**
 * Stdio transport handler for MCP server
 * Used for command-line and direct integrations
 */
export class StdioTransportHandler implements TransportHandler {
  private server: Server;
  private transport: StdioServerTransport | null = null;

  constructor(server: Server) {
    this.server = server;
  }

  async start(): Promise<void> {
    this.transport = new StdioServerTransport();

    await this.server.connect(this.transport);

    console.error('Architect MCP server started on stdio');
  }

  async stop(): Promise<void> {
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
  }
}
