/**
 * ListResources Command
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
import { ConfigFetcherService, McpClientManagerService } from '../services';
import type { McpResourceInfo } from '../types';
import { findConfigFile } from '../utils';

interface ListResourcesOptions {
  config?: string;
  server?: string;
  json: boolean;
}

interface ServerResourceResult {
  serverName: string;
  resources: McpResourceInfo[];
  error: unknown;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * List all available resources from connected MCP servers
 */
export const listResourcesCommand = new Command('list-resources')
  .description('List all available resources from connected MCP servers')
  .option('-c, --config <path>', 'Path to MCP server configuration file')
  .option('-s, --server <name>', 'Filter by server name')
  .option('-j, --json', 'Output as JSON', false)
  .action(async (options: ListResourcesOptions): Promise<void> => {
    try {
      const configFilePath = options.config || findConfigFile();

      if (!configFilePath) {
        throw new Error('No config file found. Use --config or create mcp-config.yaml');
      }

      const configFetcher = new ConfigFetcherService({ configFilePath });
      const config = await configFetcher.fetchConfiguration();
      const clientManager = new McpClientManagerService();

      // Connect to all configured MCP servers in parallel
      await Promise.all(
        Object.entries(config.mcpServers).map(
          async ([serverName, serverConfig]): Promise<void> => {
            try {
              await clientManager.connectToServer(serverName, serverConfig);
              if (!options.json) {
                console.error(`✓ Connected to ${serverName}`);
              }
            } catch (error) {
              if (!options.json) {
                console.error(`✗ Failed to connect to ${serverName}: ${toErrorMessage(error)}`);
              }
            }
          },
        ),
      );

      const clients = options.server
        ? [clientManager.getClient(options.server)].filter(
            (c): c is NonNullable<typeof c> => c !== undefined,
          )
        : clientManager.getAllClients();

      if (clients.length === 0) {
        throw new Error('No MCP servers connected');
      }

      // Collect resources from all servers in parallel
      const resourcesByServer: Record<string, McpResourceInfo[]> = {};

      const resourceResults: ServerResourceResult[] = await Promise.all(
        clients.map(async (client): Promise<ServerResourceResult> => {
          try {
            const resources = await client.listResources();
            return { serverName: client.serverName, resources, error: null };
          } catch (error) {
            const resources: McpResourceInfo[] = [];
            return { serverName: client.serverName, resources, error };
          }
        }),
      );

      for (const { serverName, resources, error } of resourceResults) {
        if (error && !options.json) {
          console.error(`Failed to list resources from ${serverName}: ${toErrorMessage(error)}`);
        }
        resourcesByServer[serverName] = resources;
      }

      // Output results
      if (options.json) {
        console.log(JSON.stringify(resourcesByServer, null, 2));
      } else {
        for (const [serverName, resources] of Object.entries(resourcesByServer)) {
          console.log(`\n${serverName}:`);
          if (resources.length === 0) {
            console.log('  No resources available');
          } else {
            for (const resource of resources) {
              const label = resource.name ? `${resource.name} (${resource.uri})` : resource.uri;
              console.log(
                `  - ${label}${resource.description ? `: ${resource.description}` : ''}`,
              );
            }
          }
        }
      }

      await clientManager.disconnectAll();
    } catch (error) {
      console.error(`Error executing list-resources: ${toErrorMessage(error)}`);
      process.exit(1);
    }
  });
