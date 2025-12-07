/**
 * UseToolTool - Progressive disclosure tool for calling MCP tools and skills
 *
 * DESIGN PATTERNS:
 * - Tool pattern with getDefinition() and execute() methods
 * - Dependency injection for client manager and skill service
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
 *
 * NAMING CONVENTIONS:
 * - Tools from MCP servers use serverName__toolName format when clashing
 * - Skills use skill__skillName format (skill__ prefix)
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Tool, ToolDefinition, Skill } from '../types';
import type { McpClientManagerService } from '../services/McpClientManagerService';
import type { SkillService } from '../services/SkillService';
import { parseToolName } from '../utils';

/**
 * Prefix used to identify skill invocations (e.g., skill__pdf)
 */
const SKILL_PREFIX = 'skill__';

/**
 * Input schema for UseToolTool
 * @property toolName - Name of the tool or skill to execute
 * @property toolArgs - Arguments to pass to the tool (from describe_tools schema)
 */
interface UseToolToolInput {
  toolName: string;
  toolArgs?: Record<string, unknown>;
}

/**
 * UseToolTool executes MCP tools and skills with proper error handling.
 *
 * This tool supports three invocation patterns:
 * 1. skill__skillName - Invokes a skill from the configured skills directory
 * 2. serverName__toolName - Invokes a tool on a specific MCP server
 * 3. plainToolName - Searches all servers for a unique tool match
 *
 * @example
 * const tool = new UseToolTool(clientManager, skillService);
 * await tool.execute({ toolName: 'skill__pdf' }); // Invoke a skill
 * await tool.execute({ toolName: 'playwright__browser_click', toolArgs: { ref: 'btn' } });
 */
export class UseToolTool implements Tool<UseToolToolInput> {
  static readonly TOOL_NAME = 'use_tool';
  private clientManager: McpClientManagerService;
  private skillService: SkillService | undefined;

  /**
   * Creates a new UseToolTool instance
   * @param clientManager - The MCP client manager for accessing remote servers
   * @param skillService - Optional skill service for loading and executing skills
   */
  constructor(clientManager: McpClientManagerService, skillService?: SkillService) {
    this.clientManager = clientManager;
    this.skillService = skillService;
  }

  /**
   * Returns the MCP tool definition with name, description, and input schema.
   *
   * The definition describes how to use this tool to execute MCP tools or skills,
   * including the skill__ prefix format for skill invocations.
   *
   * @returns The tool definition conforming to MCP spec
   */
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
            minLength: 1,
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

  /**
   * Returns guidance message for skill invocation.
   *
   * Skills are not executed via use_tool - they provide instructions that should
   * be followed directly. This method returns a message directing users to use
   * describe_tools to get the skill details and follow its instructions.
   *
   * @param skill - The skill that was requested
   * @returns CallToolResult with guidance message
   */
  private executeSkill(skill: Skill): CallToolResult {
    return {
      content: [
        {
          type: 'text',
          text: `Skill "${skill.name}" found. Skills provide instructions and should not be executed via use_tool.\n\nUse describe_tools to view the skill details at: ${skill.basePath}\n\nThen follow the skill's instructions directly.`,
        },
      ],
    };
  }

  /**
   * Executes a tool or skill based on the provided input.
   *
   * Handles three invocation patterns:
   * 1. skill__skillName - Routes to skill execution via SkillService
   * 2. serverName__toolName - Routes to specific MCP server
   * 3. plainToolName - Searches all servers for unique match
   *
   * Edge cases:
   * - Returns error if skill not found when using skill__ prefix
   * - Returns error if tool is blacklisted on target server
   * - Returns disambiguation message if tool exists on multiple servers
   *
   * @param input - The tool/skill name and optional arguments
   * @returns CallToolResult with execution output or error
   */
  async execute(input: UseToolToolInput): Promise<CallToolResult> {
    try {
      const { toolName: inputToolName, toolArgs = {} } = input;

      // Handle skill__ prefix - route to skill execution
      if (inputToolName.startsWith(SKILL_PREFIX)) {
        const skillName = inputToolName.slice(SKILL_PREFIX.length);

        if (!this.skillService) {
          return {
            content: [
              {
                type: 'text',
                text: `Skills are not configured. Cannot execute skill "${skillName}".`,
              },
            ],
            isError: true,
          };
        }

        const skill = await this.skillService.getSkill(skillName);
        if (!skill) {
          return {
            content: [
              {
                type: 'text',
                text: `Skill "${skillName}" not found. Use describe_tools to see available skills.`,
              },
            ],
            isError: true,
          };
        }

        return this.executeSkill(skill);
      }

      // Handle MCP tool execution
      const clients = this.clientManager.getAllClients();

      // Parse tool name to check for server prefix (serverName__toolName format)
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
        // Tool not found in MCP servers - check if it's a skill by plain name
        // Skills can be displayed without skill__ prefix when they don't clash
        if (this.skillService) {
          const skill = await this.skillService.getSkill(actualToolName);
          if (skill) {
            return this.executeSkill(skill);
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: `Tool or skill "${actualToolName}" not found. Use describe_tools to see available tools and skills.`,
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
