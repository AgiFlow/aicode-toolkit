/**
 * Clawdbot MCP Bridge Plugin
 *
 * DESIGN PATTERNS:
 * - Plugin pattern for Clawdbot gateway integration
 * - Bridge pattern to connect one-mcp with Clawdbot
 * - Progressive disclosure pattern (only 2 tools exposed)
 * - Service lifecycle pattern for startup/shutdown
 *
 * CODING STANDARDS:
 * - Export plugin object with register() method
 * - Do async initialization in service.start()
 * - Register describe_tools and use_tool as Clawdbot tools
 * - Register cleanup service for graceful shutdown
 * - Handle errors gracefully with logging
 *
 * AVOID:
 * - Exporting function directly (use plugin object)
 * - Registering every MCP tool individually (use progressive disclosure)
 * - Unhandled promise rejections
 * - Missing error handling
 */

import { Type } from '@sinclair/typebox';
import {
  DescribeToolsTool,
  UseToolTool,
  McpClientManagerService,
  SkillService,
  ConfigFetcherService,
} from '@agiflowai/one-mcp';
import type { ServerOptions } from '@agiflowai/one-mcp';
import type { ClawdbotApi, PluginConfig } from './types';

const mcpBridgePlugin = {
  id: 'clawdbot-mcp-plugin',
  name: 'MCP Server Bridge',
  description: 'Enables Model Context Protocol (MCP) server integration with progressive tool disclosure',
  configSchema: Type.Object({
    configFilePath: Type.Optional(Type.String({
      description: 'Path to mcp-config.yaml file (supports one-mcp\'s YAML format)',
      default: '.clawdbot/mcp-config.yaml'
    })),
    serverId: Type.Optional(Type.String({
      description: 'Unique identifier for the toolkit',
      default: 'clawdbot-mcp'
    })),
    noCache: Type.Optional(Type.Boolean({
      description: 'Disable configuration caching',
      default: false
    })),
  }),

  register(api: ClawdbotApi) {
    const pluginConfig: PluginConfig = (api as any).pluginConfig || {};

  // Build ServerOptions from plugin config
  const serverOptions: ServerOptions = {
    configFilePath: pluginConfig.configFilePath || '.clawdbot/mcp-config.yaml',
    serverId: pluginConfig.serverId || 'clawdbot-mcp',
    noCache: pluginConfig.noCache || false,
  };

  // Tool instances - will be initialized in service.start()
  let describeToolsToolInstance: DescribeToolsTool | null = null;
  let useToolToolInstance: UseToolTool | null = null;
  let isInitialized = false;
  let toolkitDescription: string | null = null;

  // Register service for async initialization
  api.registerService({
    id: 'mcp-server',
    async start() {
      try {
        api.logger.info(`[one-mcp] Initializing MCP server with config: ${serverOptions.configFilePath}`);

        const clientManager = new McpClientManagerService();

        // Load config and connect to MCP servers
        const configFetcher = new ConfigFetcherService({
          configFilePath: serverOptions.configFilePath,
          useCache: !serverOptions.noCache,
        });

        const config = await configFetcher.fetchConfiguration(serverOptions.noCache || false);

        // Connect to all MCP servers
        const connectionPromises = Object.entries(config.mcpServers).map(
          async ([serverName, serverConfig]) => {
            try {
              await clientManager.connectToServer(serverName, serverConfig);
              api.logger.info(`[one-mcp] Connected to MCP server: ${serverName}`);
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              api.logger.error(`[one-mcp] Failed to connect to ${serverName}:`, errorMessage);
            }
          }
        );

        await Promise.all(connectionPromises);

        // Initialize skill service if configured
        const skillsConfig = config.skills;
        const skillService = skillsConfig && skillsConfig.paths.length > 0
          ? new SkillService(process.cwd(), skillsConfig.paths)
          : undefined;

        // Create tool instances
        describeToolsToolInstance = new DescribeToolsTool(
          clientManager,
          skillService,
          serverOptions.serverId
        );

        useToolToolInstance = new UseToolTool(
          clientManager,
          skillService,
          serverOptions.serverId
        );

        // Generate full toolkit description after MCP servers are connected
        const toolkitDef = await describeToolsToolInstance.getDefinition();
        toolkitDescription = toolkitDef.description;

        isInitialized = true;
        api.logger.info('[one-mcp] MCP server initialized successfully');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        api.logger.error('[one-mcp] Failed to initialize MCP server:', errorMessage);
        throw error;
      }
    },
    async stop() {
      api.logger.info('[one-mcp] MCP server stopping');
      isInitialized = false;
      describeToolsToolInstance = null;
      useToolToolInstance = null;
    },
  });

  // Register describe_tools with static schema
  api.registerTool(
    {
      name: 'mcp__describe_tools',
      description: `
<toolkit id="${serverOptions.serverId}">
<instruction>
Before you use any capabilities below, you MUST call this tool with a list of names to learn how to use them properly; this includes:
- For tools: Arguments schema needed to pass to use_tool
- For skills: Detailed instructions that will expand when invoked (Prefer to be explored first when relevant)

This tool is optimized for batch queries - you can request multiple capabilities at once for better performance.

How to invoke:
- For MCP tools: Use use_tool with toolName and toolArgs based on the schema
- For skills: Use this tool with the skill name to get expanded instructions
</instruction>

<available_capabilities>
<!-- Capabilities will be populated dynamically after MCP servers connect -->
</available_capabilities>
</toolkit>
      `.trim(),
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          toolNames: {
            description: 'List of tool names to get detailed information about',
            items: {
              minLength: 1,
              type: 'string',
            },
            minItems: 1,
            type: 'array',
          },
        },
        required: ['toolNames'],
      },
      async execute(_id: string, params: Record<string, unknown>) {
        if (!isInitialized || !describeToolsToolInstance) {
          return {
            content: [{
              type: 'text',
              text: 'MCP server not initialized yet. Please wait for service startup to complete.'
            }],
            isError: true
          };
        }

        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await describeToolsToolInstance.execute(params as any);

          // Prepend toolkit description to help AI discover available tools
          const responseText = result.content?.[0]?.type === 'text'
            ? result.content[0].text
            : JSON.stringify(result, null, 2);

          const fullResponse = toolkitDescription
            ? `${toolkitDescription}\n\n---\n\nDetailed Information:\n${responseText}`
            : responseText;

          return {
            content: [{ type: 'text', text: fullResponse }]
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          api.logger.error('[one-mcp] describe_tools error:', errorMessage);
          return {
            content: [{
              type: 'text',
              text: `Error executing describe_tools: ${errorMessage}`
            }],
            isError: true
          };
        }
      }
    },
    { name: 'mcp__describe_tools' }
  );

  // Register use_tool with static schema
  api.registerTool(
    {
      name: 'mcp__use_tool',
      description: `
Execute an MCP tool (NOT Skill) with provided arguments. You MUST call describe_tools first to discover the tool's correct arguments. Then to use tool:
- Provide toolName and toolArgs based on the schema
- If multiple servers provide the same tool, specify serverName

IMPORTANT: Only use tools discovered from describe_tools with id="${serverOptions.serverId}".
      `.trim(),
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          toolArgs: {
            description: 'Arguments to pass to the tool, as discovered from describe_tools',
            type: 'object',
          },
          toolName: {
            description: 'Name of the tool to execute',
            minLength: 1,
            type: 'string',
          },
        },
        required: ['toolName'],
      },
      async execute(_id: string, params: Record<string, unknown>) {
        if (!isInitialized || !useToolToolInstance) {
          return {
            content: [{
              type: 'text',
              text: 'MCP server not initialized yet. Please wait for service startup to complete.'
            }],
            isError: true
          };
        }

        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = await useToolToolInstance.execute(params as any);
          return {
            content: result.content || [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          api.logger.error('[one-mcp] use_tool error:', errorMessage);
          return {
            content: [{
              type: 'text',
              text: `Error executing tool: ${errorMessage}`
            }],
            isError: true
          };
        }
      }
    },
    { name: 'mcp__use_tool' }
  );

    api.logger.info('[one-mcp] Tools registered: mcp__describe_tools, mcp__use_tool');
  },
};

export default mcpBridgePlugin;
