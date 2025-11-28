import { print } from '@agiflowai/aicode-utils';
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
import { HttpTransportHandler } from '../transports/http';
import { SseTransportHandler } from '../transports/sse';
import { StdioTransportHandler } from '../transports/stdio';
import { type TransportConfig, type TransportHandler, TransportMode } from '../transports/types';
import {
  type LlmToolId,
  isValidLlmTool,
  SUPPORTED_LLM_TOOLS,
} from '@agiflowai/coding-agent-bridge';

/**
 * Start MCP server with given transport handler
 */
async function startServer(handler: TransportHandler) {
  await handler.start();

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    print.error(`\nReceived ${signal}, shutting down gracefully...`);
    try {
      await handler.stop();
      process.exit(0);
    } catch (error) {
      print.error('Error during shutdown:', error instanceof Error ? error : String(error));
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
  .option(
    '--design-pattern-tool <tool>',
    `LLM tool for design pattern analysis. Supported: ${SUPPORTED_LLM_TOOLS.join(', ')}`,
    undefined,
  )
  .option(
    '--review-tool <tool>',
    `LLM tool for code review. Supported: ${SUPPORTED_LLM_TOOLS.join(', ')}`,
    undefined,
  )
  .option('--admin-enable', 'Enable admin tools (add_design_pattern, add_rule)', false)
  .action(async (options) => {
    try {
      const transportType = options.type.toLowerCase();
      const adminEnabled = options.adminEnable as boolean;

      // Validate design-pattern-tool option
      let designPatternTool: LlmToolId | undefined;
      if (options.designPatternTool) {
        if (!isValidLlmTool(options.designPatternTool)) {
          print.error(
            `Invalid design pattern tool: ${options.designPatternTool}. Supported: ${SUPPORTED_LLM_TOOLS.join(', ')}`,
          );
          process.exit(1);
        }
        designPatternTool = options.designPatternTool as LlmToolId;
      }

      // Validate review-tool option
      let reviewTool: LlmToolId | undefined;
      if (options.reviewTool) {
        if (!isValidLlmTool(options.reviewTool)) {
          print.error(
            `Invalid review tool: ${options.reviewTool}. Supported: ${SUPPORTED_LLM_TOOLS.join(', ')}`,
          );
          process.exit(1);
        }
        reviewTool = options.reviewTool as LlmToolId;
      }

      const serverOptions = {
        designPatternTool,
        reviewTool,
        adminEnabled,
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
        print.error(`Unknown transport type: ${transportType}. Use: stdio, http, or sse`);
        process.exit(1);
      }
    } catch (error) {
      print.error('Failed to start MCP server:', error instanceof Error ? error : String(error));
      process.exit(1);
    }
  });
