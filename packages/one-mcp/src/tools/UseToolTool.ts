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
import type { Tool, ToolDefinition, Skill, PromptSkillConfig } from '../types';
import type { McpClientManagerService } from '../services/McpClientManagerService';
import type { SkillService } from '../services/SkillService';
import { DefinitionsCacheService } from '../services/DefinitionsCacheService';
import { parseToolName } from '../utils';
import { DEFAULT_SERVER_ID, SKILL_PREFIX } from '../constants';

/**
 * Result of finding a prompt-based skill configuration
 * @property serverName - The MCP server that owns this prompt
 * @property promptName - The prompt name used to fetch content
 * @property skill - The skill configuration from the prompt
 */
interface PromptSkillMatch {
  serverName: string;
  promptName: string;
  skill: PromptSkillConfig;
}

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
  private definitionsCacheService: DefinitionsCacheService;
  /** Unique server identifier for this one-mcp instance */
  private serverId: string;

  /**
   * Creates a new UseToolTool instance
   * @param clientManager - The MCP client manager for accessing remote servers
   * @param skillService - Optional skill service for loading and executing skills
   * @param serverId - Unique server identifier for this one-mcp instance
   */
  constructor(
    clientManager: McpClientManagerService,
    skillService?: SkillService,
    serverId?: string,
    definitionsCacheService?: DefinitionsCacheService,
  ) {
    this.clientManager = clientManager;
    this.skillService = skillService;
    this.definitionsCacheService =
      definitionsCacheService || new DefinitionsCacheService(clientManager, skillService);
    this.serverId = serverId || DEFAULT_SERVER_ID;
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
      description: `Execute an MCP tool (NOT Skill) with provided arguments. You MUST call describe_tools first to discover the tool's correct arguments. Then to use tool:
- Provide toolName and toolArgs based on the schema
- If multiple servers provide the same tool, specify serverName

IMPORTANT: Only use tools discovered from describe_tools with id="${this.serverId}".
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
   * Finds a prompt-based skill by name from all connected MCP servers.
   *
   * @param skillName - The skill name to search for
   * @returns PromptSkillMatch if found, undefined otherwise
   */
  private async findPromptSkill(skillName: string): Promise<PromptSkillMatch | undefined> {
    if (!skillName) return undefined;
    return await this.definitionsCacheService.getPromptSkillByName(skillName);
  }

  /**
   * Returns guidance message for prompt-based skill invocation.
   *
   * @param promptSkill - The prompt skill match that was found
   * @returns CallToolResult with guidance message
   */
  private executePromptSkill(promptSkill: PromptSkillMatch): CallToolResult {
    const location =
      promptSkill.skill.folder || `prompt:${promptSkill.serverName}/${promptSkill.promptName}`;
    return {
      content: [
        {
          type: 'text',
          text: `Skill "${promptSkill.skill.name}" found. Skills provide instructions and should not be executed via use_tool.\n\nUse describe_tools to view the skill details at: ${location}\n\nThen follow the skill's instructions directly.`,
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

        // First check file-based skills from SkillService
        if (this.skillService) {
          const skill = await this.skillService.getSkill(skillName);
          if (skill) {
            return this.executeSkill(skill);
          }
        }

        // Then check prompt-based skills
        const promptSkill = await this.findPromptSkill(skillName);
        if (promptSkill) {
          return this.executePromptSkill(promptSkill);
        }

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

      // Handle MCP tool execution
      const knownServerNames = this.clientManager.getKnownServerNames();

      // Parse tool name to check for server prefix (serverName__toolName format)
      const { serverName, actualToolName } = parseToolName(inputToolName);

      // If server name is specified (via prefix), use that server directly
      if (serverName) {
        try {
          const client = await this.clientManager.ensureConnected(serverName);

          if (client.toolBlacklist?.includes(actualToolName)) {
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

          const result = await client.callTool(actualToolName, toolArgs);
          return result;
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Failed to call tool "${actualToolName}" on server "${serverName}". Available servers: ${knownServerNames.join(', ')}. ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
            isError: true,
          };
        }
      }

      const matchingServers = await this.definitionsCacheService.getServersForTool(actualToolName);

      if (matchingServers.length === 0) {
        // Tool not found in MCP servers - check if it's a skill by plain name
        // Skills can be displayed without skill__ prefix when they don't clash

        // First check file-based skills from SkillService
        if (this.skillService) {
          const skill = await this.skillService.getSkill(actualToolName);
          if (skill) {
            return this.executeSkill(skill);
          }
        }

        // Then check prompt-based skills
        const promptSkill = await this.findPromptSkill(actualToolName);
        if (promptSkill) {
          return this.executePromptSkill(promptSkill);
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

      // Single match found - connect on demand and call the tool
      try {
        const targetServerName = matchingServers[0];
        const client = await this.clientManager.ensureConnected(targetServerName);
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
