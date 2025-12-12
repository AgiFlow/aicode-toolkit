import { ProjectConfigResolver } from '@agiflowai/aicode-utils';
import { Command } from 'commander';
import { createServer } from '../server';
import { HttpTransportHandler } from '../transports/http';
import { SseTransportHandler } from '../transports/sse';
import { StdioTransportHandler } from '../transports/stdio';
import { type TransportConfig, type TransportHandler, TransportMode } from '../transports/types';

/**
 * Start MCP server with given transport handler
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
      console.error(
        'Error during shutdown:',
        error instanceof Error ? error.message : String(error),
      );
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
  .option('--admin-enable', 'Enable admin tools (generate-boilerplate)', false)
  .option(
    '--prompt-as-skill',
    'Render prompts with skill front matter for Claude Code skills',
    false,
  )
  .action(async (options) => {
    try {
      const transportType = options.type.toLowerCase();

      // Detect if current workspace is monolith
      let isMonolith = false;
      try {
        const projectConfig = await ProjectConfigResolver.resolveProjectConfig(process.cwd());
        isMonolith = projectConfig.type === 'monolith';
      } catch {
        // No project configuration found, default to monorepo mode
        isMonolith = false;
      }

      const serverOptions = {
        adminEnabled: options.adminEnable,
        isMonolith,
        promptAsSkill: options.promptAsSkill,
      };

      if (transportType === 'stdio') {
        const server = createServer(serverOptions);
        const handler = new StdioTransportHandler(server);
        await startServer(handler);
      } else if (transportType === 'http') {
        // For HTTP, pass a factory function to create new server instances per session
        const config: TransportConfig = {
          mode: TransportMode.HTTP,
          port: options.port || Number(process.env.MCP_PORT) || 3000,
          host: options.host || process.env.MCP_HOST || 'localhost',
        };
        const handler = new HttpTransportHandler(() => createServer(serverOptions), config);
        await startServer(handler);
      } else if (transportType === 'sse') {
        // For SSE, pass a factory function to create new server instances per connection
        const config: TransportConfig = {
          mode: TransportMode.SSE,
          port: options.port || Number(process.env.MCP_PORT) || 3000,
          host: options.host || process.env.MCP_HOST || 'localhost',
        };
        const handler = new SseTransportHandler(() => createServer(serverOptions), config);
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
