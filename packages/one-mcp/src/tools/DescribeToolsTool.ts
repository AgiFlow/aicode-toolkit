/**
 * DescribeToolsTool - Progressive disclosure tool for describing multiple MCP tools
 *
 * DESIGN PATTERNS:
 * - Tool pattern with getDefinition() and execute() methods
 * - Dependency injection for client manager
 * - Progressive disclosure pattern
 * - Batch processing pattern for multiple tool queries
 *
 * CODING STANDARDS:
 * - Implement Tool interface from ../types
 * - Use TOOL_NAME constant with snake_case
 * - Return CallToolResult with content array
 * - Handle errors with isError flag
 * - Handle partial failures gracefully
 *
 * AVOID:
 * - Complex business logic in execute method
 * - Unhandled promise rejections
 * - Missing error handling
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Tool, ToolDefinition } from '../types';
import type { McpClientManagerService } from '../services/McpClientManagerService';
import { parseToolName } from '../utils';

interface DescribeToolsToolInput {
  toolNames: string[];
}

interface ToolDescription {
  server: string;
  tool: {
    name: string;
    description?: string;
    inputSchema: any;
  };
}

export class DescribeToolsTool implements Tool<DescribeToolsToolInput> {
  static readonly TOOL_NAME = 'describe_tools';
  private clientManager: McpClientManagerService;

  constructor(clientManager: McpClientManagerService) {
    this.clientManager = clientManager;
  }

  async getDefinition(): Promise<ToolDefinition> {
    const clients = this.clientManager.getAllClients();

    // First pass: collect all tools from all servers to detect clashes
    const toolToServers = new Map<string, string[]>();
    const serverToolsMap = new Map<string, Array<{ name: string; description?: string }>>();

    await Promise.all(
      clients.map(async (client) => {
        try {
          const tools = await client.listTools();
          // Filter out blacklisted tools
          const blacklist = new Set(client.toolBlacklist || []);
          const filteredTools = tools.filter((t) => !blacklist.has(t.name));

          serverToolsMap.set(client.serverName, filteredTools);

          // Track which servers have each tool
          for (const tool of filteredTools) {
            if (!toolToServers.has(tool.name)) {
              toolToServers.set(tool.name, []);
            }
            toolToServers.get(tool.name)!.push(client.serverName);
          }
        } catch (error) {
          console.error(`Failed to list tools from ${client.serverName}:`, error);
          serverToolsMap.set(client.serverName, []);
        }
      }),
    );

    // Build server metadata descriptions with tool lists (using prefixed names for clashes)
    const serverDescriptions = clients.map((client) => {
      const tools = serverToolsMap.get(client.serverName) || [];

      // Format tool list with prefixed names for clashing tools
      const formatToolName = (toolName: string): string => {
        const servers = toolToServers.get(toolName) || [];
        // If tool exists on multiple servers, prefix with serverName
        return servers.length > 1 ? `${client.serverName}__${toolName}` : toolName;
      };

      const toolList = client.omitToolDescription
        ? tools.map((t) => formatToolName(t.name)).join(', ')
        : tools
            .map((t) => `${formatToolName(t.name)}: """${t.description || 'No description'}"""`)
            .join('\n');

      const instructionLine = client.serverInstruction
        ? `\n"""${client.serverInstruction}"""`
        : '';
      return `\n\n### Server: ${client.serverName}${instructionLine}\n\n- Available tools:\n${toolList || 'No tools available'}`;
    });

    return {
      name: DescribeToolsTool.TOOL_NAME,
      description: `## Available MCP Servers:${serverDescriptions.join('')}

## Usage:
Before you use any tools above, you MUST call this tool with a list of tool names to learn how to use them properly before use_tool; this includes:
- Arguments schema needed to pass to the tool use
- Description about each tool

This tool is optimized for batch queries - you can request multiple tools at once for better performance.`,
      inputSchema: {
        type: 'object',
        properties: {
          toolNames: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'List of tool names to get detailed information about',
            minItems: 1,
          },
        },
        required: ['toolNames'],
        additionalProperties: false,
      },
    };
  }

  async execute(input: DescribeToolsToolInput): Promise<CallToolResult> {
    try {
      const { toolNames } = input;
      const clients = this.clientManager.getAllClients();

      if (!toolNames || toolNames.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No tool names provided. Please specify at least one tool name.',
            },
          ],
          isError: true,
        };
      }

      // First, collect all tools from all servers
      const serverToolsMap = new Map<string, Array<{ name: string; description?: string; inputSchema: any }>>();
      const toolToServers = new Map<string, string[]>();

      await Promise.all(
        clients.map(async (client) => {
          try {
            const tools = await client.listTools();
            // Filter out blacklisted tools
            const blacklist = new Set(client.toolBlacklist || []);
            const filteredTools = tools.filter((t) => !blacklist.has(t.name));

            serverToolsMap.set(client.serverName, filteredTools);

            // Track which servers have each tool
            for (const tool of filteredTools) {
              if (!toolToServers.has(tool.name)) {
                toolToServers.set(tool.name, []);
              }
              toolToServers.get(tool.name)!.push(client.serverName);
            }
          } catch (error) {
            console.error(`Failed to list tools from ${client.serverName}:`, error);
            serverToolsMap.set(client.serverName, []);
          }
        }),
      );

      const foundTools: ToolDescription[] = [];
      const notFoundTools: string[] = [];

      for (const requestedToolName of toolNames) {
        const { serverName, actualToolName } = parseToolName(requestedToolName);

        if (serverName) {
          // Prefixed format: {serverName}__{toolName} - search specific server
          const serverTools = serverToolsMap.get(serverName);
          if (!serverTools) {
            notFoundTools.push(requestedToolName);
            continue;
          }

          const tool = serverTools.find((t) => t.name === actualToolName);
          if (tool) {
            foundTools.push({
              server: serverName,
              tool: {
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema,
              },
            });
          } else {
            notFoundTools.push(requestedToolName);
          }
        } else {
          // Plain tool name - search all servers
          const servers = toolToServers.get(actualToolName);

          if (!servers || servers.length === 0) {
            notFoundTools.push(requestedToolName);
            continue;
          }

          if (servers.length === 1) {
            // Unique tool - found on single server
            const server = servers[0];
            const serverTools = serverToolsMap.get(server)!;
            const tool = serverTools.find((t) => t.name === actualToolName)!;
            foundTools.push({
              server,
              tool: {
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema,
              },
            });
          } else {
            // Tool exists on multiple servers - return all matches
            for (const server of servers) {
              const serverTools = serverToolsMap.get(server)!;
              const tool = serverTools.find((t) => t.name === actualToolName)!;
              foundTools.push({
                server,
                tool: {
                  name: tool.name,
                  description: tool.description,
                  inputSchema: tool.inputSchema,
                },
              });
            }
          }
        }
      }

      // Build response
      if (foundTools.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `None of the requested tools found on any connected server.\nRequested: ${toolNames.join(', ')}\nUse describe_tools to see available tools.`,
            },
          ],
          isError: true,
        };
      }

      const result: any = {
        tools: foundTools,
      };

      if (notFoundTools.length > 0) {
        result.notFound = notFoundTools;
        result.warnings = [`Tools not found: ${notFoundTools.join(', ')}`];
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error describing tools: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }
}
