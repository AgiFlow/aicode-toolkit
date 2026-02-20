import { log } from '@agiflowai/aicode-utils';
import { randomUUID } from 'node:crypto';
import type { Server as HttpServer } from 'node:http';
import type { Server as McpServer } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import express, { type Request, type Response } from 'express';
import type { HttpTransportHandler as IHttpTransportHandler, TransportConfig } from './types.js';

/**
 * Session data for HTTP connections
 */
interface HttpSession {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
}

/**
 * HTTP session manager
 */
class HttpFullSessionManager {
  private sessions: Map<string, HttpSession> = new Map();

  getSession(sessionId: string): HttpSession | undefined {
    return this.sessions.get(sessionId);
  }

  setSession(sessionId: string, transport: StreamableHTTPServerTransport, server: McpServer): void {
    this.sessions.set(sessionId, { transport, server });
  }

  deleteSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.server.close();
    }
    this.sessions.delete(sessionId);
  }

  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  clear(): void {
    for (const session of this.sessions.values()) {
      session.server.close();
    }
    this.sessions.clear();
  }
}

/**
 * HTTP transport handler using Streamable HTTP (protocol version 2025-03-26)
 * Provides stateful session management with resumability support
 */
export class HttpTransportHandler implements IHttpTransportHandler {
  private serverFactory: () => McpServer;
  private app: express.Application;
  private server: HttpServer | null = null;
  private sessionManager: HttpFullSessionManager;
  private config: Required<TransportConfig>;

  constructor(serverFactory: McpServer | (() => McpServer), config: TransportConfig) {
    // Support both a factory function and a direct server instance for backwards compatibility
    this.serverFactory = typeof serverFactory === 'function' ? serverFactory : () => serverFactory;
    this.app = express();
    this.sessionManager = new HttpFullSessionManager();
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
    // Handle POST requests for client-to-server communication
    this.app.post('/mcp', async (req: Request, res: Response) => {
      await this.handlePostRequest(req, res);
    });

    // Handle GET requests for server-to-client notifications via SSE
    this.app.get('/mcp', async (req: Request, res: Response) => {
      await this.handleGetRequest(req, res);
    });

    // Handle DELETE requests for session termination
    this.app.delete('/mcp', async (req: Request, res: Response) => {
      await this.handleDeleteRequest(req, res);
    });

    // Health check endpoint
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({ status: 'ok', transport: 'http' });
    });
  }

  private async handlePostRequest(req: Request, res: Response): Promise<void> {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && this.sessionManager.hasSession(sessionId)) {
      // Reuse existing transport
      // biome-ignore lint/style/noNonNullAssertion: value guaranteed by context
      const session = this.sessionManager.getSession(sessionId)!;
      transport = session.transport;
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New initialization request - create new server instance
      const mcpServer = this.serverFactory();

      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true, // Return JSON instead of SSE for simple request/response
        onsessioninitialized: (sessionId) => {
          this.sessionManager.setSession(sessionId, transport, mcpServer);
        },
      });

      // Clean up transport when closed
      transport.onclose = () => {
        if (transport.sessionId) {
          this.sessionManager.deleteSession(transport.sessionId);
        }
      };

      // Connect the new MCP server instance to the transport
      await mcpServer.connect(transport);
    } else {
      // Invalid request
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided',
        },
        id: null,
      });
      return;
    }

    // Handle the request
    await transport.handleRequest(req, res, req.body);
  }

  private async handleGetRequest(req: Request, res: Response): Promise<void> {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (!sessionId || !this.sessionManager.hasSession(sessionId)) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }

    // biome-ignore lint/style/noNonNullAssertion: value guaranteed by context
    const session = this.sessionManager.getSession(sessionId)!;
    await session.transport.handleRequest(req, res);
  }

  private async handleDeleteRequest(req: Request, res: Response): Promise<void> {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (!sessionId || !this.sessionManager.hasSession(sessionId)) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }

    // biome-ignore lint/style/noNonNullAssertion: value guaranteed by context
    const session = this.sessionManager.getSession(sessionId)!;
    await session.transport.handleRequest(req, res);

    // Clean up session
    this.sessionManager.deleteSession(sessionId);
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.config.port, this.config.host, () => {
          log.error(
            `Architect MCP server started on http://${this.config.host}:${this.config.port}/mcp`,
          );
          log.error(`Health check: http://${this.config.host}:${this.config.port}/health`);
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
