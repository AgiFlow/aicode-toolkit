/**
 * HTTP Transport Handler
 *
 * DESIGN PATTERNS:
 * - Transport handler pattern implementing TransportHandler interface
 * - Session management for stateful connections
 * - Streamable HTTP protocol (2025-03-26) with resumability support
 * - Factory pattern for creating MCP server instances per session
 *
 * CODING STANDARDS:
 * - Use async/await for all asynchronous operations
 * - Implement proper session lifecycle management
 * - Handle errors gracefully with appropriate HTTP status codes
 * - Provide health check endpoint for monitoring
 * - Clean up resources on shutdown
 *
 * AVOID:
 * - Sharing MCP server instances across sessions (use factory pattern)
 * - Forgetting to clean up sessions on disconnect
 * - Missing error handling for request processing
 * - Hardcoded configuration (use TransportConfig)
 */

import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { Server as HttpServer } from 'node:http';
import { promisify } from 'node:util';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import type { Server as McpServer } from '@modelcontextprotocol/sdk/server/index.js';
import express, { type Request, type Response } from 'express';
import type {
  HttpTransportAdminOptions,
  HttpTransportHandler as IHttpTransportHandler,
  HttpTransportHealthResponse,
  HttpTransportShutdownResponse,
  TransportConfig,
} from '../types';

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

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const ADMIN_RATE_LIMIT_WINDOW_MS = 60_000;
const ADMIN_RATE_LIMIT_MAX_REQUESTS = 5;

/**
 * Simple in-memory rate limiter for the admin shutdown endpoint.
 * Tracks request timestamps per IP within a sliding window.
 */
class AdminRateLimiter {
  private requests = new Map<string, number[]>();

  isAllowed(ip: string): boolean {
    const now = Date.now();
    const windowStart = now - ADMIN_RATE_LIMIT_WINDOW_MS;
    const timestamps = (this.requests.get(ip) ?? []).filter(
      (t): boolean => t > windowStart,
    );

    if (timestamps.length >= ADMIN_RATE_LIMIT_MAX_REQUESTS) {
      this.requests.set(ip, timestamps);
      return false;
    }

    timestamps.push(now);
    this.requests.set(ip, timestamps);
    return true;
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
  private adminOptions?: HttpTransportAdminOptions;
  private adminRateLimiter = new AdminRateLimiter();

  constructor(
    serverFactory: McpServer | (() => McpServer),
    config: TransportConfig,
    adminOptions?: HttpTransportAdminOptions,
  ) {
    // Support both a factory function and a direct server instance for backwards compatibility
    this.serverFactory = typeof serverFactory === 'function' ? serverFactory : () => serverFactory;
    this.app = express();
    this.sessionManager = new HttpFullSessionManager();
    this.config = {
      mode: config.mode,
      port: config.port ?? 3000,
      host: config.host ?? 'localhost',
    };
    this.adminOptions = adminOptions;

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
  }

  private setupRoutes(): void {
    // Handle POST requests for client-to-server communication
    this.app.post('/mcp', async (req: Request, res: Response) => {
      try {
        await this.handlePostRequest(req, res);
      } catch (error) {
        console.error(`Failed to handle MCP POST request: ${toErrorMessage(error)}`);
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Failed to handle MCP POST request.',
          },
          id: null,
        });
      }
    });

    // Handle GET requests for server-to-client notifications via SSE
    this.app.get('/mcp', async (req: Request, res: Response) => {
      try {
        await this.handleGetRequest(req, res);
      } catch (error) {
        console.error(`Failed to handle MCP GET request: ${toErrorMessage(error)}`);
        res.status(500).send('Failed to handle MCP GET request.');
      }
    });

    // Handle DELETE requests for session termination
    this.app.delete('/mcp', async (req: Request, res: Response) => {
      try {
        await this.handleDeleteRequest(req, res);
      } catch (error) {
        console.error(`Failed to handle MCP DELETE request: ${toErrorMessage(error)}`);
        res.status(500).send('Failed to handle MCP DELETE request.');
      }
    });

    // Health check endpoint
    this.app.get('/health', (_req: Request, res: Response) => {
      const payload: HttpTransportHealthResponse = {
        status: 'ok',
        transport: 'http',
        serverId: this.adminOptions?.serverId,
      };
      res.json(payload);
    });

    // Authenticated shutdown endpoint
    this.app.post('/admin/shutdown', async (req: Request, res: Response) => {
      try {
        await this.handleAdminShutdownRequest(req, res);
      } catch (error) {
        console.error(`Failed to process shutdown request: ${toErrorMessage(error)}`);
        const payload: HttpTransportShutdownResponse = {
          ok: false,
          message: 'Failed to process shutdown request.',
          serverId: this.adminOptions?.serverId,
        };
        res.status(500).json(payload);
      }
    });
  }

  private isAuthorizedShutdownRequest(req: Request): boolean {
    const expectedToken = this.adminOptions?.shutdownToken;
    if (!expectedToken) {
      return false;
    }

    const authHeader = req.headers.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.slice('Bearer '.length) === expectedToken;
    }

    const tokenHeader = req.headers['x-one-mcp-shutdown-token'];
    return typeof tokenHeader === 'string' && tokenHeader === expectedToken;
  }

  private async handleAdminShutdownRequest(req: Request, res: Response): Promise<void> {
    try {
      const clientIp = req.ip ?? req.socket.remoteAddress ?? 'unknown';
      if (!this.adminRateLimiter.isAllowed(clientIp)) {
        const payload: HttpTransportShutdownResponse = {
          ok: false,
          message: 'Too many shutdown requests. Try again later.',
          serverId: this.adminOptions?.serverId,
        };
        res.status(429).json(payload);
        return;
      }

      if (!this.adminOptions?.onShutdownRequested) {
        const payload: HttpTransportShutdownResponse = {
          ok: false,
          message: 'Shutdown endpoint is not enabled for this server instance.',
          serverId: this.adminOptions?.serverId,
        };
        res.status(404).json(payload);
        return;
      }

      if (!this.isAuthorizedShutdownRequest(req)) {
        const payload: HttpTransportShutdownResponse = {
          ok: false,
          message: 'Unauthorized shutdown request: invalid or missing shutdown token.',
          serverId: this.adminOptions?.serverId,
        };
        res.status(401).json(payload);
        return;
      }

      const payload: HttpTransportShutdownResponse = {
        ok: true,
        message: 'Shutdown request accepted. Stopping server gracefully.',
        serverId: this.adminOptions?.serverId,
      };
      res.json(payload);

      await this.adminOptions.onShutdownRequested();
    } catch (error) {
      throw new Error(`Failed to handle admin shutdown request: ${toErrorMessage(error)}`);
    }
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
        onsessioninitialized: (initializedSessionId) => {
          this.sessionManager.setSession(initializedSessionId, transport, mcpServer);
        },
      });

      // Clean up transport when closed
      transport.onclose = () => {
        if (transport.sessionId) {
          this.sessionManager.deleteSession(transport.sessionId);
        }
      };

      try {
        // Connect the new MCP server instance to the transport
        await mcpServer.connect(transport);
      } catch (error) {
        throw new Error(
          `Failed to connect MCP server transport for initialization request: ${toErrorMessage(error)}`,
        );
      }
    } else {
      // Invalid request
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message:
            sessionId === undefined
              ? 'Bad Request: missing session ID and request body is not an initialize request.'
              : `Bad Request: unknown session ID '${sessionId}'.`,
        },
        id: null,
      });
      return;
    }

    try {
      // Handle the request
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      throw new Error(`Failed handling MCP transport request: ${toErrorMessage(error)}`);
    }
  }

  private async handleGetRequest(req: Request, res: Response): Promise<void> {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (!sessionId || !this.sessionManager.hasSession(sessionId)) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }

    // biome-ignore lint/style/noNonNullAssertion: value guaranteed by context
    const session = this.sessionManager.getSession(sessionId)!;
    try {
      await session.transport.handleRequest(req, res);
    } catch (error) {
      throw new Error(`Failed handling MCP GET request for session '${sessionId}': ${toErrorMessage(error)}`);
    }
  }

  private async handleDeleteRequest(req: Request, res: Response): Promise<void> {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (!sessionId || !this.sessionManager.hasSession(sessionId)) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }

    // biome-ignore lint/style/noNonNullAssertion: value guaranteed by context
    const session = this.sessionManager.getSession(sessionId)!;
    try {
      await session.transport.handleRequest(req, res);
    } catch (error) {
      throw new Error(
        `Failed handling MCP DELETE request for session '${sessionId}': ${toErrorMessage(error)}`,
      );
    }

    // Clean up session
    this.sessionManager.deleteSession(sessionId);
  }

  async start(): Promise<void> {
    try {
      const server = this.app.listen(this.config.port, this.config.host);
      this.server = server;

      const listeningPromise = (async (): Promise<void> => {
        await once(server, 'listening');
      })();

      const errorPromise = (async (): Promise<void> => {
        const [error] = await once(server, 'error');
        throw error instanceof Error ? error : new Error(String(error));
      })();

      await Promise.race([listeningPromise, errorPromise]);

      console.error(
        `@agiflowai/one-mcp MCP server started on http://${this.config.host}:${this.config.port}/mcp`,
      );
      console.error(`Health check: http://${this.config.host}:${this.config.port}/health`);
    } catch (error) {
      this.server = null;
      throw new Error(`Failed to start HTTP transport: ${toErrorMessage(error)}`);
    }
  }

  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    this.sessionManager.clear();

    const closeServer = promisify(this.server.close.bind(this.server));

    try {
      await closeServer();
      this.server = null;
    } catch (error) {
      throw new Error(`Failed to stop HTTP transport: ${toErrorMessage(error)}`);
    }
  }

  getPort(): number {
    return this.config.port;
  }

  getHost(): string {
    return this.config.host;
  }
}
