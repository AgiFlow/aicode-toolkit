/**
 * SSE Transport Handler
 *
 * DESIGN PATTERNS:
 * - Transport handler pattern implementing TransportHandler interface
 * - Session management for stateful SSE connections
 * - Legacy SSE protocol (2024-11-05) with separate endpoints
 * - Factory pattern for creating MCP server instances per connection
 *
 * CODING STANDARDS:
 * - Use async/await for all asynchronous operations
 * - Implement proper session lifecycle management
 * - Handle connection cleanup on client disconnect
 * - Provide health check endpoint for monitoring
 * - Clean up resources on shutdown
 *
 * AVOID:
 * - Sharing MCP server instances across sessions (use factory pattern)
 * - Forgetting to clean up sessions on disconnect
 * - Missing error handling for connection/message processing
 * - Hardcoded configuration (use TransportConfig)
 */

import type { Server as HttpServer } from 'node:http';
import type { Server as McpServer } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express, { type Request, type Response } from 'express';
import type {
  HttpTransportHandler as IHttpTransportHandler,
  TransportConfig,
} from '../types/index.js';

/**
 * Session data for SSE connections
 */
interface SseSession {
  transport: SSEServerTransport;
  server: McpServer;
}

/**
 * Session manager for SSE transports
 */
class SseSessionManager {
  private sessions: Map<string, SseSession> = new Map();

  getSession(sessionId: string): SSEServerTransport | undefined {
    return this.sessions.get(sessionId)?.transport;
  }

  setSession(sessionId: string, transport: SSEServerTransport, server: McpServer): void {
    this.sessions.set(sessionId, { transport, server });
  }

  deleteSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      // Close the server instance
      session.server.close();
    }
    this.sessions.delete(sessionId);
  }

  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  clear(): void {
    // Close all server instances
    for (const session of this.sessions.values()) {
      session.server.close();
    }
    this.sessions.clear();
  }
}

/**
 * SSE (Server-Sent Events) transport handler
 * Legacy transport for backwards compatibility (protocol version 2024-11-05)
 * Uses separate endpoints: /sse for SSE stream (GET) and /messages for client messages (POST)
 */
export class SseTransportHandler implements IHttpTransportHandler {
  private serverFactory: () => McpServer;
  private app: express.Application;
  private server: HttpServer | null = null;
  private sessionManager: SseSessionManager;
  private config: Required<TransportConfig>;

  constructor(serverFactory: McpServer | (() => McpServer), config: TransportConfig) {
    // Support both a factory function and a direct server instance for backwards compatibility
    this.serverFactory = typeof serverFactory === 'function' ? serverFactory : () => serverFactory;
    this.app = express();
    this.sessionManager = new SseSessionManager();
    this.config = {
      mode: config.mode,
      port: config.port ?? 3000,
      host: config.host ?? 'localhost',
    };

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
  }

  private setupRoutes(): void {
    // SSE endpoint - establishes the SSE stream
    this.app.get('/sse', async (req: Request, res: Response) => {
      await this.handleSseConnection(req, res);
    });

    // Messages endpoint - receives client messages
    this.app.post('/messages', async (req: Request, res: Response) => {
      await this.handlePostMessage(req, res);
    });

    // Health check endpoint
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({ status: 'ok', transport: 'sse' });
    });
  }

  private async handleSseConnection(_req: Request, res: Response): Promise<void> {
    try {
      // Create a new MCP server instance for this SSE connection
      const mcpServer = this.serverFactory();

      // Create SSE transport
      const transport = new SSEServerTransport('/messages', res);

      // Store the transport and server
      this.sessionManager.setSession(transport.sessionId, transport, mcpServer);

      // Clean up when connection closes
      res.on('close', () => {
        this.sessionManager.deleteSession(transport.sessionId);
      });

      // Connect the new server instance to the transport
      await mcpServer.connect(transport);

      console.error(`SSE session established: ${transport.sessionId}`);
    } catch (error) {
      console.error('Error handling SSE connection:', error);
      if (!res.headersSent) {
        res.status(500).send('Internal Server Error');
      }
    }
  }

  private async handlePostMessage(req: Request, res: Response): Promise<void> {
    const sessionId = req.query.sessionId as string;

    if (!sessionId) {
      res.status(400).send('Missing sessionId query parameter');
      return;
    }

    const transport = this.sessionManager.getSession(sessionId);

    if (!transport) {
      res.status(404).send('No transport found for sessionId');
      return;
    }

    try {
      await transport.handlePostMessage(req, res, req.body);
    } catch (error) {
      console.error('Error handling post message:', error);
      if (!res.headersSent) {
        res.status(500).send('Internal Server Error');
      }
    }
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.config.port, this.config.host, () => {
          console.error(
            `@agiflowai/one-mcp MCP server started with SSE transport on http://${this.config.host}:${this.config.port}`,
          );
          console.error(`SSE endpoint: http://${this.config.host}:${this.config.port}/sse`);
          console.error(
            `Messages endpoint: http://${this.config.host}:${this.config.port}/messages`,
          );
          console.error(`Health check: http://${this.config.host}:${this.config.port}/health`);
          resolve();
        });

        this.server.on('error', (error: Error) => {
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        // Clear all sessions
        this.sessionManager.clear();

        this.server.close((err?: Error) => {
          if (err) {
            reject(err);
          } else {
            this.server = null;
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  getPort(): number {
    return this.config.port;
  }

  getHost(): string {
    return this.config.host;
  }
}
