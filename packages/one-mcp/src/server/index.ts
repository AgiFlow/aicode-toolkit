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
import { SkillService } from '../services/SkillService';
import { DescribeToolsTool } from '../tools/DescribeToolsTool';
import { UseToolTool } from '../tools/UseToolTool';

/**
 * Configuration options for creating an MCP server instance
 * @property configFilePath - Path to the MCP configuration file
 * @property noCache - Skip cache when fetching remote configuration
 * @property skills - Skills configuration with paths array (optional, skills disabled if not provided)
 */
export interface ServerOptions {
  configFilePath?: string;
  noCache?: boolean;
  skills?: { paths: string[] };
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

  // Track skills config from config file (will be set if config is loaded)
  let configSkills: { paths: string[] } | undefined;

  // Load and connect to MCP servers if config is provided
  if (options?.configFilePath) {
    // Fetch configuration with proper error handling
    let config;
    try {
      const configFetcher = new ConfigFetcherService({
        configFilePath: options.configFilePath,
        useCache: !options.noCache, // Disable cache reading when --no-cache is provided
      });

      // Force refresh if noCache option is enabled
      config = await configFetcher.fetchConfiguration(options.noCache || false);
    } catch (error) {
      throw new Error(
        `Failed to load MCP configuration from '${options.configFilePath}': ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Get skills config from config file
    configSkills = config.skills;

    // Connect to all configured MCP servers and track failures
    const failedConnections: Array<{ serverName: string; error: Error }> = [];
    const connectionPromises = Object.entries(config.mcpServers).map(
      async ([serverName, serverConfig]) => {
        try {
          await clientManager.connectToServer(serverName, serverConfig);
          console.error(`Connected to MCP server: ${serverName}`);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          failedConnections.push({ serverName, error: err });
          console.error(`Failed to connect to ${serverName}:`, error);
        }
      }
    );

    await Promise.all(connectionPromises);

    // Log warning for partial failures
    if (failedConnections.length > 0 && failedConnections.length < Object.keys(config.mcpServers).length) {
      console.error(
        `Warning: Some MCP server connections failed: ${failedConnections.map((f) => f.serverName).join(', ')}`
      );
    }

    // If all connections failed, throw an error
    if (failedConnections.length > 0 && failedConnections.length === Object.keys(config.mcpServers).length) {
      throw new Error(
        `All MCP server connections failed: ${failedConnections.map((f) => `${f.serverName}: ${f.error.message}`).join(', ')}`
      );
    }
  }

  // Initialize skill service only if skills are explicitly configured
  // Skills are disabled by default since Claude Code already handles skills natively
  const skillsConfig = options?.skills || configSkills;
  const skillService = skillsConfig && skillsConfig.paths.length > 0
    ? new SkillService(process.cwd(), skillsConfig.paths)
    : undefined;

  // Initialize tools with dependencies
  const describeTools = new DescribeToolsTool(clientManager, skillService);
  const useTool = new UseToolTool(clientManager, skillService);

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      await describeTools.getDefinition(),
      useTool.getDefinition(),
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === DescribeToolsTool.TOOL_NAME) {
      try {
        return await describeTools.execute(args as any);
      } catch (error) {
        throw new Error(
          `Failed to execute ${name}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    if (name === UseToolTool.TOOL_NAME) {
      try {
        return await useTool.execute(args as any);
      } catch (error) {
        throw new Error(
          `Failed to execute ${name}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  return server;
}
