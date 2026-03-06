import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Tool, ToolDefinition } from '../types';
import { DefinitionsCacheService } from '../services/DefinitionsCacheService';
import { getToolCapabilities, getUniqueSortedCapabilities } from '../utils/toolCapabilities';

interface SearchListToolsToolInput {
  capability?: string;
  serverName?: string;
}

interface SearchListToolsResult {
  servers: Array<{
    server: string;
    capabilities: string[];
    summary?: string;
    tools: Array<{
      name: string;
      description?: string;
      capabilities: string[];
    }>;
  }>;
}

export class SearchListToolsTool implements Tool<SearchListToolsToolInput> {
  static readonly TOOL_NAME = 'list_tools';

  constructor(
    private readonly _clientManager: unknown,
    private readonly definitionsCacheService: DefinitionsCacheService,
  ) {}

  private formatToolName(
    toolName: string,
    serverName: string,
    toolToServers: Map<string, string[]>,
  ): string {
    const matchingServers = toolToServers.get(toolName) || [];
    return matchingServers.length > 1 ? `${serverName}__${toolName}` : toolName;
  }

  async getDefinition(): Promise<ToolDefinition> {
    const serverDefinitions = await this.definitionsCacheService.getServerDefinitions();
    const capabilitySummary = serverDefinitions.length > 0
      ? serverDefinitions
          .map(
            (server) => {
              const capabilities = getUniqueSortedCapabilities(server.tools);
              const summary = capabilities.length > 0
                ? capabilities.join(', ')
                : server.serverInstruction || 'No capability summary available';
              return `${server.serverName}: ${summary}`;
            },
          )
          .join('\n')
      : 'No proxied servers available.';

    return {
      name: SearchListToolsTool.TOOL_NAME,
      description:
        `Search proxied MCP tools by server capability summary.\n\n` +
        `Available capabilities:\n${capabilitySummary}`,
      inputSchema: {
        type: 'object',
        properties: {
          capability: {
            type: 'string',
            description:
              'Optional capability filter. Matches explicit capability tags first, then server summaries, server names, tool names, and tool descriptions.',
          },
          serverName: {
            type: 'string',
            description: 'Optional server name filter.',
          },
        },
        additionalProperties: false,
      },
    };
  }

  async execute(input: SearchListToolsToolInput): Promise<CallToolResult> {
    const serverDefinitions = await this.definitionsCacheService.getServerDefinitions();
    const capabilityFilter = input.capability?.trim().toLowerCase();
    const serverNameFilter = input.serverName?.trim().toLowerCase();

    const toolToServers = new Map<string, string[]>();
    for (const serverDefinition of serverDefinitions) {
      for (const tool of serverDefinition.tools) {
        if (!toolToServers.has(tool.name)) {
          toolToServers.set(tool.name, []);
        }
        toolToServers.get(tool.name)?.push(serverDefinition.serverName);
      }
    }

    const filteredServers = serverDefinitions
      .filter((serverDefinition) => {
        if (serverNameFilter && serverDefinition.serverName.toLowerCase() !== serverNameFilter) {
          return false;
        }

        if (!capabilityFilter) {
          return true;
        }

        const capabilityText = serverDefinition.serverInstruction?.toLowerCase() || '';
        if (capabilityText.includes(capabilityFilter)) {
          return true;
        }

        const serverCapabilities = getUniqueSortedCapabilities(serverDefinition.tools);
        if (serverCapabilities.some((capability) => capability.toLowerCase().includes(capabilityFilter))) {
          return true;
        }

        return serverDefinition.tools.some((tool) => {
          const toolName = this.formatToolName(tool.name, serverDefinition.serverName, toolToServers);
          const toolCapabilities = getToolCapabilities(tool);
          return (
            toolName.toLowerCase().includes(capabilityFilter) ||
            (tool.description || '').toLowerCase().includes(capabilityFilter) ||
            toolCapabilities.some((capability) =>
              capability.toLowerCase().includes(capabilityFilter)
            )
          );
        });
      })
      .map((serverDefinition) => ({
        server: serverDefinition.serverName,
        capabilities: getUniqueSortedCapabilities(serverDefinition.tools),
        summary: serverDefinition.serverInstruction,
        tools: serverDefinition.tools.map((tool) => ({
          name: this.formatToolName(tool.name, serverDefinition.serverName, toolToServers),
          description: serverDefinition.omitToolDescription ? undefined : tool.description,
          capabilities: getToolCapabilities(tool),
        })),
      }))
      .filter((server) => server.tools.length > 0);

    const result: SearchListToolsResult = {
      servers: filteredServers,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
      isError: filteredServers.length === 0 ? true : undefined,
    };
  }
}
