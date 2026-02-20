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
import { createServer } from '../server';
import { StdioTransportHandler } from '../transports/stdio';
import { HttpTransportHandler } from '../transports/http';
import { SseTransportHandler } from '../transports/sse';
import { type TransportConfig, type TransportHandler, TRANSPORT_MODE } from '../types';
import { findConfigFile } from '../utils';

/**
 * Valid transport types for the MCP server
 */
type ValidTransportType = 'stdio' | 'http' | 'sse';

/**
 * Type guard to validate transport type
 * @param type - The transport type string to validate
 * @returns True if the type is a valid transport type
 */
function isValidTransportType(type: string): type is ValidTransportType {
  return type === 'stdio' || type === 'http' || type === 'sse';
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
}

/**
 * Start MCP server with given transport handler
 * @param handler - The transport handler to start
 */
async function startServer(handler: TransportHandler): Promise<void> {
  await handler.start();

  // Handle graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    console.error(`\nReceived ${signal}, shutting down gracefully...`);
    try {
      await handler.stop();
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

/**
 * MCP Serve command
 */
export const mcpServeCommand = new Command('mcp-serve')
  .description('Start MCP server with specified transport')
  .option('-t, --type <type>', 'Transport type: stdio, http, or sse', 'stdio')
  .option(
    '-p, --port <port>',
    'Port to listen on (http/sse only)',
    (val) => parseInt(val, 10),
    3000,
  )
  .option('--host <host>', 'Host to bind to (http/sse only)', 'localhost')
  .option('-c, --config <path>', 'Path to MCP server configuration file')
  .option('--no-cache', 'Disable configuration caching, always reload from config file')
  .option(
    '--id <id>',
    'Unique server identifier (overrides config file id, auto-generated if not provided)',
  )
  .action(async (options: McpServeOptions): Promise<void> => {
    const transportType = options.type.toLowerCase();

    // Validate transport type
    if (!isValidTransportType(transportType)) {
      console.error(`Unknown transport type: '${transportType}'. Valid options: stdio, http, sse`);
      process.exit(1);
    }

    try {
      // Find config file: use provided path, or search PROJECT_PATH then cwd
      const configFilePath = options.config || findConfigFile() || undefined;

      const serverOptions = {
        configFilePath,
        noCache: options.cache === false, // Commander transforms --no-cache to cache: false
        serverId: options.id, // CLI ID takes precedence over config file
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
      }
    } catch (error) {
      console.error(
        `Failed to start MCP server with transport '${transportType}' on ${options.host}:${options.port}:`,
        error,
      );
      process.exit(1);
    }
  });
