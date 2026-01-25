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
import { findConfigFile } from '../utils';

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

      // Get all clients
      const clients = options.server
        ? [clientManager.getClient(options.server)].filter((c): c is NonNullable<typeof c> => c !== undefined)
        : clientManager.getAllClients();

      if (clients.length === 0) {
        console.error('No MCP servers connected');
        process.exit(1);
      }

      // Collect tools from all servers in parallel
      const toolsByServer: Record<string, any[]> = {};

      const toolResults = await Promise.all(
        clients.map(async (client) => {
          try {
            const tools = await client.listTools();
            // Filter out blacklisted tools
            const blacklist = new Set(client.toolBlacklist || []);
            const filteredTools = tools.filter((t) => !blacklist.has(t.name));
            return { serverName: client.serverName, tools: filteredTools, error: null };
          } catch (error) {
            return { serverName: client.serverName, tools: [] as any[], error };
          }
        })
      );

      for (const { serverName, tools, error } of toolResults) {
        if (error && !options.json) {
          console.error(`Failed to list tools from ${serverName}:`, error);
        }
        toolsByServer[serverName] = tools;
      }

      // Output results
      if (options.json) {
        console.log(JSON.stringify(toolsByServer, null, 2));
      } else {
        for (const [serverName, tools] of Object.entries(toolsByServer)) {
          const client = clients.find(c => c.serverName === serverName);
          const omitDescription = client?.omitToolDescription || false;

          console.log(`\n${serverName}:`);
          if (tools.length === 0) {
            console.log('  No tools available');
          } else {
            if (omitDescription) {
              // Show tools as comma-separated list without descriptions
              const toolNames = tools.map(t => t.name).join(', ');
              console.log(`  ${toolNames}`);
            } else {
              // Show tools with descriptions (default)
              for (const tool of tools) {
                console.log(`  - ${tool.name}: ${tool.description || 'No description'}`);
              }
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
