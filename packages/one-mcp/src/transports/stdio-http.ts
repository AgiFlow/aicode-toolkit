/**
 * STDIO-HTTP Proxy Transport
 *
 * DESIGN PATTERNS:
 * - Transport handler pattern implementing TransportHandler interface
 * - STDIO transport with MCP request forwarding to HTTP backend
 * - Graceful cleanup with error isolation
 *
 * CODING STANDARDS:
 * - Use StdioServerTransport for stdio communication
 * - Reuse a single StreamableHTTP client connection
 * - Wrap async operations with try-catch and descriptive errors
 *
 * AVOID:
 * - Starting HTTP server lifecycle in this transport entry point
 * - Recreating HTTP client per request
 * - Swallowing cleanup failures silently
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type {
  CallToolRequest,
  GetPromptRequest,
  ReadResourceRequest,
} from '@modelcontextprotocol/sdk/types.js';
import type { TransportHandler } from '../types';

interface StdioHttpProxyTransportConfig {
  endpoint: URL;
}

/**
 * Transport that serves MCP over stdio and forwards MCP requests to an HTTP endpoint.
 */
export class StdioHttpTransportHandler implements TransportHandler {
  private readonly endpoint: URL;
  private stdioProxyServer: Server | null = null;
  private stdioTransport: StdioServerTransport | null = null;
  private httpClient: Client | null = null;

  constructor(config: StdioHttpProxyTransportConfig) {
    this.endpoint = config.endpoint;
  }

  async start(): Promise<void> {
    try {
      const httpClientTransport = new StreamableHTTPClientTransport(this.endpoint);
      const client = new Client(
        {
          name: '@agiflowai/one-mcp-stdio-http-proxy',
          version: '0.1.0',
        },
        {
          capabilities: {},
        },
      );

      await client.connect(httpClientTransport);

      this.httpClient = client;
      this.stdioProxyServer = this.createProxyServer(client);
      this.stdioTransport = new StdioServerTransport();

      await this.stdioProxyServer.connect(this.stdioTransport);
      console.error(`@agiflowai/one-mcp MCP stdio proxy connected to ${this.endpoint.toString()}`);
    } catch (error) {
      await this.stop();
      throw new Error(
        `Failed to start stdio-http proxy transport: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async stop(): Promise<void> {
    const stdioTransport = this.stdioTransport;
    const stdioProxyServer = this.stdioProxyServer;
    const httpClient = this.httpClient;

    this.stdioTransport = null;
    this.stdioProxyServer = null;
    this.httpClient = null;

    const cleanupErrors: string[] = [];

    await Promise.all([
      (async (): Promise<void> => {
        try {
          if (stdioTransport) {
            await stdioTransport.close();
          }
        } catch (error) {
          cleanupErrors.push(
            `failed closing stdio transport: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      })(),
      (async (): Promise<void> => {
        try {
          if (stdioProxyServer) {
            await stdioProxyServer.close();
          }
        } catch (error) {
          cleanupErrors.push(
            `failed closing stdio proxy server: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      })(),
      (async (): Promise<void> => {
        try {
          if (httpClient) {
            await httpClient.close();
          }
        } catch (error) {
          cleanupErrors.push(
            `failed closing http client: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      })(),
    ]);

    if (cleanupErrors.length > 0) {
      throw new Error(`Failed to stop stdio-http proxy transport: ${cleanupErrors.join('; ')}`);
    }
  }

  private createProxyServer(client: Client): Server {
    const proxyServer = new Server(
      {
        name: '@agiflowai/one-mcp-stdio-http-proxy',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      },
    );

    proxyServer.setRequestHandler(ListToolsRequestSchema, async () => {
      try {
        return await client.listTools();
      } catch (error) {
        throw new Error(
          `Failed forwarding tools/list to HTTP backend: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });

    proxyServer.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
      try {
        return await client.callTool({
          name: request.params.name,
          arguments: request.params.arguments,
        });
      } catch (error) {
        throw new Error(
          `Failed forwarding tools/call (${request.params.name}) to HTTP backend: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });

    proxyServer.setRequestHandler(ListResourcesRequestSchema, async () => {
      try {
        return await client.listResources();
      } catch (error) {
        throw new Error(
          `Failed forwarding resources/list to HTTP backend: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });

    proxyServer.setRequestHandler(ReadResourceRequestSchema, async (request: ReadResourceRequest) => {
      try {
        return await client.readResource({ uri: request.params.uri });
      } catch (error) {
        throw new Error(
          `Failed forwarding resources/read (${request.params.uri}) to HTTP backend: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });

    proxyServer.setRequestHandler(ListPromptsRequestSchema, async () => {
      try {
        return await client.listPrompts();
      } catch (error) {
        throw new Error(
          `Failed forwarding prompts/list to HTTP backend: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });

    proxyServer.setRequestHandler(GetPromptRequestSchema, async (request: GetPromptRequest) => {
      try {
        return await client.getPrompt({
          name: request.params.name,
          arguments: request.params.arguments,
        });
      } catch (error) {
        throw new Error(
          `Failed forwarding prompts/get (${request.params.name}) to HTTP backend: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });

    return proxyServer;
  }
}
