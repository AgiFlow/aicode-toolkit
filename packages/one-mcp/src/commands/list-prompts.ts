import { Command } from 'commander';
import { ConfigFetcherService, McpClientManagerService } from '../services';
import type { McpPromptInfo } from '../types';
import { findConfigFile } from '../utils';

interface ListPromptsOptions {
  config?: string;
  server?: string;
  json: boolean;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const listPromptsCommand = new Command('list-prompts')
  .description('List all available prompts from connected MCP servers')
  .option('-c, --config <path>', 'Path to MCP server configuration file')
  .option('-s, --server <name>', 'Filter by server name')
  .option('-j, --json', 'Output as JSON', false)
  .action(async (options: ListPromptsOptions): Promise<void> => {
    try {
      const configFilePath = options.config || findConfigFile();

      if (!configFilePath) {
        throw new Error('No config file found. Use --config or create mcp-config.yaml');
      }

      const configFetcher = new ConfigFetcherService({ configFilePath });
      const config = await configFetcher.fetchConfiguration();
      const clientManager = new McpClientManagerService();

      await Promise.all(
        Object.entries(config.mcpServers).map(async ([serverName, serverConfig]) => {
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
        }),
      );

      const clients = options.server
        ? [clientManager.getClient(options.server)].filter(
            (client): client is NonNullable<typeof client> => client !== undefined,
          )
        : clientManager.getAllClients();

      if (clients.length === 0) {
        throw new Error('No MCP servers connected');
      }

      const promptsByServer: Record<string, McpPromptInfo[]> = {};
      await Promise.all(
        clients.map(async (client) => {
          try {
            promptsByServer[client.serverName] = await client.listPrompts();
          } catch (error) {
            promptsByServer[client.serverName] = [];
            if (!options.json) {
              console.error(
                `Failed to list prompts from ${client.serverName}: ${toErrorMessage(error)}`,
              );
            }
          }
        }),
      );

      if (options.json) {
        console.log(JSON.stringify(promptsByServer, null, 2));
      } else {
        for (const [serverName, prompts] of Object.entries(promptsByServer)) {
          console.log(`\n${serverName}:`);
          if (prompts.length === 0) {
            console.log('  No prompts available');
            continue;
          }

          for (const prompt of prompts) {
            console.log(`  - ${prompt.name}: ${prompt.description || 'No description'}`);
            if (prompt.arguments && prompt.arguments.length > 0) {
              const args = prompt.arguments
                .map((arg) => `${arg.name}${arg.required ? ' (required)' : ''}`)
                .join(', ');
              console.log(`    args: ${args}`);
            }
          }
        }
      }

      await clientManager.disconnectAll();
    } catch (error) {
      console.error(`Error executing list-prompts: ${toErrorMessage(error)}`);
      process.exit(1);
    }
  });
