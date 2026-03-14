/**
 * MCP Serve Command
 *
 * DESIGN PATTERNS:
 * - Command pattern with Commander for CLI argument parsing
 * - Transport abstraction pattern for flexible deployment (stdio, HTTP, SSE)
 * - Factory pattern for creating transport handlers
 * - Graceful shutdown pattern with signal handling
 *
 * CODING STANDARDS:
 * - Use async/await for asynchronous operations
 * - Implement proper error handling with try-catch blocks
 * - Handle process signals for graceful shutdown
 * - Provide clear CLI options and help messages
 *
 * AVOID:
 * - Hardcoded configuration values (use CLI options or environment variables)
 * - Missing error handling for transport startup
 * - Not cleaning up resources on shutdown
 */

import { Command } from 'commander';
import {
  type ServerOptions,
  TRANSPORT_MODE,
  HttpTransportHandler,
  SseTransportHandler,
  StdioHttpTransportHandler,
  StdioTransportHandler,
  type TransportConfig,
  type TransportHandler,
  createServer,
  findConfigFile,
} from '..';

/**
 * Valid transport types for the MCP server
 */
type ValidTransportType = 'stdio' | 'http' | 'sse' | 'stdio-http';

/**
 * Type guard to validate transport type
 * @param type - The transport type string to validate
 * @returns True if the type is a valid transport type
 */
function isValidTransportType(type: string): type is ValidTransportType {
  return type === 'stdio' || type === 'http' || type === 'sse' || type === 'stdio-http';
}

function isValidProxyMode(mode: string): mode is McpServeOptions['proxyMode'] {
  return mode === 'meta' || mode === 'flat' || mode === 'search';
}

function isAddressInUseError(error: unknown): boolean {
  if (error instanceof Error && error.message.includes('EADDRINUSE')) {
    return true;
  }

  if (typeof error !== 'object' || error === null) {
    return false;
  }

  if ('code' in error && error.code === 'EADDRINUSE') {
    return true;
  }

  if ('message' in error && typeof error.message === 'string' && error.message.includes('EADDRINUSE')) {
    return true;
  }

  return false;
}

/**
 * Options for the mcp-serve command
 */
interface McpServeOptions {
  type: string;
  port: number;
  host: string;
  config?: string;
  cache: boolean;
  id?: string;
  definitionsCache?: string;
  clearDefinitionsCache: boolean;
  proxyMode: 'meta' | 'flat' | 'search';
}

/**
 * Start MCP server with given transport handler
 * @param handler - The transport handler to start
 */
async function startServer(handler: TransportHandler): Promise<void> {
  try {
    await handler.start();
  } catch (error) {
    throw new Error(
      `Failed to start transport handler: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // Handle graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    console.error(`\nReceived ${signal}, shutting down gracefully...`);
    try {
      await handler.stop();
      process.exit(0);
    } catch (error) {
      console.error(
        `Failed to gracefully stop transport during ${signal}: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }
  };

  process.on('SIGINT', async (): Promise<void> => await shutdown('SIGINT'));
  process.on('SIGTERM', async (): Promise<void> => await shutdown('SIGTERM'));
}

/**
 * MCP Serve command
 */
export const mcpServeCommand = new Command('mcp-serve')
  .description('Start MCP server with specified transport')
  .option('-t, --type <type>', 'Transport type: stdio, http, sse, or stdio-http', 'stdio')
  .option(
    '-p, --port <port>',
    'Port to listen on (http/sse/stdio-http internal HTTP)',
    (val: string): number => parseInt(val, 10),
    3000,
  )
  .option('--host <host>', 'Host to bind to (http/sse/stdio-http internal HTTP)', 'localhost')
  .option('-c, --config <path>', 'Path to MCP server configuration file')
  .option('--no-cache', 'Disable configuration caching, always reload from config file')
  .option(
    '--definitions-cache <path>',
    'Path to prefetched tool/prompt/skill definitions cache file',
  )
  .option('--clear-definitions-cache', 'Delete definitions cache before startup', false)
  .option(
    '--proxy-mode <mode>',
    'How one-mcp exposes downstream tools: meta, flat, or search',
    'meta',
  )
  .option(
    '--id <id>',
    'Unique server identifier (overrides config file id, auto-generated if not provided)',
  )
  .action(async (options: McpServeOptions): Promise<void> => {
    const transportType = options.type.toLowerCase();

    // Validate transport type
    if (!isValidTransportType(transportType)) {
      console.error(
        `Unknown transport type: '${transportType}'. Valid options: stdio, http, sse, stdio-http`,
      );
      process.exit(1);
    }

    if (!isValidProxyMode(options.proxyMode)) {
      console.error(`Unknown proxy mode: '${options.proxyMode}'. Valid options: meta, flat, search`);
      process.exit(1);
    }

    try {
      // Find config file: use provided path, or search PROJECT_PATH then cwd
      const resolvedConfigPath = options.config || findConfigFile() || undefined;

      const serverOptions: ServerOptions = {
        configFilePath: resolvedConfigPath,
        noCache: options.cache === false, // Commander transforms --no-cache to cache: false
        serverId: options.id, // CLI ID takes precedence over config file
        definitionsCachePath: options.definitionsCache,
        clearDefinitionsCache: options.clearDefinitionsCache,
        proxyMode: options.proxyMode,
      };

      if (transportType === 'stdio') {
        const server = await createServer(serverOptions);
        const handler = new StdioTransportHandler(server);
        await startServer(handler);
      } else if (transportType === 'http') {
        // For HTTP, pass the server instance directly (handler will create sessions)
        const server = await createServer(serverOptions);
        const config: TransportConfig = {
          mode: TRANSPORT_MODE.HTTP,
          port: options.port || Number(process.env.MCP_PORT) || 3000,
          host: options.host || process.env.MCP_HOST || 'localhost',
        };
        const handler = new HttpTransportHandler(server, config);
        await startServer(handler);
      } else if (transportType === 'sse') {
        // For SSE, pass the server instance directly (handler will create sessions)
        const server = await createServer(serverOptions);
        const config: TransportConfig = {
          mode: TRANSPORT_MODE.SSE,
          port: options.port || Number(process.env.MCP_PORT) || 3000,
          host: options.host || process.env.MCP_HOST || 'localhost',
        };
        const handler = new SseTransportHandler(server, config);
        await startServer(handler);
      } else if (transportType === 'stdio-http') {
        const config: TransportConfig = {
          mode: TRANSPORT_MODE.HTTP,
          port: options.port || Number(process.env.MCP_PORT) || 3000,
          host: options.host || process.env.MCP_HOST || 'localhost',
        };
        const endpoint = new URL(`http://${config.host}:${config.port}/mcp`);

        const stdioHttpHandler = new StdioHttpTransportHandler({ endpoint });

        let httpHandler: HttpTransportHandler | null = null;
        let ownsInternalHttpTransport = false;

        const handler: TransportHandler = {
          async start(): Promise<void> {
            let initialProxyConnectError: unknown;

            try {
              await stdioHttpHandler.start();
              return;
            } catch (error) {
              initialProxyConnectError = error;
            }

            try {
              const server = await createServer(serverOptions);
              httpHandler = new HttpTransportHandler(server, config);
              await httpHandler.start();
              ownsInternalHttpTransport = true;
            } catch (error) {
              if (!isAddressInUseError(error)) {
                throw new Error(
                  `Failed to start internal HTTP transport for stdio-http proxy: ${error instanceof Error ? error.message : String(error)}`,
                );
              }
            }

            try {
              await stdioHttpHandler.start();
            } catch (error) {
              let rollbackStopErrorMessage = '';

              if (ownsInternalHttpTransport && httpHandler) {
                try {
                  await httpHandler.stop();
                } catch (stopError) {
                  rollbackStopErrorMessage =
                    stopError instanceof Error ? stopError.message : String(stopError);
                }
                ownsInternalHttpTransport = false;
              }

              const retryErrorMessage = error instanceof Error ? error.message : String(error);
              const initialErrorMessage =
                initialProxyConnectError instanceof Error
                  ? initialProxyConnectError.message
                  : String(initialProxyConnectError);
              const rollbackMessage = rollbackStopErrorMessage
                ? `; rollback stop failed: ${rollbackStopErrorMessage}`
                : '';

              throw new Error(
                `Failed to start stdio-http proxy bridge: initial connect failed (${initialErrorMessage}); retry failed (${retryErrorMessage})${rollbackMessage}`,
              );
            }
          },
          async stop(): Promise<void> {
            const stopErrors: string[] = [];

            try {
              await stdioHttpHandler.stop();
            } catch (error) {
              stopErrors.push(
                `Failed stopping stdio-http proxy: ${error instanceof Error ? error.message : String(error)}`,
              );
            }

            if (ownsInternalHttpTransport && httpHandler) {
              try {
                await httpHandler.stop();
              } catch (error) {
                stopErrors.push(
                  `Failed stopping internal HTTP transport: ${error instanceof Error ? error.message : String(error)}`,
                );
              }
              ownsInternalHttpTransport = false;
            }

            if (stopErrors.length > 0) {
              throw new Error(stopErrors.join('; '));
            }
          },
        };

        await startServer(handler);
      }
    } catch (error) {
      const startErrorMessage = error instanceof Error ? error.message : String(error);
      if (transportType === 'stdio') {
        console.error(`Failed to start MCP server with transport '${transportType}': ${startErrorMessage}`);
      } else {
        console.error(
          `Failed to start MCP server with transport '${transportType}' on ${options.host}:${options.port}: ${startErrorMessage}`,
        );
      }
      process.exit(1);
    }
  });
