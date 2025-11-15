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
import { type TransportConfig, TransportMode } from '../types';

/**
 * Start MCP server with given transport handler
 */
async function startServer(handler: any) {
  await handler.start();

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
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
  .option('--no-cache', 'Force reload configuration from source, bypassing cache')
  .action(async (options) => {
    try {
      const transportType = options.type.toLowerCase();
      const serverOptions = {
        configFilePath: options.config,
        noCache: options.cache === false, // Commander transforms --no-cache to cache: false
      };

      if (transportType === 'stdio') {
        const server = await createServer(serverOptions);
        const handler = new StdioTransportHandler(server);
        await startServer(handler);
      } else if (transportType === 'http') {
        // For HTTP, pass the server instance directly (handler will create sessions)
        const server = await createServer(serverOptions);
        const config: TransportConfig = {
          mode: TransportMode.HTTP,
          port: options.port || Number(process.env.MCP_PORT) || 3000,
          host: options.host || process.env.MCP_HOST || 'localhost',
        };
        const handler = new HttpTransportHandler(server, config);
        await startServer(handler);
      } else if (transportType === 'sse') {
        // For SSE, pass the server instance directly (handler will create sessions)
        const server = await createServer(serverOptions);
        const config: TransportConfig = {
          mode: TransportMode.SSE,
          port: options.port || Number(process.env.MCP_PORT) || 3000,
          host: options.host || process.env.MCP_HOST || 'localhost',
        };
        const handler = new SseTransportHandler(server, config);
        await startServer(handler);
      } else {
        console.error(`Unknown transport type: ${transportType}. Use: stdio, http, or sse`);
        process.exit(1);
      }
    } catch (error) {
      console.error('Failed to start MCP server:', error);
      process.exit(1);
    }
  });
