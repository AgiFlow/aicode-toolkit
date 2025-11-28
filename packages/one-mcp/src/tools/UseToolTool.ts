/**
 * UseToolTool - Progressive disclosure tool for calling MCP tools
 *
 * DESIGN PATTERNS:
 * - Tool pattern with getDefinition() and execute() methods
 * - Dependency injection for client manager
 * - Progressive disclosure pattern
 * - Proxy pattern for forwarding tool calls
 *
 * CODING STANDARDS:
 * - Implement Tool interface from ../types
 * - Use TOOL_NAME constant with snake_case
 * - Return CallToolResult with content array
 * - Handle errors with isError flag
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

interface UseToolToolInput {
  toolName: string;
  toolArgs?: Record<string, any>;
}

export class UseToolTool implements Tool<UseToolToolInput> {
  static readonly TOOL_NAME = 'use_tool';
  private clientManager: McpClientManagerService;

  constructor(clientManager: McpClientManagerService) {
    this.clientManager = clientManager;
  }

  getDefinition(): ToolDefinition {
    return {
      name: UseToolTool.TOOL_NAME,
      description: `Execute an MCP tool with provided arguments. You MUST call describe_tools first to discover the tool's correct arguments. Then to use tool:
- Provide toolName and toolArgs based on the schema
- If multiple servers provide the same tool, specify serverName
`,
      inputSchema: {
        type: 'object',
        properties: {
          toolName: {
            type: 'string',
            description: 'Name of the tool to execute',
          },
          toolArgs: {
            type: 'object',
            description: 'Arguments to pass to the tool, as discovered from describe_tools',
          },
        },
        required: ['toolName'],
        additionalProperties: false,
      },
    };
  }

  async execute(input: UseToolToolInput): Promise<CallToolResult> {
    try {
      const { toolName: inputToolName, toolArgs = {} } = input;
      const clients = this.clientManager.getAllClients();

      // Parse tool name to check for server prefix
      const { serverName, actualToolName } = parseToolName(inputToolName);

      // If server name is specified (via prefix), use that server directly
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

        // Check if tool is blacklisted
        if (client.toolBlacklist && client.toolBlacklist.includes(actualToolName)) {
          return {
            content: [
              {
                type: 'text',
                text: `Tool "${actualToolName}" is blacklisted on server "${serverName}" and cannot be executed.`,
              },
            ],
            isError: true,
          };
        }

        try {
          const result = await client.callTool(actualToolName, toolArgs);
          return result;
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Failed to call tool "${actualToolName}" on server "${serverName}": ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
            isError: true,
          };
        }
      }

      // No server prefix - search all servers for the tool
      const matchingServers: string[] = [];

      const results = await Promise.all(
        clients.map(async (client) => {
          try {
            // Skip if tool is blacklisted on this server
            if (client.toolBlacklist && client.toolBlacklist.includes(actualToolName)) {
              return null;
            }

            const tools = await client.listTools();
            const hasTool = tools.some((t) => t.name === actualToolName);

            if (hasTool) {
              return client.serverName;
            }
          } catch (error) {
            console.error(`Failed to list tools from ${client.serverName}:`, error);
          }
          return null;
        }),
      );

      matchingServers.push(...results.filter((r) => r !== null));

      if (matchingServers.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `Tool "${actualToolName}" not found on any connected server. Use describe_tools to see available tools.`,
            },
          ],
          isError: true,
        };
      }

      if (matchingServers.length > 1) {
        // Tool exists on multiple servers - suggest using prefixed format
        const prefixedNames = matchingServers.map((s) => `${s}__${actualToolName}`);
        return {
          content: [
            {
              type: 'text',
              text: `Tool "${actualToolName}" found on multiple servers. Use prefixed format to specify: ${prefixedNames.join(', ')}`,
            },
          ],
          isError: true,
        };
      }

      // Single match found - call the tool
      const targetServerName = matchingServers[0];
      const client = this.clientManager.getClient(targetServerName);

      if (!client) {
        return {
          content: [
            {
              type: 'text',
              text: `Internal error: Server "${targetServerName}" was found but is not connected`,
            },
          ],
          isError: true,
        };
      }

      try {
        const result = await client.callTool(actualToolName, toolArgs);
        return result;
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to call tool "${actualToolName}": ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error executing tool: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }
}
