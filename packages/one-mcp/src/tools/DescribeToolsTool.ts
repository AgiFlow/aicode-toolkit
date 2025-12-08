/**
 * DescribeToolsTool - Progressive disclosure tool for describing multiple MCP tools and skills
 *
 * DESIGN PATTERNS:
 * - Tool pattern with getDefinition() and execute() methods
 * - Dependency injection for client manager and skill service
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
 *
 * NAMING CONVENTIONS:
 * - Tools from MCP servers use serverName__toolName format when clashing
 * - Skills use skill__skillName format (skill__ prefix)
 * - Plain tool names resolve to unique tools or return all matches if clashing
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Tool, ToolDefinition } from '../types';
import type { McpClientManagerService } from '../services/McpClientManagerService';
import type { SkillService } from '../services/SkillService';
import { parseToolName } from '../utils';
import { Liquid } from 'liquidjs';
import skillsDescriptionTemplate from '../templates/skills-description.liquid?raw';
import mcpServersDescriptionTemplate from '../templates/mcp-servers-description.liquid?raw';

/**
 * Prefix used to identify skill invocations
 */
const SKILL_PREFIX = 'skill__';

/**
 * Input schema for the DescribeToolsTool
 * @property toolNames - Array of tool names to get detailed information about
 */
interface DescribeToolsToolInput {
  toolNames: string[];
}

/**
 * JSON Schema type for tool input definitions
 * Represents the structure of a JSON Schema object
 */
interface JsonSchemaDefinition {
  type?: string;
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
  [key: string]: unknown;
}

/**
 * Tool info from MCP server with proper typing
 * @property name - The tool name
 * @property description - Human-readable description
 * @property inputSchema - JSON Schema for tool inputs
 */
interface McpToolInfo {
  name: string;
  description?: string;
  inputSchema: JsonSchemaDefinition;
}

/**
 * Description of a tool returned by describe_tools
 * @property server - The server name that provides this tool
 * @property tool - The tool metadata including name, description, and input schema
 */
interface ToolDescription {
  server: string;
  tool: {
    name: string;
    description?: string;
    inputSchema: JsonSchemaDefinition;
  };
}

/**
 * Description of a skill returned by describe_tools
 * @property name - The skill name (without skill__ prefix)
 * @property location - The file system path where the skill is located
 * @property instructions - The skill content/instructions from SKILL.md
 */
interface SkillDescription {
  name: string;
  location: string;
  instructions: string;
}

/**
 * Result structure for describe_tools execution
 * @property tools - Array of found tool descriptions
 * @property skills - Array of found skill descriptions (when skill__ prefix used)
 * @property notFound - Array of tool/skill names that were not found
 * @property warnings - Array of warning messages
 * @property nextSteps - Guidance on what to do next based on results
 */
interface DescribeToolsResult {
  tools?: ToolDescription[];
  skills?: SkillDescription[];
  notFound?: string[];
  warnings?: string[];
  nextSteps?: string[];
}

/**
 * Server data structure for Liquid template rendering
 * @property name - Server name identifier
 * @property instruction - Optional server instruction text
 * @property omitToolDescription - Whether to show only tool names without descriptions
 * @property tools - Array of tools with displayName and description
 * @property toolNames - Array of tool display names (used when omitToolDescription is true)
 */
interface ServerTemplateData {
  name: string;
  instruction?: string;
  omitToolDescription: boolean;
  tools: Array<{ displayName: string; description?: string }>;
  toolNames: string[];
}

/**
 * Skill data structure for Liquid template rendering
 * @property name - Original skill name
 * @property displayName - Display name (prefixed with skill__ only if clashing)
 * @property description - Skill description
 */
interface SkillTemplateData {
  name: string;
  displayName: string;
  description: string;
}

/**
 * Result of finding a prompt-based skill configuration
 * @property serverName - The MCP server that owns this prompt
 * @property promptName - The prompt name used to fetch content
 * @property skill - The skill configuration from the prompt
 */
interface PromptSkillMatch {
  serverName: string;
  promptName: string;
  skill: {
    name: string;
    description: string;
    folder?: string;
  };
}

/**
 * Result from building servers section, includes rendered content and tool names for clash detection
 * @property content - Rendered servers section string
 * @property toolNames - Set of all tool display names for clash detection with skills
 */
interface ServersSectionResult {
  content: string;
  toolNames: Set<string>;
}

/**
 * DescribeToolsTool provides progressive disclosure of MCP tools and skills.
 *
 * This tool lists available tools from all connected MCP servers and skills
 * from the configured skills directories. Users can query for specific tools
 * or skills to get detailed input schemas and descriptions.
 *
 * Tool naming conventions:
 * - Unique tools: use plain name (e.g., "browser_click")
 * - Clashing tools: use serverName__toolName format (e.g., "playwright__click")
 * - Skills: use skill__skillName format (e.g., "skill__pdf")
 *
 * @example
 * const tool = new DescribeToolsTool(clientManager, skillService);
 * const definition = await tool.getDefinition();
 * const result = await tool.execute({ toolNames: ['browser_click', 'skill__pdf'] });
 */
export class DescribeToolsTool implements Tool<DescribeToolsToolInput> {
  static readonly TOOL_NAME = 'describe_tools';
  private clientManager: McpClientManagerService;
  private skillService: SkillService | undefined;
  private readonly liquid = new Liquid();

  /**
   * Creates a new DescribeToolsTool instance
   * @param clientManager - The MCP client manager for accessing remote servers
   * @param skillService - Optional skill service for loading skills
   */
  constructor(clientManager: McpClientManagerService, skillService?: SkillService) {
    this.clientManager = clientManager;
    this.skillService = skillService;
  }

  /**
   * Collects skills derived from prompt configurations across all connected MCP servers.
   * Prompts with a skill configuration are converted to skill format for display.
   *
   * @returns Array of skill template data derived from prompts
   */
  private collectPromptSkills(): SkillTemplateData[] {
    const clients = this.clientManager.getAllClients();
    const promptSkills: SkillTemplateData[] = [];

    for (const client of clients) {
      if (!client.prompts) continue;

      for (const promptConfig of Object.values(client.prompts)) {
        if (promptConfig.skill) {
          promptSkills.push({
            name: promptConfig.skill.name,
            displayName: promptConfig.skill.name,
            description: promptConfig.skill.description,
          });
        }
      }
    }

    return promptSkills;
  }

  /**
   * Finds a prompt-based skill by name from all connected MCP servers.
   * Returns the prompt name and skill config for fetching the prompt content.
   *
   * @param skillName - The skill name to search for
   * @returns Object with serverName, promptName, and skill config, or undefined if not found
   */
  private findPromptSkill(skillName: string): PromptSkillMatch | undefined {
    if (!skillName) return undefined;

    const clients = this.clientManager.getAllClients();

    for (const client of clients) {
      if (!client.prompts) continue;

      for (const [promptName, promptConfig] of Object.entries(client.prompts)) {
        if (promptConfig.skill && promptConfig.skill.name === skillName) {
          return {
            serverName: client.serverName,
            promptName,
            skill: promptConfig.skill,
          };
        }
      }
    }

    return undefined;
  }

  /**
   * Retrieves skill content from a prompt-based skill configuration.
   * Fetches the prompt from the MCP server and extracts text content.
   *
   * @param skillName - The skill name being requested
   * @returns SkillDescription if found and successfully fetched, undefined otherwise
   */
  private async getPromptSkillContent(skillName: string): Promise<SkillDescription | undefined> {
    const promptSkill = this.findPromptSkill(skillName);
    if (!promptSkill) return undefined;

    const client = this.clientManager.getClient(promptSkill.serverName);
    if (!client) {
      console.error(`Client not found for server '${promptSkill.serverName}' when fetching prompt skill '${skillName}'`);
      return undefined;
    }

    try {
      const promptResult = await client.getPrompt(promptSkill.promptName);
      // Prompt messages can contain either string content or TextContent objects with text field
      const instructions = promptResult.messages
        ?.map((m) => {
          const content = m.content;
          if (typeof content === 'string') return content;
          if (content && typeof content === 'object' && 'text' in content) {
            return String(content.text);
          }
          return '';
        })
        .join('\n') || '';

      return {
        name: promptSkill.skill.name,
        // Location is either the configured folder or a prompt reference
        location: promptSkill.skill.folder || `prompt:${promptSkill.serverName}/${promptSkill.promptName}`,
        instructions,
      };
    } catch (error) {
      console.error(
        `Failed to get prompt-based skill '${skillName}': ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return undefined;
    }
  }

  /**
   * Builds the skills section of the tool description using a Liquid template.
   *
   * Retrieves all available skills from the SkillService and prompt-based skills,
   * then renders them using the skills-description.liquid template. Skills are only
   * prefixed with skill__ when their name clashes with an MCP tool or another skill.
   *
   * @param mcpToolNames - Set of MCP tool names to check for clashes
   * @returns Rendered skills section string with available skills list
   */
  private async buildSkillsSection(mcpToolNames: Set<string>): Promise<string> {
    const rawSkills = this.skillService ? await this.skillService.getSkills() : [];

    // Collect skills from prompt configurations
    const promptSkills = this.collectPromptSkills();

    // Combine file-based skills and prompt-based skills
    const allSkillsData: SkillTemplateData[] = [
      ...rawSkills.map((skill) => ({
        name: skill.name,
        displayName: skill.name,
        description: skill.description,
      })),
      ...promptSkills,
    ];

    // Track skill names to detect clashes between skills
    const skillNameCounts = new Map<string, number>();
    for (const skill of allSkillsData) {
      skillNameCounts.set(skill.name, (skillNameCounts.get(skill.name) || 0) + 1);
    }

    // Format skills with prefix only when clashing with MCP tools or other skills
    const skills: SkillTemplateData[] = allSkillsData.map((skill) => {
      const clashesWithMcpTool = mcpToolNames.has(skill.name);
      const clashesWithOtherSkill = (skillNameCounts.get(skill.name) || 0) > 1;
      const needsPrefix = clashesWithMcpTool || clashesWithOtherSkill;

      return {
        name: skill.name,
        displayName: needsPrefix ? `${SKILL_PREFIX}${skill.name}` : skill.name,
        description: skill.description,
      };
    });

    return this.liquid.parseAndRender(skillsDescriptionTemplate, { skills });
  }

  /**
   * Builds the MCP servers section of the tool description using a Liquid template.
   *
   * Collects all tools from connected MCP servers, detects name clashes,
   * and renders them using the mcp-servers-description.liquid template.
   *
   * Tool names are prefixed with serverName__ when the same tool exists
   * on multiple servers to avoid ambiguity.
   *
   * @returns Object with rendered servers section and set of all tool names for skill clash detection
   */
  private async buildServersSection(): Promise<ServersSectionResult> {
    const clients = this.clientManager.getAllClients();

    // First pass: collect all tools from all servers to detect name clashes
    const toolToServers = new Map<string, string[]>();
    const serverToolsMap = new Map<string, Array<{ name: string; description?: string }>>();

    await Promise.all(
      clients.map(async (client): Promise<void> => {
        try {
          const tools = await client.listTools();
          // Filter out blacklisted tools
          const blacklist = new Set(client.toolBlacklist || []);
          const filteredTools = tools.filter((t) => !blacklist.has(t.name));

          serverToolsMap.set(client.serverName, filteredTools);

          // Track which servers have each tool for clash detection
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

    /**
     * Formats tool name with server prefix if the tool exists on multiple servers
     * @param toolName - The original tool name
     * @param serverName - The server providing this tool
     * @returns Tool name prefixed with serverName__ if clashing, otherwise plain name
     */
    const formatToolName = (toolName: string, serverName: string): string => {
      const servers = toolToServers.get(toolName) || [];
      return servers.length > 1 ? `${serverName}__${toolName}` : toolName;
    };

    // Build server data for template and collect all tool names
    const allToolNames = new Set<string>();
    const servers: ServerTemplateData[] = clients.map((client) => {
      const tools = serverToolsMap.get(client.serverName) || [];
      const formattedTools = tools.map((t) => ({
        displayName: formatToolName(t.name, client.serverName),
        description: t.description,
      }));

      // Collect tool names for skill clash detection
      for (const tool of formattedTools) {
        allToolNames.add(tool.displayName);
      }

      return {
        name: client.serverName,
        instruction: client.serverInstruction,
        omitToolDescription: client.omitToolDescription || false,
        tools: formattedTools,
        toolNames: formattedTools.map((t) => t.displayName),
      };
    });

    const content = await this.liquid.parseAndRender(mcpServersDescriptionTemplate, { servers });
    return { content, toolNames: allToolNames };
  }

  /**
   * Gets the tool definition including available servers, tools, and skills.
   *
   * The definition includes:
   * - List of all connected MCP servers with their available tools
   * - List of available skills with skill__ prefix
   * - Usage instructions for querying tool/skill details
   *
   * Tool names are prefixed with serverName__ when the same tool name
   * exists on multiple servers to avoid ambiguity.
   *
   * @returns Tool definition with description and input schema
   */
  async getDefinition(): Promise<ToolDefinition> {
    // Build servers section first to get tool names for skill clash detection
    const serversResult = await this.buildServersSection();

    // Build skills section with knowledge of MCP tool names to detect clashes
    const skillsSection = await this.buildSkillsSection(serversResult.toolNames);

    return {
      name: DescribeToolsTool.TOOL_NAME,
      description: `${serversResult.content}
${skillsSection}`,
      inputSchema: {
        type: 'object',
        properties: {
          toolNames: {
            type: 'array',
            items: {
              type: 'string',
              minLength: 1,
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

  /**
   * Executes tool description lookup for the requested tool and skill names.
   *
   * Handles three types of lookups:
   * 1. skill__name - Returns skill information from SkillService
   * 2. serverName__toolName - Returns tool from specific server
   * 3. plainToolName - Returns tool(s) from all servers (multiple if clashing)
   *
   * @param input - Object containing toolNames array
   * @returns CallToolResult with tool/skill descriptions or error
   */
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

      // Collect all tools from all servers with proper typing
      const serverToolsMap = new Map<string, McpToolInfo[]>();
      const toolToServers = new Map<string, string[]>();

      await Promise.all(
        clients.map(async (client): Promise<void> => {
          try {
            const tools = await client.listTools();
            // Filter out blacklisted tools
            const blacklist = new Set(client.toolBlacklist || []);
            const filteredTools = tools.filter((t) => !blacklist.has(t.name));

            // Map to McpToolInfo with proper typing
            const typedTools: McpToolInfo[] = filteredTools.map((t) => ({
              name: t.name,
              description: t.description,
              inputSchema: t.inputSchema as JsonSchemaDefinition,
            }));

            serverToolsMap.set(client.serverName, typedTools);

            // Track which servers have each tool for clash detection
            for (const tool of typedTools) {
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
      const foundSkills: SkillDescription[] = [];
      const notFoundItems: string[] = [];

      for (const requestedName of toolNames) {
        // Handle skill__ prefix - lookup skills from SkillService or prompt-based skills
        if (requestedName.startsWith(SKILL_PREFIX)) {
          const skillName = requestedName.slice(SKILL_PREFIX.length);

          // First try SkillService
          if (this.skillService) {
            const skill = await this.skillService.getSkill(skillName);
            if (skill) {
              foundSkills.push({
                name: skill.name,
                location: skill.basePath,
                instructions: skill.content,
              });
              continue;
            }
          }

          // Fallback to prompt-based skills if not found in SkillService
          const promptSkillContent = await this.getPromptSkillContent(skillName);
          if (promptSkillContent) {
            foundSkills.push(promptSkillContent);
            continue;
          }

          notFoundItems.push(requestedName);
          continue;
        }

        // Handle serverName__toolName format - lookup specific server
        const { serverName, actualToolName } = parseToolName(requestedName);

        if (serverName) {
          // Prefixed format: {serverName}__{toolName} - search specific server
          const serverTools = serverToolsMap.get(serverName);
          if (!serverTools) {
            notFoundItems.push(requestedName);
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
            notFoundItems.push(requestedName);
          }
        } else {
          // Plain tool name - search all servers
          // When a plain tool name matches multiple servers, return all matches
          const servers = toolToServers.get(actualToolName);

          if (!servers || servers.length === 0) {
            // Tool not found in MCP servers - check if it's a skill by plain name
            // Skills can be displayed without skill__ prefix when they don't clash

            // First check file-based skills from SkillService
            if (this.skillService) {
              const skill = await this.skillService.getSkill(actualToolName);
              if (skill) {
                foundSkills.push({
                  name: skill.name,
                  location: skill.basePath,
                  instructions: skill.content,
                });
                continue;
              }
            }

            // Then check prompt-based skills
            const promptSkillContent = await this.getPromptSkillContent(actualToolName);
            if (promptSkillContent) {
              foundSkills.push(promptSkillContent);
              continue;
            }

            notFoundItems.push(requestedName);
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

      // Build response with proper typing
      if (foundTools.length === 0 && foundSkills.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `None of the requested tools/skills found.\nRequested: ${toolNames.join(', ')}\nUse describe_tools to see available tools and skills.`,
            },
          ],
          isError: true,
        };
      }

      const result: DescribeToolsResult = {};
      const nextSteps: string[] = [];

      if (foundTools.length > 0) {
        result.tools = foundTools;
        nextSteps.push(
          'For MCP tools: Use the use_tool function with toolName and toolArgs based on the inputSchema above.'
        );
      }

      if (foundSkills.length > 0) {
        result.skills = foundSkills;
        nextSteps.push(
          `For skill, just follow skill's description to continue.`
        );
      }

      if (nextSteps.length > 0) {
        result.nextSteps = nextSteps;
      }

      if (notFoundItems.length > 0) {
        result.notFound = notFoundItems;
        result.warnings = [`Items not found: ${notFoundItems.join(', ')}`];
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
