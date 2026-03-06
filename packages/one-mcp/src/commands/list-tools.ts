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
import { ConfigFetcherService, DefinitionsCacheService, McpClientManagerService } from '../services';
import { SearchListToolsTool } from '../tools/SearchListToolsTool';
import { findConfigFile } from '../utils';

interface SearchToolsOptions {
  config?: string;
  server?: string;
  capability?: string;
  json: boolean;
  definitionsCache?: string;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function printSearchResults(result: {
  servers: Array<{
    server: string;
    capabilities?: string[];
    summary?: string;
    tools: Array<{ name: string; description?: string; capabilities?: string[] }>;
  }>;
}): void {
  for (const server of result.servers) {
    console.log(`\n${server.server}:`);
    if (server.capabilities && server.capabilities.length > 0) {
      console.log(`  capabilities: ${server.capabilities.join(', ')}`);
    }
    if (server.summary) {
      console.log(`  summary: ${server.summary}`);
    }
    if (server.tools.length === 0) {
      console.log('  no tools');
      continue;
    }

    for (const tool of server.tools) {
      const capabilitySummary =
        tool.capabilities && tool.capabilities.length > 0
          ? ` [${tool.capabilities.join(', ')}]`
          : '';
      console.log(`  - ${tool.name}${capabilitySummary}`);
      if (tool.description) {
        console.log(`    ${tool.description}`);
      }
    }
  }
}

export const searchToolsCommand = new Command('search-tools')
  .description('Search proxied MCP tools by capability or server')
  .option('-c, --config <path>', 'Path to MCP server configuration file')
  .option('-s, --server <name>', 'Filter by server name')
  .option('--capability <name>', 'Filter by capability tag, summary, tool name, or description')
  .option('--definitions-cache <path>', 'Path to definitions cache file')
  .option('-j, --json', 'Output as JSON', false)
  .action(async (options: SearchToolsOptions): Promise<void> => {
    try {
      const configFilePath = options.config || findConfigFile();

      if (!configFilePath) {
        throw new Error('No config file found. Use --config or create mcp-config.yaml');
      }

      const configFetcher = new ConfigFetcherService({ configFilePath });
      const config = await configFetcher.fetchConfiguration();
      const clientManager = new McpClientManagerService();
      clientManager.registerServerConfigs(config.mcpServers);

      const connectionPromises = Object.entries(config.mcpServers).map(
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
      );

      await Promise.all(connectionPromises);

      if (clientManager.getAllClients().length === 0) {
        throw new Error('No MCP servers connected');
      }

      const cachePath =
        options.definitionsCache || DefinitionsCacheService.getDefaultCachePath(configFilePath);
      let cacheData;
      try {
        cacheData = await DefinitionsCacheService.readFromFile(cachePath);
      } catch {
        cacheData = undefined;
      }

      const definitionsCacheService = new DefinitionsCacheService(clientManager, undefined, {
        cacheData,
      });
      const tool = new SearchListToolsTool(clientManager, definitionsCacheService);
      const result = await tool.execute({
        capability: options.capability,
        serverName: options.server,
      });
      const textBlock = result.content.find((content) => content.type === 'text');
      const parsed = textBlock?.type === 'text' ? JSON.parse(textBlock.text) : { servers: [] };

      if (options.json) {
        console.log(JSON.stringify(parsed, null, 2));
      } else {
        if (!parsed.servers || parsed.servers.length === 0) {
          throw new Error('No tools matched the requested filters');
        }
        printSearchResults(parsed);
      }

      await clientManager.disconnectAll();
    } catch (error) {
      console.error(`Error executing search-tools: ${toErrorMessage(error)}`);
      process.exit(1);
    }
  });
