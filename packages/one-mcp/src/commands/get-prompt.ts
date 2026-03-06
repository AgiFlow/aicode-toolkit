import { Command } from 'commander';
import { ConfigFetcherService, McpClientManagerService } from '../services';
import { findConfigFile } from '../utils';

interface GetPromptOptions {
  config?: string;
  server?: string;
  args: string;
  json: boolean;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const getPromptCommand = new Command('get-prompt')
  .description('Get a prompt by name from a connected MCP server')
  .argument('<promptName>', 'Prompt name to fetch')
  .option('-c, --config <path>', 'Path to MCP server configuration file')
  .option('-s, --server <name>', 'Server name (required if prompt exists on multiple servers)')
  .option('-a, --args <json>', 'Prompt arguments as JSON string', '{}')
  .option('-j, --json', 'Output as JSON', false)
  .action(async (promptName: string, options: GetPromptOptions): Promise<void> => {
    try {
      const configFilePath = options.config || findConfigFile();

      if (!configFilePath) {
        throw new Error('No config file found. Use --config or create mcp-config.yaml');
      }

      let promptArgs: Record<string, unknown> = {};
      try {
        promptArgs = JSON.parse(options.args);
      } catch {
        throw new Error('Invalid JSON in --args');
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

      const clients = clientManager.getAllClients();
      if (clients.length === 0) {
        throw new Error('No MCP servers connected');
      }

      if (options.server) {
        const client = clientManager.getClient(options.server);
        if (!client) {
          throw new Error(`Server "${options.server}" not found`);
        }

        const prompt = await client.getPrompt(promptName, promptArgs);
        if (options.json) {
          console.log(JSON.stringify(prompt, null, 2));
        } else {
          for (const message of prompt.messages) {
            const content = message.content;
            if (typeof content === 'object' && content && 'text' in content) {
              console.log((content as { text: string }).text);
            } else {
              console.log(JSON.stringify(message, null, 2));
            }
          }
        }

        await clientManager.disconnectAll();
        return;
      }

      const matchingServers: string[] = [];
      await Promise.all(
        clients.map(async (client) => {
          try {
            const prompts = await client.listPrompts();
            if (prompts.some((prompt) => prompt.name === promptName)) {
              matchingServers.push(client.serverName);
            }
          } catch (error) {
            if (!options.json) {
              console.error(
                `Failed to list prompts from ${client.serverName}: ${toErrorMessage(error)}`,
              );
            }
          }
        }),
      );

      if (matchingServers.length === 0) {
        throw new Error(`Prompt "${promptName}" not found on any connected server`);
      }

      if (matchingServers.length > 1) {
        throw new Error(
          `Prompt "${promptName}" found on multiple servers: ${matchingServers.join(', ')}. Use --server to disambiguate`,
        );
      }

      const client = clientManager.getClient(matchingServers[0]);
      if (!client) {
        throw new Error(`Internal error: Server "${matchingServers[0]}" not connected`);
      }

      const prompt = await client.getPrompt(promptName, promptArgs);
      if (options.json) {
        console.log(JSON.stringify(prompt, null, 2));
      } else {
        for (const message of prompt.messages) {
          const content = message.content;
          if (typeof content === 'object' && content && 'text' in content) {
            console.log((content as { text: string }).text);
          } else {
            console.log(JSON.stringify(message, null, 2));
          }
        }
      }

      await clientManager.disconnectAll();
    } catch (error) {
      console.error(`Error executing get-prompt: ${toErrorMessage(error)}`);
      process.exit(1);
    }
  });
