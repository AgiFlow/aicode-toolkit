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

import { ProjectConfigResolver, print } from '@agiflowai/aicode-utils';
import {
  type LlmToolId,
  isValidLlmTool,
  SUPPORTED_LLM_TOOLS,
} from '@agiflowai/coding-agent-bridge';
import { Command } from 'commander';
import { createServer, type ServerOptions } from '..';
import {
  HttpTransportHandler,
  SseTransportHandler,
  StdioTransportHandler,
  TransportMode,
  type TransportConfig,
  type TransportHandler,
} from '../transports';

/**
 * Options passed by Commander for the mcp-serve command
 */
interface McpServeOptions {
  type: string;
  port: number;
  host: string;
  adminEnable: boolean;
  promptAsSkill: boolean;
  fallbackTool?: string;
  fallbackToolConfig?: string;
}

/**
 * Type guard to verify a parsed JSON value is a plain object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validate and resolve an LLM tool option. Throws on invalid input.
 */
function parseLlmToolOption(value: string | undefined, flagName: string): LlmToolId | undefined {
  if (!value) return undefined;
  if (!isValidLlmTool(value)) {
    throw new Error(`Invalid ${flagName}: ${value}. Supported: ${SUPPORTED_LLM_TOOLS.join(', ')}`);
  }
  return value;
}

/**
 * Parse a JSON config string option. Throws on parse failure or non-object value.
 */
function parseJsonConfig(
  value: string | undefined,
  flagName: string,
): Record<string, unknown> | undefined {
  if (!value) return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) {
      throw new Error(`Invalid JSON for ${flagName}: expected a JSON object`);
    }
    return parsed;
  } catch (error) {
    throw new Error(
      `Invalid JSON for ${flagName}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Start MCP server with given transport handler
 */
async function startServer(handler: TransportHandler): Promise<void> {
  try {
    await handler.start();
  } catch (error) {
    throw new Error(
      `Failed to start transport: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const shutdown = async (signal: string): Promise<void> => {
    print.error(`\nReceived ${signal}, shutting down gracefully...`);
    try {
      await handler.stop();
      process.exit(0);
    } catch (error) {
      print.error('Error during shutdown:', error instanceof Error ? error : String(error));
      process.exit(1);
    }
  };

  process.on('SIGINT', async (): Promise<void> => {
    try {
      await shutdown('SIGINT');
    } catch (error) {
      print.error('Unexpected shutdown error:', error instanceof Error ? error : String(error));
    }
  });
  process.on('SIGTERM', async (): Promise<void> => {
    try {
      await shutdown('SIGTERM');
    } catch (error) {
      print.error('Unexpected shutdown error:', error instanceof Error ? error : String(error));
    }
  });
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
    (val: string): number => parseInt(val, 10),
    3000,
  )
  .option('--host <host>', 'Host to bind to (http/sse only)', 'localhost')
  .option('--admin-enable', 'Enable admin tools (generate-boilerplate)', false)
  .option(
    '--prompt-as-skill',
    'Render prompts with skill front matter for Claude Code skills',
    false,
  )
  .option(
    '--fallback-tool <tool>',
    `Fallback LLM tool for scaffold operations. Supported: ${SUPPORTED_LLM_TOOLS.join(', ')}`,
    undefined,
  )
  .option(
    '--fallback-tool-config <json>',
    'JSON config for fallback tool (e.g., \'{"model":"claude-sonnet-4-6"}\')',
    undefined,
  )
  .action(async (options: McpServeOptions): Promise<void> => {
    try {
      const transportType = options.type.toLowerCase();

      const fallbackTool = parseLlmToolOption(options.fallbackTool, '--fallback-tool');
      const fallbackToolConfig = parseJsonConfig(
        options.fallbackToolConfig,
        '--fallback-tool-config',
      );

      // Detect if current workspace is monolith
      let isMonolith = false;
      try {
        const projectConfig = await ProjectConfigResolver.resolveProjectConfig(process.cwd());
        isMonolith = projectConfig.type === 'monolith';
      } catch (error) {
        // No project configuration found, default to monorepo mode
        print.info(
          `No project config found, defaulting to monorepo mode: ${error instanceof Error ? error.message : String(error)}`,
        );
        isMonolith = false;
      }

      const serverOptions: ServerOptions = {
        adminEnabled: options.adminEnable,
        isMonolith,
        promptAsSkill: options.promptAsSkill,
        fallbackTool,
        fallbackToolConfig,
      };

      if (transportType === TransportMode.STDIO) {
        const server = createServer(serverOptions);
        const handler = new StdioTransportHandler(server);
        await startServer(handler);
      } else if (transportType === TransportMode.HTTP) {
        const config: TransportConfig = {
          mode: TransportMode.HTTP,
          port: options.port || Number(process.env.MCP_PORT) || 3000,
          host: options.host || process.env.MCP_HOST || 'localhost',
        };
        const handler = new HttpTransportHandler(
          (): ReturnType<typeof createServer> => createServer(serverOptions),
          config,
        );
        await startServer(handler);
      } else if (transportType === TransportMode.SSE) {
        const config: TransportConfig = {
          mode: TransportMode.SSE,
          port: options.port || Number(process.env.MCP_PORT) || 3000,
          host: options.host || process.env.MCP_HOST || 'localhost',
        };
        const handler = new SseTransportHandler(
          (): ReturnType<typeof createServer> => createServer(serverOptions),
          config,
        );
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
