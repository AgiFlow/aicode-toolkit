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

import { TemplatesManagerService, print } from '@agiflowai/aicode-utils';
import { Command } from 'commander';
import { createServer } from '../server';
import {
  HttpTransportHandler,
  SseTransportHandler,
  StdioTransportHandler,
  TransportMode,
  type TransportConfig,
  type TransportHandler,
} from '../transports';
import { type LlmToolId, isValidLlmTool, SUPPORTED_LLM_TOOLS } from '@agiflowai/coding-agent-bridge';

/**
 * Options passed by Commander for the mcp-serve command
 */
interface McpServeOptions {
  type?: string;
  port?: number;
  host?: string;
  designPatternTool?: string;
  reviewTool?: string;
  designPatternToolConfig?: string;
  reviewToolConfig?: string;
  fallbackTool?: string;
  fallbackToolConfig?: string;
  adminEnable: boolean;
}

/**
 * Resolved options forwarded to createServer()
 */
interface ServerOptions {
  designPatternTool?: LlmToolId;
  designPatternToolConfig?: Record<string, unknown>;
  reviewTool?: LlmToolId;
  reviewToolConfig?: Record<string, unknown>;
  adminEnabled: boolean;
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
function parseJsonConfig(value: string | undefined, flagName: string): Record<string, unknown> | undefined {
  if (!value) return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) {
      throw new Error(`Invalid JSON for ${flagName}: expected a JSON object`);
    }
    return parsed;
  } catch (error) {
    throw new Error(`Invalid JSON for ${flagName}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Start MCP server with given transport handler
 */
async function startServer(handler: TransportHandler): Promise<void> {
  try {
    await handler.start();
  } catch (error) {
    print.error('Failed to start transport:', error instanceof Error ? error : String(error));
    process.exit(1);
  }

  // Handle graceful shutdown
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

  process.on('SIGINT', async (): Promise<void> => { await shutdown('SIGINT'); });
  process.on('SIGTERM', async (): Promise<void> => { await shutdown('SIGTERM'); });
}

/**
 * MCP Serve command
 */
export const mcpServeCommand = new Command('mcp-serve')
  .description('Start MCP server with specified transport')
  .option('-t, --type <type>', 'Transport type: stdio, http, or sse')
  .option(
    '-p, --port <port>',
    'Port to listen on (http/sse only)',
    (val: string): number => parseInt(val, 10),
  )
  .option('--host <host>', 'Host to bind to (http/sse only)')
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
  .option(
    '--design-pattern-tool-config <json>',
    'JSON config for design pattern tool (e.g., \'{"model":"claude-opus-4"}\')',
    undefined,
  )
  .option(
    '--review-tool-config <json>',
    'JSON config for review tool (e.g., \'{"model":"gpt-5.2-high"}\')',
    undefined,
  )
  .option(
    '--fallback-tool <tool>',
    `Fallback LLM tool used when --review-tool or --design-pattern-tool is not set. Supported: ${SUPPORTED_LLM_TOOLS.join(', ')}`,
    undefined,
  )
  .option(
    '--fallback-tool-config <json>',
    'JSON config for fallback tool (e.g., \'{"model":"claude-sonnet-4-6"}\')',
    undefined,
  )
  .option('--admin-enable', 'Enable admin tools (add_design_pattern, add_rule)', false)
  .action(async (options: McpServeOptions): Promise<void> => {
    try {
      // Read config file; CLI flags take precedence over config values
      const toolkitConfig = await TemplatesManagerService.readToolkitConfig();
      const fileConfig = toolkitConfig?.['architect-mcp']?.['mcp-serve'] ?? {};

      const transportType = (options.type ?? fileConfig.type ?? 'stdio').toLowerCase();
      const adminEnabled = options.adminEnable || fileConfig.adminEnable || false;

      const fallbackToolStr = options.fallbackTool ?? fileConfig.fallbackTool;
      const fallbackTool = parseLlmToolOption(fallbackToolStr, '--fallback-tool');

      // CLI JSON string takes precedence over config object
      const fallbackToolConfig = options.fallbackToolConfig
        ? parseJsonConfig(options.fallbackToolConfig, '--fallback-tool-config')
        : fileConfig.fallbackToolConfig;

      const designPatternToolStr = options.designPatternTool ?? fileConfig.designPatternTool;
      const designPatternTool = parseLlmToolOption(designPatternToolStr, '--design-pattern-tool');
      const designPatternToolConfig = options.designPatternToolConfig
        ? parseJsonConfig(options.designPatternToolConfig, '--design-pattern-tool-config')
        : fileConfig.designPatternToolConfig;

      const reviewToolStr = options.reviewTool ?? fileConfig.reviewTool;
      const reviewTool = parseLlmToolOption(reviewToolStr, '--review-tool');
      const reviewToolConfig = options.reviewToolConfig
        ? parseJsonConfig(options.reviewToolConfig, '--review-tool-config')
        : fileConfig.reviewToolConfig;

      // Specific tools take precedence over fallback
      const serverOptions: ServerOptions = {
        designPatternTool: designPatternTool ?? fallbackTool,
        designPatternToolConfig: designPatternToolConfig ?? fallbackToolConfig,
        reviewTool: reviewTool ?? fallbackTool,
        reviewToolConfig: reviewToolConfig ?? fallbackToolConfig,
        adminEnabled,
      };

      if (transportType === TransportMode.STDIO) {
        const server = createServer(serverOptions);
        const handler = new StdioTransportHandler(server);
        await startServer(handler);
      } else if (transportType === TransportMode.HTTP) {
        const port = options.port ?? fileConfig.port ?? Number(process.env.MCP_PORT) ?? 3000;
        const host = options.host ?? fileConfig.host ?? process.env.MCP_HOST ?? 'localhost';
        const config: TransportConfig = { mode: TransportMode.HTTP, port, host };
        const handler = new HttpTransportHandler(() => createServer(serverOptions), config);
        await startServer(handler);
      } else if (transportType === TransportMode.SSE) {
        const port = options.port ?? fileConfig.port ?? Number(process.env.MCP_PORT) ?? 3000;
        const host = options.host ?? fileConfig.host ?? process.env.MCP_HOST ?? 'localhost';
        const config: TransportConfig = { mode: TransportMode.SSE, port, host };
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
