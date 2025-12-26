/**
 * Describe Tools Command
 *
 * DESIGN PATTERNS:
 * - Command pattern with Commander for CLI argument parsing
 * - Async/await pattern for asynchronous operations
 * - Error handling pattern with try-catch and proper exit codes
 *
 * CODING STANDARDS:
 * - Use async action handlers for asynchronous operations
 * - Provide clear option descriptions and default values
 * - Handle errors gracefully with process.exit()
 * - Log progress and errors to console
 * - Use Commander's .option() and .argument() for inputs
 *
 * AVOID:
 * - Synchronous blocking operations in action handlers
 * - Missing error handling (always use try-catch)
 * - Hardcoded values (use options or environment variables)
 * - Not exiting with appropriate exit codes on errors
 */

import { Command } from 'commander';
import { ConfigFetcherService } from '../services/ConfigFetcherService';
import { McpClientManagerService } from '../services/McpClientManagerService';
import { SkillService } from '../services/SkillService';
import { findConfigFile } from '../utils';

/**
 * Describe specific MCP tools
 */
export const describeToolsCommand = new Command('describe-tools')
  .description('Describe specific MCP tools')
  .argument('<toolNames...>', 'Tool names to describe')
  .option('-c, --config <path>', 'Path to MCP server configuration file')
  .option('-s, --server <name>', 'Filter by server name')
  .option('-j, --json', 'Output as JSON', false)
  .action(async (toolNames: string[], options) => {
    try {
      // Find config file: use provided path, or search PROJECT_PATH then cwd
      const configFilePath = options.config || findConfigFile();

      if (!configFilePath) {
        console.error('Error: No config file found. Use --config or create mcp-config.yaml');
        process.exit(1);
      }

      // Initialize services
      const configFetcher = new ConfigFetcherService({
        configFilePath,
      });

      const config = await configFetcher.fetchConfiguration();
      const clientManager = new McpClientManagerService();

      // Connect to all configured MCP servers
      const connectionPromises = Object.entries(config.mcpServers).map(
        async ([serverName, serverConfig]) => {
          try {
            await clientManager.connectToServer(serverName, serverConfig);
            if (!options.json) {
              console.error(`✓ Connected to ${serverName}`);
            }
          } catch (error) {
            if (!options.json) {
              console.error(`✗ Failed to connect to ${serverName}:`, error);
            }
          }
        }
      );

      await Promise.all(connectionPromises);

      const clients = clientManager.getAllClients();

      if (clients.length === 0) {
        console.error('No MCP servers connected');
        process.exit(1);
      }

      // Initialize skill service if skills are configured
      const cwd = process.env.PROJECT_PATH || process.cwd();
      const skillPaths = config.skills?.paths || [];
      const skillService = skillPaths.length > 0 ? new SkillService(cwd, skillPaths) : undefined;

      // Search for tools and skills
      const foundTools: any[] = [];
      const foundSkills: any[] = [];
      const notFoundTools: string[] = [...toolNames];

      // Fetch tools from all clients in parallel
      const filteredClients = clients.filter(
        (client) => !options.server || client.serverName === options.server
      );

      const toolResults = await Promise.all(
        filteredClients.map(async (client) => {
          try {
            const tools = await client.listTools();
            return { client, tools, error: null };
          } catch (error) {
            return { client, tools: [] as any[], error };
          }
        })
      );

      for (const { client, tools, error } of toolResults) {
        if (error) {
          if (!options.json) {
            console.error(`Failed to list tools from ${client.serverName}:`, error);
          }
          continue;
        }

        for (const toolName of toolNames) {
          const tool = tools.find((t: any) => t.name === toolName);
          if (tool) {
            foundTools.push({
              server: client.serverName,
              name: tool.name,
              description: tool.description,
              inputSchema: tool.inputSchema,
            });

            // Remove from not found list
            const idx = notFoundTools.indexOf(toolName);
            if (idx > -1) {
              notFoundTools.splice(idx, 1);
            }
          }
        }
      }

      // Search for skills in remaining not found tools
      if (skillService && notFoundTools.length > 0) {
        const skillsToCheck = [...notFoundTools];
        for (const toolName of skillsToCheck) {
          // Handle skill__ prefix
          const skillName = toolName.startsWith('skill__')
            ? toolName.slice('skill__'.length)
            : toolName;

          const skill = await skillService.getSkill(skillName);
          if (skill) {
            foundSkills.push({
              name: skill.name,
              location: skill.basePath,
              instructions: skill.content,
            });

            // Remove from not found list
            const idx = notFoundTools.indexOf(toolName);
            if (idx > -1) {
              notFoundTools.splice(idx, 1);
            }
          }
        }
      }

      // Build next steps guidance
      const nextSteps: string[] = [];
      if (foundTools.length > 0) {
        nextSteps.push('For MCP tools: Use the use_tool function with toolName and toolArgs based on the inputSchema above.');
      }
      if (foundSkills.length > 0) {
        nextSteps.push(`For skill, just follow skill's description to continue.`);
      }

      // Output results
      if (options.json) {
        const result: any = {};
        if (foundTools.length > 0) {
          result.tools = foundTools;
        }
        if (foundSkills.length > 0) {
          result.skills = foundSkills;
        }
        if (nextSteps.length > 0) {
          result.nextSteps = nextSteps;
        }
        if (notFoundTools.length > 0) {
          result.notFound = notFoundTools;
        }
        console.log(JSON.stringify(result, null, 2));
      } else {
        if (foundTools.length > 0) {
          console.log('\nFound tools:\n');
          for (const tool of foundTools) {
            console.log(`Server: ${tool.server}`);
            console.log(`Tool: ${tool.name}`);
            console.log(`Description: ${tool.description || 'No description'}`);
            console.log(`Input Schema:`);
            console.log(JSON.stringify(tool.inputSchema, null, 2));
            console.log('');
          }
        }

        if (foundSkills.length > 0) {
          console.log('\nFound skills:\n');
          for (const skill of foundSkills) {
            console.log(`Skill: ${skill.name}`);
            console.log(`Location: ${skill.location}`);
            console.log(`Instructions:\n${skill.instructions}`);
            console.log('');
          }
        }

        // Print next steps guidance
        if (nextSteps.length > 0) {
          console.log('\nNext steps:');
          for (const step of nextSteps) {
            console.log(`  • ${step}`);
          }
          console.log('');
        }

        if (notFoundTools.length > 0) {
          console.error(`\nTools/skills not found: ${notFoundTools.join(', ')}`);
        }

        if (foundTools.length === 0 && foundSkills.length === 0) {
          console.error('No tools or skills found');
          process.exit(1);
        }
      }

      // Cleanup
      await clientManager.disconnectAll();

    } catch (error) {
      console.error('Error executing describe-tools:', error);
      process.exit(1);
    }
  });
