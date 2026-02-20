/**
 * ReadResource Command
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
import { findConfigFile } from '../utils';

interface ReadResourceOptions {
  config?: string;
  server?: string;
  json: boolean;
}

interface ResourceSearchResult {
  serverName: string;
  hasResource: boolean;
  error: unknown;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Read a resource by URI from a connected MCP server
 */
export const readResourceCommand = new Command('read-resource')
  .description('Read a resource by URI from a connected MCP server')
  .argument('<uri>', 'Resource URI to read')
  .option('-c, --config <path>', 'Path to MCP server configuration file')
  .option('-s, --server <name>', 'Server name (required if resource exists on multiple servers)')
  .option('-j, --json', 'Output as JSON', false)
  .action(async (uri: string, options: ReadResourceOptions): Promise<void> => {
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
              // Always log to stderr — does not corrupt JSON stdout
              console.error(`✗ Failed to connect to ${serverName}: ${toErrorMessage(error)}`);
            }
          },
        ),
      );

      const clients = clientManager.getAllClients();

      if (clients.length === 0) {
        throw new Error('No MCP servers connected');
      }

      // If server is specified, read directly from that server
      if (options.server) {
        const client = clientManager.getClient(options.server);
        if (!client) {
          throw new Error(`Server "${options.server}" not found`);
        }

        if (!options.json) {
          console.error(`Reading ${uri} from ${options.server}...`);
        }

        const result = await client.readResource(uri);

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          for (const content of result.contents) {
            if ('text' in content) {
              console.log(content.text);
            } else {
              console.log(JSON.stringify(content, null, 2));
            }
          }
        }

        await clientManager.disconnectAll();
        return;
      }

      // Search for the resource across all servers in parallel
      const searchResults = await Promise.all(
        clients.map(async (client): Promise<ResourceSearchResult> => {
          try {
            const resources = await client.listResources();
            const hasResource = resources.some((r): boolean => r.uri === uri);
            return { serverName: client.serverName, hasResource, error: null };
          } catch (error) {
            return { serverName: client.serverName, hasResource: false, error };
          }
        }),
      );

      const matchingServers: string[] = [];
      for (const { serverName, hasResource, error } of searchResults) {
        if (error) {
          // Always log to stderr — does not corrupt JSON stdout
          console.error(`Failed to list resources from ${serverName}: ${toErrorMessage(error)}`);
          continue;
        }
        if (hasResource) {
          matchingServers.push(serverName);
        }
      }

      if (matchingServers.length === 0) {
        throw new Error(`Resource "${uri}" not found on any connected server`);
      }

      if (matchingServers.length > 1) {
        throw new Error(
          `Resource "${uri}" found on multiple servers: ${matchingServers.join(', ')}. Use --server to disambiguate`,
        );
      }

      const targetServer = matchingServers[0];
      const client = clientManager.getClient(targetServer);

      if (!client) {
        throw new Error(`Internal error: Server "${targetServer}" not connected`);
      }

      if (!options.json) {
        console.error(`Reading ${uri} from ${targetServer}...`);
      }

      const result = await client.readResource(uri);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        for (const content of result.contents) {
          if ('text' in content) {
            console.log(content.text);
          } else {
            console.log(JSON.stringify(content, null, 2));
          }
        }
      }

      await clientManager.disconnectAll();
    } catch (error) {
      console.error(`Error executing read-resource: ${toErrorMessage(error)}`);
      process.exit(1);
    }
  });
