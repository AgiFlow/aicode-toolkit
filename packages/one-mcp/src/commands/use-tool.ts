/**
 * Use Tool Command
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
 * Execute an MCP tool with arguments
 */
export const useToolCommand = new Command('use-tool')
  .description('Execute an MCP tool with arguments')
  .argument('<toolName>', 'Tool name to execute')
  .option('-c, --config <path>', 'Path to MCP server configuration file')
  .option('-s, --server <name>', 'Server name (required if tool exists on multiple servers)')
  .option('-a, --args <json>', 'Tool arguments as JSON string', '{}')
  .option('-j, --json', 'Output as JSON', false)
  .action(async (toolName: string, options) => {
    try {
      // Find config file: use provided path, or search PROJECT_PATH then cwd
      const configFilePath = options.config || findConfigFile();

      if (!configFilePath) {
        console.error('Error: No config file found. Use --config or create mcp-config.yaml');
        process.exit(1);
      }

      // Parse tool arguments
      let toolArgs: any = {};
      try {
        toolArgs = JSON.parse(options.args);
      } catch (error) {
        console.error('Error: Invalid JSON in --args');
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

      // If server is specified, use that server
      if (options.server) {
        const client = clientManager.getClient(options.server);
        if (!client) {
          console.error(`Server "${options.server}" not found`);
          process.exit(1);
        }

        try {
          if (!options.json) {
            console.error(`Executing ${toolName} on ${options.server}...`);
          }

          const result = await client.callTool(toolName, toolArgs);

          if (options.json) {
            console.log(JSON.stringify(result, null, 2));
          } else {
            console.log('\nResult:');
            if (result.content) {
              for (const content of result.content) {
                if (content.type === 'text') {
                  console.log(content.text);
                } else {
                  console.log(JSON.stringify(content, null, 2));
                }
              }
            }
            if (result.isError) {
              console.error('\n⚠️  Tool execution returned an error');
              process.exit(1);
            }
          }

          await clientManager.disconnectAll();
          return;
        } catch (error) {
          console.error(`Failed to execute tool "${toolName}":`, error);
          await clientManager.disconnectAll();
          process.exit(1);
        }
      }

      // Search for the tool across all servers
      const matchingServers: string[] = [];

      for (const client of clients) {
        try {
          const tools = await client.listTools();
          const hasTool = tools.some((t: any) => t.name === toolName);
          if (hasTool) {
            matchingServers.push(client.serverName);
          }
        } catch (error) {
          if (!options.json) {
            console.error(`Failed to list tools from ${client.serverName}:`, error);
          }
        }
      }

      if (matchingServers.length === 0) {
        console.error(`Tool "${toolName}" not found on any connected server`);
        await clientManager.disconnectAll();
        process.exit(1);
      }

      if (matchingServers.length > 1) {
        console.error(`Tool "${toolName}" found on multiple servers: ${matchingServers.join(', ')}`);
        console.error('Please specify --server to disambiguate');
        await clientManager.disconnectAll();
        process.exit(1);
      }

      // Execute on the single matching server
      const targetServer = matchingServers[0];
      const client = clientManager.getClient(targetServer);

      if (!client) {
        console.error(`Internal error: Server "${targetServer}" not connected`);
        await clientManager.disconnectAll();
        process.exit(1);
      }

      try {
        if (!options.json) {
          console.error(`Executing ${toolName} on ${targetServer}...`);
        }

        const result = await client.callTool(toolName, toolArgs);

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log('\nResult:');
          if (result.content) {
            for (const content of result.content) {
              if (content.type === 'text') {
                console.log(content.text);
              } else {
                console.log(JSON.stringify(content, null, 2));
              }
            }
          }
          if (result.isError) {
            console.error('\n⚠️  Tool execution returned an error');
            await clientManager.disconnectAll();
            process.exit(1);
          }
        }

        await clientManager.disconnectAll();

      } catch (error) {
        console.error(`Failed to execute tool "${toolName}":`, error);
        await clientManager.disconnectAll();
        process.exit(1);
      }

    } catch (error) {
      console.error('Error executing use-tool:', error);
      process.exit(1);
    }
  });
