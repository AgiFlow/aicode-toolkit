/**
 * List Tools Command
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
 * List all available tools from connected MCP servers
 */
export const listToolsCommand = new Command('list-tools')
  .description('List all available tools from connected MCP servers')
  .option('-c, --config <path>', 'Path to MCP server configuration file')
  .option('-s, --server <name>', 'Filter by server name')
  .option('-j, --json', 'Output as JSON', false)
  .action(async (options) => {
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

      // Get all clients
      const clients = options.server
        ? [clientManager.getClient(options.server)].filter((c): c is NonNullable<typeof c> => c !== undefined)
        : clientManager.getAllClients();

      if (clients.length === 0) {
        console.error('No MCP servers connected');
        process.exit(1);
      }

      // Collect tools from all servers
      const toolsByServer: Record<string, any[]> = {};

      for (const client of clients) {
        try {
          const tools = await client.listTools();
          // Filter out blacklisted tools
          const blacklist = new Set(client.toolBlacklist || []);
          const filteredTools = tools.filter((t) => !blacklist.has(t.name));
          toolsByServer[client.serverName] = filteredTools;
        } catch (error) {
          if (!options.json) {
            console.error(`Failed to list tools from ${client.serverName}:`, error);
          }
          toolsByServer[client.serverName] = [];
        }
      }

      // Output results
      if (options.json) {
        console.log(JSON.stringify(toolsByServer, null, 2));
      } else {
        for (const [serverName, tools] of Object.entries(toolsByServer)) {
          console.log(`\n${serverName}:`);
          if (tools.length === 0) {
            console.log('  No tools available');
          } else {
            for (const tool of tools) {
              console.log(`  - ${tool.name}: ${tool.description || 'No description'}`);
            }
          }
        }
      }

      // Cleanup
      await clientManager.disconnectAll();

    } catch (error) {
      console.error('Error executing list-tools:', error);
      process.exit(1);
    }
  });
