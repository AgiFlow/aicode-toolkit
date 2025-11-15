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
      if (!options.config) {
        console.error('Error: --config is required');
        process.exit(1);
      }

      // Initialize services
      const configFetcher = new ConfigFetcherService({
        configFilePath: options.config,
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

      // Search for tools
      const foundTools: any[] = [];
      const notFoundTools: string[] = [...toolNames];

      for (const client of clients) {
        // Skip if server filter doesn't match
        if (options.server && client.serverName !== options.server) {
          continue;
        }

        try {
          const tools = await client.listTools();

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
        } catch (error) {
          if (!options.json) {
            console.error(`Failed to list tools from ${client.serverName}:`, error);
          }
        }
      }

      // Output results
      if (options.json) {
        const result: any = { tools: foundTools };
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

        if (notFoundTools.length > 0) {
          console.error(`\nTools not found: ${notFoundTools.join(', ')}`);
        }

        if (foundTools.length === 0) {
          console.error('No tools found');
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
