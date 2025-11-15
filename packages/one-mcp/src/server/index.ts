/**
 * MCP Server Setup
 *
 * DESIGN PATTERNS:
 * - Factory pattern for server creation
 * - Tool registration pattern
 * - Dependency injection for services
 *
 * CODING STANDARDS:
 * - Register all tools, resources, and prompts here
 * - Keep server setup modular and extensible
 * - Import tools from ../tools/ and register them in the handlers
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ConfigFetcherService } from '../services/ConfigFetcherService';
import { McpClientManagerService } from '../services/McpClientManagerService';
import { DescribeToolsTool } from '../tools/DescribeToolsTool';
import { UseToolTool } from '../tools/UseToolTool';

export interface ServerOptions {
  configFilePath?: string;
  configUrl?: string;
  noCache?: boolean;
}

export async function createServer(options?: ServerOptions): Promise<Server> {
  const server = new Server(
    {
      name: '@agiflowai/one-mcp',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Initialize services
  const clientManager = new McpClientManagerService();

  // Load and connect to MCP servers if config is provided
  if (options?.configFilePath || options?.configUrl) {
    try {
      const configFetcher = new ConfigFetcherService({
        configFilePath: options.configFilePath,
        configUrl: options.configUrl,
      });

      // Force refresh if noCache option is enabled
      const config = await configFetcher.fetchConfiguration(options.noCache || false);

      // Connect to all configured MCP servers
      const connectionPromises = Object.entries(config.mcpServers).map(
        async ([serverName, serverConfig]) => {
          try {
            await clientManager.connectToServer(serverName, serverConfig);
            console.error(`Connected to MCP server: ${serverName}`);
          } catch (error) {
            console.error(`Failed to connect to ${serverName}:`, error);
          }
        }
      );

      await Promise.all(connectionPromises);
    } catch (error) {
      console.error('Failed to load MCP configuration:', error);
    }
  }

  // Initialize tools with dependencies
  const describeTools = new DescribeToolsTool(clientManager);
  const useTool = new UseToolTool(clientManager);

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      await describeTools.getDefinition(),
      useTool.getDefinition(),
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === DescribeToolsTool.TOOL_NAME) {
      return await describeTools.execute(args as any);
    }

    if (name === UseToolTool.TOOL_NAME) {
      return await useTool.execute(args as any);
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  return server;
}
