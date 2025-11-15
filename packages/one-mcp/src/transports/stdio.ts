/**
 * STDIO Transport
 *
 * DESIGN PATTERNS:
 * - Transport handler pattern implementing TransportHandler interface
 * - Standard I/O based communication for CLI usage
 *
 * CODING STANDARDS:
 * - Initialize server and transport properly
 * - Handle cleanup on shutdown with stop() method
 * - Use async/await for all operations
 *
 * AVOID:
 * - Forgetting to close transport on shutdown
 * - Missing error handling for connection failures
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { TransportHandler } from '../types/index.js';

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
    console.error('@agiflowai/one-mcp MCP server started on stdio');
  }

  async stop(): Promise<void> {
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
  }
}
