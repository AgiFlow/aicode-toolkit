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

interface DescribeToolsToolInput {
  toolNames: string[];
  serverName?: string;
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

    // Build server metadata descriptions with tool lists
    const serverDescriptions = await Promise.all(
      clients.map(async (client) => {
        try {
          const tools = await client.listTools();
          const toolList = tools.map((t) => `${t.name}`).join(',');

          const instructionLine = client.serverInstruction
            ? `\n- Description: ${client.serverInstruction}`
            : '';
          return `\n\n### Server: ${client.serverName}${instructionLine}\n- Available tools:${toolList ? '\n' + toolList : ''}`;
        } catch (error) {
          console.error(`Failed to list tools from ${client.serverName}:`, error);
          const instructionLine = client.serverInstruction
            ? `\n- Description: ${client.serverInstruction}`
            : '';
          return `\n\n**Server: ${client.serverName}**${instructionLine}\n`;
        }
      }),
    );

    return {
      name: DescribeToolsTool.TOOL_NAME,
      description: `Learn how to use multiple MCP tools before using them. Below are supported tools and capabilities.

## Available MCP Servers:${serverDescriptions.join('')}

## Usage:
You MUST call this tool with a list of tool names to learn how to use them properly before use_tool; this includes:
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
          serverName: {
            type: 'string',
            description:
              'Optional server name to search within. If not specified, searches all servers.',
          },
        },
        required: ['toolNames'],
        additionalProperties: false,
      },
    };
  }

  async execute(input: DescribeToolsToolInput): Promise<CallToolResult> {
    try {
      const { toolNames, serverName } = input;
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

      // If server name is specified, search only that server
      if (serverName) {
        const client = this.clientManager.getClient(serverName);
        if (!client) {
          return {
            content: [
              {
                type: 'text',
                text: `Server "${serverName}" not found. Available servers: ${clients.map((c) => c.serverName).join(', ')}`,
              },
            ],
            isError: true,
          };
        }

        const tools = await client.listTools();
        const foundTools: ToolDescription[] = [];
        const notFoundTools: string[] = [];

        for (const toolName of toolNames) {
          const tool = tools.find((t) => t.name === toolName);
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
            notFoundTools.push(toolName);
          }
        }

        if (foundTools.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `None of the requested tools found on server "${serverName}".\nRequested: ${toolNames.join(', ')}\nAvailable tools: ${tools.map((t) => t.name).join(', ')}`,
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
          result.warning = `Some tools were not found on server "${serverName}": ${notFoundTools.join(', ')}`;
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      // Search all servers for the tools
      const foundTools: ToolDescription[] = [];
      const notFoundTools: string[] = [...toolNames];

      // Build a map of toolName -> array of { server, tool }
      const toolMatches = new Map<string, Array<{ server: string; tool: any }>>();

      const results = await Promise.all(
        clients.map(async (client) => {
          try {
            const tools = await client.listTools();
            const matches: Array<{ toolName: string; server: string; tool: any }> = [];

            for (const toolName of toolNames) {
              const tool = tools.find((t) => t.name === toolName);
              if (tool) {
                matches.push({ toolName, server: client.serverName, tool });
              }
            }

            return matches;
          } catch (error) {
            console.error(`Failed to list tools from ${client.serverName}:`, error);
            return [];
          }
        }),
      );

      // Flatten and organize results
      for (const matches of results) {
        for (const match of matches) {
          if (!toolMatches.has(match.toolName)) {
            toolMatches.set(match.toolName, []);
          }
          toolMatches.get(match.toolName)!.push({
            server: match.server,
            tool: match.tool,
          });
        }
      }

      // Process each requested tool
      const ambiguousTools: Array<{ toolName: string; servers: string[] }> = [];

      for (const toolName of toolNames) {
        const matches = toolMatches.get(toolName);

        if (!matches || matches.length === 0) {
          // Tool not found anywhere
          continue;
        }

        if (matches.length === 1) {
          // Single match - add to found tools
          const match = matches[0];
          foundTools.push({
            server: match.server,
            tool: {
              name: match.tool.name,
              description: match.tool.description,
              inputSchema: match.tool.inputSchema,
            },
          });
          // Remove from not found list
          const idx = notFoundTools.indexOf(toolName);
          if (idx > -1) {
            notFoundTools.splice(idx, 1);
          }
        } else {
          // Multiple matches - mark as ambiguous
          ambiguousTools.push({
            toolName,
            servers: matches.map((m) => m.server),
          });
          // Remove from not found list
          const idx = notFoundTools.indexOf(toolName);
          if (idx > -1) {
            notFoundTools.splice(idx, 1);
          }
        }
      }

      // Build response
      if (foundTools.length === 0 && ambiguousTools.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `None of the requested tools found on any connected server.\nRequested: ${toolNames.join(', ')}\nUse describe_tools without arguments to see available servers.`,
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
      }

      if (ambiguousTools.length > 0) {
        result.ambiguous = ambiguousTools.map((item) => ({
          toolName: item.toolName,
          servers: item.servers,
          message: `Tool "${item.toolName}" found on multiple servers: ${item.servers.join(', ')}. Please specify serverName to disambiguate.`,
        }));
      }

      // Add warnings if any issues
      const warnings: string[] = [];
      if (notFoundTools.length > 0) {
        warnings.push(`Tools not found: ${notFoundTools.join(', ')}`);
      }
      if (ambiguousTools.length > 0) {
        warnings.push(
          `Ambiguous tools (specify serverName): ${ambiguousTools.map((t) => t.toolName).join(', ')}`,
        );
      }
      if (warnings.length > 0) {
        result.warnings = warnings;
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
