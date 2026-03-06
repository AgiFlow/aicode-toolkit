/**
 * MCP Server Setup
 *
 * DESIGN PATTERNS:
 * - Factory pattern for server creation
 * - Tool registration pattern
 * - Dependency injection for services
 *
 * CODING STANDARDS:
 * - Register all tools, resources, and prompts here
 * - Keep server setup modular and extensible
 * - Import tools from ../tools/ and register them in the handlers
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ConfigFetcherService } from '../services/ConfigFetcherService';
import { DefinitionsCacheService } from '../services/DefinitionsCacheService';
import { McpClientManagerService } from '../services/McpClientManagerService';
import { SkillService } from '../services/SkillService';
import { DescribeToolsTool } from '../tools/DescribeToolsTool';
import { SearchListToolsTool } from '../tools/SearchListToolsTool';
import { UseToolTool } from '../tools/UseToolTool';
import { getToolCapabilities, getUniqueSortedCapabilities } from '../utils/toolCapabilities';
import { parseToolName, generateServerId } from '../utils';
import type { CachedServerDefinition, ToolDefinition } from '../types';
import packageJson from '../../package.json' assert { type: 'json' };

/**
 * Configuration options for creating an MCP server instance
 * @property configFilePath - Path to the MCP configuration file
 * @property noCache - Skip cache when fetching remote configuration
 * @property skills - Skills configuration with paths array (optional, skills disabled if not provided)
 * @property serverId - CLI-provided server ID (takes precedence over config file id)
 */
export interface ServerOptions {
  configFilePath?: string;
  noCache?: boolean;
  skills?: { paths: string[] };
  serverId?: string;
  definitionsCachePath?: string;
  clearDefinitionsCache?: boolean;
  proxyMode?: 'meta' | 'flat' | 'search';
}

export function summarizeServerTools(serverDefinition: CachedServerDefinition): string {
  const toolNames = serverDefinition.tools.map((tool) => tool.name);
  const capabilities = getUniqueSortedCapabilities(serverDefinition.tools);
  const capabilitySummary = capabilities.length > 0
    ? `; capabilities: ${capabilities.join(', ')}`
    : '';
  if (toolNames.length === 0) {
    return `${serverDefinition.serverName} (no tools cached${capabilitySummary})`;
  }
  return `${serverDefinition.serverName} (${toolNames.join(', ')})${capabilitySummary}`;
}

export function buildFlatToolDescription(
  serverDefinition: CachedServerDefinition,
  tool: CachedServerDefinition['tools'][number],
): string {
  const parts = [
    `Proxied from server "${serverDefinition.serverName}" as tool "${tool.name}".`,
  ];

  if (serverDefinition.serverInstruction) {
    parts.push(`Server summary: ${serverDefinition.serverInstruction}`);
  }

  if (tool.description && !serverDefinition.omitToolDescription) {
    parts.push(tool.description);
  }

  const capabilities = getToolCapabilities(tool);
  if (capabilities.length > 0) {
    parts.push(`Capabilities: ${capabilities.join(', ')}`);
  }

  return parts.join('\n\n');
}

export function buildFlatToolDefinitions(serverDefinitions: CachedServerDefinition[]): ToolDefinition[] {
  const toolToServers = new Map<string, string[]>();

  for (const serverDefinition of serverDefinitions) {
    for (const tool of serverDefinition.tools) {
      if (!toolToServers.has(tool.name)) {
        toolToServers.set(tool.name, []);
      }
      toolToServers.get(tool.name)?.push(serverDefinition.serverName);
    }
  }

  const definitions: ToolDefinition[] = [];
  for (const serverDefinition of serverDefinitions) {
    for (const tool of serverDefinition.tools) {
      const hasClash = (toolToServers.get(tool.name) || []).length > 1;
      definitions.push({
        name: hasClash ? `${serverDefinition.serverName}__${tool.name}` : tool.name,
        description: buildFlatToolDescription(serverDefinition, tool),
        inputSchema: tool.inputSchema as ToolDefinition['inputSchema'],
        _meta: tool._meta,
      });
    }
  }

  return definitions;
}

async function hasAnySkills(
  definitionsCacheService: DefinitionsCacheService,
  skillService?: SkillService,
): Promise<boolean> {
  const [fileSkills, serverDefinitions] = await Promise.all([
    skillService ? skillService.getSkills() : definitionsCacheService.getCachedFileSkills(),
    definitionsCacheService.getServerDefinitions(),
  ]);

  return fileSkills.length > 0 || serverDefinitions.some((server) => server.promptSkills.length > 0);
}

export function buildSkillsDescribeDefinition(
  serverDefinitions: CachedServerDefinition[],
  serverId: string,
): ToolDefinition {
  const proxySummary = serverDefinitions.length > 0
    ? serverDefinitions.map(summarizeServerTools).join('; ')
    : 'No proxied servers available.';

  return {
    name: DescribeToolsTool.TOOL_NAME,
    description:
      `Get detailed skill instructions for file-based skills and prompt-based skills proxied by one-mcp.\n\n` +
      `Proxy summary: ${proxySummary}\n\n` +
      `Use this when you need the full instructions for a skill. For MCP tools, call the flat tool names directly. ` +
      `Only use skills discovered from describe_tools with id="${serverId}".`,
    inputSchema: {
      type: 'object',
      properties: {
        toolNames: {
          type: 'array',
          items: {
            type: 'string',
            minLength: 1,
          },
          description: 'List of skill names to get detailed information about',
          minItems: 1,
        },
      },
      required: ['toolNames'],
      additionalProperties: false,
    },
  };
}

export function buildSearchDescribeDefinition(
  serverDefinitions: CachedServerDefinition[],
  serverId: string,
): ToolDefinition {
  const summary = serverDefinitions.length > 0
    ? serverDefinitions.map(summarizeServerTools).join('; ')
    : 'No proxied servers available.';

  return {
    name: DescribeToolsTool.TOOL_NAME,
    description:
      `Get detailed schemas and skill instructions for proxied MCP capabilities.\n\n` +
      `Proxy summary: ${summary}\n\n` +
      `Use list_tools first to search capability summaries and discover tool names. ` +
      `Then use describe_tools to fetch full schemas or skill instructions. ` +
      `Only use capabilities discovered from one-mcp id="${serverId}".`,
    inputSchema: {
      type: 'object',
      properties: {
        toolNames: {
          type: 'array',
          items: {
            type: 'string',
            minLength: 1,
          },
          description: 'List of tool or skill names to get detailed information about',
          minItems: 1,
        },
      },
      required: ['toolNames'],
      additionalProperties: false,
    },
  };
}

export function buildProxyInstructions(
  serverDefinitions: CachedServerDefinition[],
  mode: 'meta' | 'flat' | 'search',
  includeSkillsTool: boolean,
): string {
  const summary = serverDefinitions.length > 0
    ? serverDefinitions.map(summarizeServerTools).join('; ')
    : 'No proxied servers available.';

  if (mode === 'flat') {
    return [
      'one-mcp proxies downstream MCP servers and exposes their tools and resources directly.',
      `Proxied servers and tools: ${summary}`,
      includeSkillsTool
        ? 'Skills are still exposed through describe_tools when file-based skills or prompt-backed skills are configured.'
        : 'No skills are currently exposed through describe_tools.',
    ].join('\n\n');
  }

  if (mode === 'search') {
    return [
      'one-mcp proxies downstream MCP servers in search mode.',
      `Proxied servers and tools: ${summary}`,
      'Use list_tools to search capability summaries and discover tool names, describe_tools to fetch schemas or skill instructions, and use_tool to execute tools.',
    ].join('\n\n');
  }

  return [
    'one-mcp proxies downstream MCP servers in meta mode.',
    `Proxied servers and tools: ${summary}`,
    'Use describe_tools to inspect capabilities and use_tool to execute them.',
  ].join('\n\n');
}

export async function createServer(options?: ServerOptions): Promise<Server> {
  // Initialize services
  const clientManager = new McpClientManagerService();

  // Track config values from config file (will be set if config is loaded)
  let configSkills: { paths: string[] } | undefined;
  let configId: string | undefined;
  let configHash: string | undefined;
  let effectiveDefinitionsCachePath: string | undefined;
  let shouldStartFromCache = false;

  // Load and connect to MCP servers if config is provided
  if (options?.configFilePath) {
    // Fetch configuration with proper error handling
    let config;
    try {
      const configFetcher = new ConfigFetcherService({
        configFilePath: options.configFilePath,
        useCache: !options.noCache, // Disable cache reading when --no-cache is provided
      });

      // Force refresh if noCache option is enabled
      config = await configFetcher.fetchConfiguration(options.noCache || false);
    } catch (error) {
      throw new Error(
        `Failed to load MCP configuration from '${options.configFilePath}': ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Get config values from config file
    configSkills = config.skills;
    configId = config.id;
    configHash = DefinitionsCacheService.generateConfigHash(config);
    effectiveDefinitionsCachePath =
      options.definitionsCachePath ||
      DefinitionsCacheService.getDefaultCachePath(options.configFilePath);
    clientManager.registerServerConfigs(config.mcpServers);

    if (options.clearDefinitionsCache && effectiveDefinitionsCachePath) {
      await DefinitionsCacheService.clearFile(effectiveDefinitionsCachePath);
      console.error(`[definitions-cache] Cleared ${effectiveDefinitionsCachePath}`);
    }

    if (effectiveDefinitionsCachePath) {
      try {
        const cacheData = await DefinitionsCacheService.readFromFile(effectiveDefinitionsCachePath);
        if (
          DefinitionsCacheService.isCacheValid(cacheData, {
            configHash,
            oneMcpVersion: packageJson.version,
          })
        ) {
          shouldStartFromCache = true;
        }
      } catch {
        // Ignore cache read failures here; bootstrap will fall back to eager connect below.
      }
    }

    if (!shouldStartFromCache) {
      // Connect to all configured MCP servers and track failures
      const failedConnections: Array<{ serverName: string; error: Error }> = [];
      const connectionPromises = Object.entries(config.mcpServers).map(
        async ([serverName, serverConfig]) => {
          try {
            await clientManager.connectToServer(serverName, serverConfig);
            console.error(`Connected to MCP server: ${serverName}`);
          } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            failedConnections.push({ serverName, error: err });
            console.error(`Failed to connect to ${serverName}:`, error);
          }
        }
      );

      await Promise.all(connectionPromises);

      // Log warning for partial failures
      if (failedConnections.length > 0 && failedConnections.length < Object.keys(config.mcpServers).length) {
        console.error(
          `Warning: Some MCP server connections failed: ${failedConnections.map((f) => f.serverName).join(', ')}`
        );
      }

      // If all connections failed, throw an error
      if (failedConnections.length > 0 && failedConnections.length === Object.keys(config.mcpServers).length) {
        throw new Error(
          `All MCP server connections failed: ${failedConnections.map((f) => `${f.serverName}: ${f.error.message}`).join(', ')}`
        );
      }
    } else {
      console.error(`[definitions-cache] Using cached definitions from ${effectiveDefinitionsCachePath}`);
    }
  }

  // Resolve server ID with priority: CLI option > config file > auto-generate
  const serverId = options?.serverId || configId || generateServerId();
  console.error(`[one-mcp] Server ID: ${serverId}`);

  // Initialize skill service only if skills are explicitly configured
  // Skills are disabled by default since Claude Code already handles skills natively
  const skillsConfig = options?.skills || configSkills;
  const skillPaths = skillsConfig?.paths ?? [];

  // Use a reference object to safely capture describeTools in the callback closure
  // This avoids the temporal dead zone issue with forward references
  const toolsRef: { describeTools: DescribeToolsTool | null } = { describeTools: null };

  const skillService = skillPaths.length > 0
    ? new SkillService(process.cwd(), skillPaths, {
        // When skill files change, also invalidate the auto-detected skills cache
        onCacheInvalidated: () => {
          toolsRef.describeTools?.clearAutoDetectedSkillsCache();
        },
      })
    : undefined;

  let definitionsCacheService: DefinitionsCacheService;
  if (effectiveDefinitionsCachePath) {
    try {
      const cacheData = await DefinitionsCacheService.readFromFile(effectiveDefinitionsCachePath);
      if (
        DefinitionsCacheService.isCacheValid(cacheData, {
          configHash,
          oneMcpVersion: packageJson.version,
        })
      ) {
        definitionsCacheService = new DefinitionsCacheService(clientManager, skillService, {
          cacheData,
        });
      } else {
        definitionsCacheService = new DefinitionsCacheService(clientManager, skillService);
      }
    } catch (error) {
      console.error(
        `[definitions-cache] Failed to load ${effectiveDefinitionsCachePath}, falling back to live discovery: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      definitionsCacheService = new DefinitionsCacheService(clientManager, skillService);
    }
  } else {
    definitionsCacheService = new DefinitionsCacheService(clientManager, skillService);
  }

  // Initialize tools with dependencies and server ID
  const describeTools = new DescribeToolsTool(
    clientManager,
    skillService,
    serverId,
    definitionsCacheService,
  );
  const useToolWithCache = new UseToolTool(
    clientManager,
    skillService,
    serverId,
    definitionsCacheService,
  );
  const searchListTools = new SearchListToolsTool(clientManager, definitionsCacheService);

  // Assign to reference for cache invalidation callback
  toolsRef.describeTools = describeTools;

  const serverDefinitions = await definitionsCacheService.getServerDefinitions();
  const includeSkillsTool = await hasAnySkills(definitionsCacheService, skillService);
  const proxyMode = options?.proxyMode || 'meta';

  const server = new Server(
    {
      name: '@agiflowai/one-mcp',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
      instructions: buildProxyInstructions(serverDefinitions, proxyMode, includeSkillsTool),
    }
  );

  // Start watching skill directories for changes (non-critical - cache still works without watcher)
  if (skillService) {
    skillService.startWatching().catch((error) => {
      // Watcher failure is non-critical: skills still work, just won't auto-refresh on file changes
      console.error(`[skill-watcher] File watcher failed (non-critical): ${error instanceof Error ? error.message : 'Unknown error'}`);
    });
  }

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: proxyMode === 'flat'
      ? await (async () => {
          const currentServerDefinitions = await definitionsCacheService.getServerDefinitions();
          const shouldIncludeSkillsTool = await hasAnySkills(definitionsCacheService, skillService);

          return [
            ...buildFlatToolDefinitions(currentServerDefinitions),
            ...(shouldIncludeSkillsTool
              ? [buildSkillsDescribeDefinition(currentServerDefinitions, serverId)]
              : []),
          ];
        })()
      : proxyMode === 'search'
        ? await (async () => {
            const currentServerDefinitions = await definitionsCacheService.getServerDefinitions();
            return [
              buildSearchDescribeDefinition(currentServerDefinitions, serverId),
              await searchListTools.getDefinition(),
              useToolWithCache.getDefinition(),
            ];
          })()
      : [
          await describeTools.getDefinition(),
          useToolWithCache.getDefinition(),
        ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === DescribeToolsTool.TOOL_NAME) {
      try {
        return await describeTools.execute(args as any);
      } catch (error) {
        throw new Error(
          `Failed to execute ${name}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    if (name === UseToolTool.TOOL_NAME) {
      try {
        return await useToolWithCache.execute(args as any);
      } catch (error) {
        throw new Error(
          `Failed to execute ${name}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    if (name === SearchListToolsTool.TOOL_NAME && proxyMode === 'search') {
      try {
        return await searchListTools.execute(args as any);
      } catch (error) {
        throw new Error(
          `Failed to execute ${name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (proxyMode === 'flat') {
      return await useToolWithCache.execute({
        toolName: name,
        toolArgs: (args as Record<string, unknown> | undefined) || {},
      });
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const serverDefinitions = await definitionsCacheService.getServerDefinitions();
    const resourceToServers = new Map<string, string[]>();

    for (const serverDefinition of serverDefinitions) {
      for (const resource of serverDefinition.resources) {
        if (!resourceToServers.has(resource.uri)) {
          resourceToServers.set(resource.uri, []);
        }
        resourceToServers.get(resource.uri)?.push(serverDefinition.serverName);
      }
    }

    const resources = [];
    for (const serverDefinition of serverDefinitions) {
      for (const resource of serverDefinition.resources) {
        const hasClash = (resourceToServers.get(resource.uri) || []).length > 1;
        resources.push({
          ...resource,
          uri: hasClash ? `${serverDefinition.serverName}__${resource.uri}` : resource.uri,
        });
      }
    }

    return { resources };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    const { serverName, actualToolName: actualUri } = parseToolName(uri);

    if (serverName) {
      const client = await clientManager.ensureConnected(serverName);
      return await client.readResource(actualUri);
    }

    const matchingServers = await definitionsCacheService.getServersForResource(actualUri);

    if (matchingServers.length === 0) {
      throw new Error(`Resource not found: ${uri}`);
    }

    if (matchingServers.length > 1) {
      throw new Error(
        `Resource "${actualUri}" exists on multiple servers: ${matchingServers.join(', ')}. ` +
          `Use the prefixed format (e.g., "${matchingServers[0]}__${actualUri}") to specify which server to use.`,
      );
    }

    const client = await clientManager.ensureConnected(matchingServers[0]);
    return await client.readResource(actualUri);
  });

  // Prompt handlers - aggregate prompts from all connected MCP servers
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    const serverDefinitions = await definitionsCacheService.getServerDefinitions();

    // Collect all prompts from all servers to detect name clashes
    const promptToServers = new Map<string, string[]>();
    const serverPromptsMap = new Map<string, Array<{ name: string; description?: string; arguments?: Array<{ name: string; description?: string; required?: boolean }> }>>();

    for (const serverDefinition of serverDefinitions) {
      serverPromptsMap.set(serverDefinition.serverName, serverDefinition.prompts);
      for (const prompt of serverDefinition.prompts) {
        if (!promptToServers.has(prompt.name)) {
          promptToServers.set(prompt.name, []);
        }
        promptToServers.get(prompt.name)!.push(serverDefinition.serverName);
      }
    }

    // Build aggregated prompt list with server prefix when there are clashes
    const aggregatedPrompts: Array<{ name: string; description?: string; arguments?: Array<{ name: string; description?: string; required?: boolean }> }> = [];

    for (const serverDefinition of serverDefinitions) {
      const prompts = serverPromptsMap.get(serverDefinition.serverName) || [];
      for (const prompt of prompts) {
        const servers = promptToServers.get(prompt.name) || [];
        const hasClash = servers.length > 1;

        aggregatedPrompts.push({
          name: hasClash ? `${serverDefinition.serverName}__${prompt.name}` : prompt.name,
          description: prompt.description,
          arguments: prompt.arguments,
        });
      }
    }

    return { prompts: aggregatedPrompts };
  });

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const serverDefinitions = await definitionsCacheService.getServerDefinitions();

    // Parse the prompt name to determine target server
    const { serverName, actualToolName: actualPromptName } = parseToolName(name);

    if (serverName) {
      // Prefixed format: {serverName}__{promptName} - call specific server
      const client = await clientManager.ensureConnected(serverName);
      return await client.getPrompt(actualPromptName, args);
    }

    // Plain prompt name - find which server(s) have this prompt
    const serversWithPrompt: string[] = [];
    for (const serverDefinition of serverDefinitions) {
      if (serverDefinition.prompts.some((prompt) => prompt.name === name)) {
        serversWithPrompt.push(serverDefinition.serverName);
      }
    }

    if (serversWithPrompt.length === 0) {
      throw new Error(`Prompt not found: ${name}`);
    }

    if (serversWithPrompt.length > 1) {
      throw new Error(
        `Prompt "${name}" exists on multiple servers: ${serversWithPrompt.join(', ')}. ` +
        `Use the prefixed format (e.g., "${serversWithPrompt[0]}__${name}") to specify which server to use.`
      );
    }

    // Unique prompt - call the single server that has it
    const client = clientManager.getClient(serversWithPrompt[0]);
    if (!client) {
      return await (await clientManager.ensureConnected(serversWithPrompt[0])).getPrompt(name, args);
    }
    return await client.getPrompt(name, args);
  });

  if (!shouldStartFromCache && effectiveDefinitionsCachePath && options?.configFilePath) {
    void definitionsCacheService
      .collectForCache({
        configPath: options.configFilePath,
        configHash,
        oneMcpVersion: packageJson.version,
        serverId,
      })
      .then((definitionsCache) =>
        DefinitionsCacheService.writeToFile(effectiveDefinitionsCachePath!, definitionsCache),
      )
      .then(() => {
        console.error(`[definitions-cache] Wrote ${effectiveDefinitionsCachePath}`);
      })
      .catch((error) => {
        console.error(
          `[definitions-cache] Failed to persist ${effectiveDefinitionsCachePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      });
  }

  return server;
}
