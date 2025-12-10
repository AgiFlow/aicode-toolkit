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
import { VitejsService } from '../services';
import { StdioTransportHandler } from '../transports/stdio';

/**
 * Start MCP server with given transport handler
 */
async function startServer(handler: any, viteService: VitejsService) {
  await handler.start();

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    console.error(`\nReceived ${signal}, shutting down gracefully...`);
    try {
      // Cleanup Vite dev server if it's running
      if (viteService.isServerRunning()) {
        console.error('Stopping Vite dev server...');
        await viteService.cleanup();
      }
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
 *
 * Note: Design system configuration is now app-specific and read from each app's project.json.
 * No global theme configuration is needed at the server level.
 */
export const mcpServeCommand = new Command('mcp-serve')
  .description('Start MCP server with specified transport')
  .option('-t, --type <type>', 'Transport type: stdio', 'stdio')
  .option(
    '--theme-path <path>',
    'Default theme CSS file path relative to workspace root',
    'packages/frontend/web-theme/src/agimon-theme.css',
  )
  .option('--dev', 'Start Vite dev server for component hot reload and caching')
  .option('--app-path <path>', 'App path for dev server (e.g., apps/agiflow-app)')
  .action(async (options) => {
    try {
      const transportType = options.type.toLowerCase();

      // Start Vite dev server if --dev flag is enabled
      if (options.dev) {
        if (!options.appPath) {
          console.error('Error: --app-path is required when using --dev flag');
          console.error('Example: style-system-mcp mcp-serve --dev --app-path apps/agiflow-app');
          process.exit(1);
        }

        // Get singleton instance and start dev server
        const viteService = VitejsService.getInstance();
        const { url, port } = await viteService.startDevServer(options.appPath);
        console.log(`✅ Vite dev server started at ${url} (port: ${port})`);
        console.log('⚡ Components will be served with hot reload support and caching');
      }

      if (transportType === 'stdio') {
        const server = createServer(options.themePath);
        const handler = new StdioTransportHandler(server);
        // Pass singleton instance for cleanup
        await startServer(handler, VitejsService.getInstance());
      } else {
        console.error(`Unknown transport type: ${transportType}. Use: stdio`);
        process.exit(1);
      }
    } catch (error) {
      console.error('Failed to start MCP server:', error);
      process.exit(1);
    }
  });
