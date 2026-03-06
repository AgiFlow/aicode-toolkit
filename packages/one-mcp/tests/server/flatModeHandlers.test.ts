import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CachedServerDefinition, DefinitionsCacheFile, McpClientConnection } from '../../src/types';

const mocks = vi.hoisted(() => ({
  mockServerDefinitions: [] as CachedServerDefinition[],
  mockCachedSkills: [] as Array<{
    name: string;
    description: string;
    location: 'project' | 'user';
    basePath: string;
  }>,
  mockConnectedClient: undefined as McpClientConnection | undefined,
  mockEnsureConnected: vi.fn(),
  mockConnectToServer: vi.fn(),
  mockRegisterServerConfigs: vi.fn(),
  mockReadCacheFile: vi.fn(),
  mockWriteCacheFile: vi.fn(),
}));

vi.mock('../../src/services/ConfigFetcherService', () => ({
  ConfigFetcherService: class {
    async fetchConfiguration() {
      return {
        id: 'config-id',
        mcpServers: {
          alpha: {
            name: 'alpha',
            transport: 'stdio',
            config: { command: 'node', args: ['server.js'] },
          },
          beta: {
            name: 'beta',
            transport: 'stdio',
            config: { command: 'node', args: ['server.js'] },
          },
        },
      };
    }
  },
}));

vi.mock('../../src/services/McpClientManagerService', () => ({
  McpClientManagerService: class {
    registerServerConfigs = mocks.mockRegisterServerConfigs;
    connectToServer = mocks.mockConnectToServer;
    ensureConnected = mocks.mockEnsureConnected;
    getKnownServerNames = vi.fn(() => ['alpha', 'beta']);
    getAllClients = vi.fn(() => []);
    getClient = vi.fn(() => undefined);
  },
}));

vi.mock('../../src/services/SkillService', () => ({
  SkillService: class {
    getSkills = vi.fn().mockImplementation(async () => mocks.mockCachedSkills);
    startWatching = vi.fn().mockResolvedValue(undefined);
  },
}));

vi.mock('../../src/services/DefinitionsCacheService', () => {
  class MockDefinitionsCacheService {
    getServerDefinitions = vi.fn().mockImplementation(async () => mocks.mockServerDefinitions);
    getCachedFileSkills = vi.fn().mockImplementation(async () => mocks.mockCachedSkills);
    getServersForTool = vi.fn().mockImplementation(async (toolName: string) =>
      mocks.mockServerDefinitions
        .filter((server) => server.tools.some((tool) => tool.name === toolName))
        .map((server) => server.serverName),
    );
    getServersForResource = vi.fn().mockImplementation(async (uri: string) =>
      mocks.mockServerDefinitions
        .filter((server) => server.resources.some((resource) => resource.uri === uri))
        .map((server) => server.serverName),
    );
    getPromptSkillByName = vi.fn().mockImplementation(async (skillName: string) => {
      for (const server of mocks.mockServerDefinitions) {
        const promptSkill = server.promptSkills.find((skill) => skill.skill.name === skillName);
        if (promptSkill) {
          return {
            serverName: server.serverName,
            promptName: promptSkill.promptName,
            skill: promptSkill.skill,
            autoDetected: promptSkill.autoDetected,
          };
        }
      }
      return undefined;
    });
    clearLiveCache = vi.fn();
    collectForCache = vi.fn().mockResolvedValue({
      version: 1,
      generatedAt: new Date().toISOString(),
      servers: {},
      skills: [],
      failures: [],
    } satisfies DefinitionsCacheFile);
  }

  Object.assign(MockDefinitionsCacheService, {
    readFromFile: mocks.mockReadCacheFile,
    writeToFile: mocks.mockWriteCacheFile,
    clearFile: vi.fn().mockResolvedValue(undefined),
    getDefaultCachePath: vi.fn(() => '/tmp/one-mcp-definitions.json'),
    generateConfigHash: vi.fn(() => 'config-hash'),
    isCacheValid: vi.fn(() => false),
  });

  return {
    DefinitionsCacheService: MockDefinitionsCacheService,
  };
});

import { createServer } from '../../src/server';

function getRequestHandler<T>(server: any, method: string): T {
  const handler = server._requestHandlers.get(method);
  if (!handler) {
    throw new Error(`Handler not found for ${method}`);
  }
  return handler as T;
}

describe('createServer flat mode handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockCachedSkills = [];
    mocks.mockServerDefinitions = [
      {
        serverName: 'alpha',
        serverInstruction: 'Alpha tools',
        omitToolDescription: false,
        toolBlacklist: [],
        tools: [
          {
            name: 'search',
            description: 'Search alpha',
            inputSchema: { type: 'object', properties: { q: { type: 'string' } } },
          },
        ],
        resources: [
          {
            uri: 'file:///alpha.txt',
            name: 'alpha.txt',
          },
        ],
        prompts: [],
        promptSkills: [],
      },
      {
        serverName: 'beta',
        serverInstruction: 'Beta tools',
        omitToolDescription: false,
        toolBlacklist: [],
        tools: [
          {
            name: 'search',
            description: 'Search beta',
            inputSchema: { type: 'object', properties: { q: { type: 'string' } } },
          },
          {
            name: 'status',
            description: 'Status beta',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
        resources: [
          {
            uri: 'file:///alpha.txt',
            name: 'alpha-copy.txt',
          },
          {
            uri: 'file:///beta.txt',
            name: 'beta.txt',
          },
        ],
        prompts: [],
        promptSkills: [],
      },
    ];
    mocks.mockConnectedClient = {
      serverName: 'beta',
      transport: 'stdio',
      listTools: vi.fn(),
      listResources: vi.fn(),
      listPrompts: vi.fn(),
      callTool: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'tool result' }],
      }),
      readResource: vi.fn().mockResolvedValue({
        contents: [{ uri: 'file:///beta.txt', text: 'resource body', mimeType: 'text/plain' }],
      }),
      getPrompt: vi.fn(),
      close: vi.fn(),
    };
    mocks.mockEnsureConnected.mockResolvedValue(mocks.mockConnectedClient);
    mocks.mockConnectToServer.mockResolvedValue(undefined);
    mocks.mockReadCacheFile.mockRejectedValue(new Error('missing cache'));
    mocks.mockWriteCacheFile.mockResolvedValue(undefined);
  });

  it('lists proxied tools directly and omits describe_tools when there are no skills', async () => {
    const server = await createServer({
      configFilePath: '/tmp/mcp-config.yaml',
      proxyMode: 'flat',
    });
    const listToolsHandler = getRequestHandler<(request: unknown) => Promise<{ tools: Array<{ name: string }> }>>(
      server,
      'tools/list',
    );

    const result = await listToolsHandler({ method: 'tools/list' });
    const toolNames = result.tools.map((tool) => tool.name);

    expect(toolNames).toEqual(['alpha__search', 'beta__search', 'status']);
    expect(toolNames).not.toContain('use_tool');
    expect(toolNames).not.toContain('describe_tools');
    expect(server._instructions).toContain('alpha (search)');
    expect(server._instructions).toContain('beta (search, status)');
  });

  it('includes describe_tools in flat mode when prompt-based skills exist', async () => {
    mocks.mockServerDefinitions[0].promptSkills = [
      {
        promptName: 'review_prompt',
        skill: {
          name: 'review-skill',
          description: 'Review changes',
        },
      },
    ];

    const server = await createServer({
      configFilePath: '/tmp/mcp-config.yaml',
      proxyMode: 'flat',
    });
    const listToolsHandler = getRequestHandler<(request: unknown) => Promise<{ tools: Array<{ name: string }> }>>(
      server,
      'tools/list',
    );

    const result = await listToolsHandler({ method: 'tools/list' });

    expect(result.tools.map((tool) => tool.name)).toContain('describe_tools');
  });

  it('includes describe_tools in flat mode when file-based skills exist', async () => {
    mocks.mockCachedSkills = [
      {
        name: 'review-skill',
        description: 'Review changes',
        location: 'project',
        basePath: '/skills/review-skill',
      },
    ];

    const server = await createServer({
      configFilePath: '/tmp/mcp-config.yaml',
      proxyMode: 'flat',
      skills: { paths: ['.claude/skills'] },
    });
    const listToolsHandler = getRequestHandler<(request: unknown) => Promise<{ tools: Array<{ name: string }> }>>(
      server,
      'tools/list',
    );

    const result = await listToolsHandler({ method: 'tools/list' });

    expect(result.tools.map((tool) => tool.name)).toContain('describe_tools');
  });

  it('routes direct flat tool calls through the owning downstream server', async () => {
    const server = await createServer({
      configFilePath: '/tmp/mcp-config.yaml',
      proxyMode: 'flat',
    });
    const callToolHandler = getRequestHandler<
      (request: { method: string; params: { name: string; arguments?: Record<string, unknown> } }) => Promise<any>
    >(server, 'tools/call');

    await callToolHandler({
      method: 'tools/call',
      params: {
        name: 'status',
        arguments: { verbose: true },
      },
    });

    expect(mocks.mockEnsureConnected).toHaveBeenCalledWith('beta');
    expect(mocks.mockConnectedClient?.callTool).toHaveBeenCalledWith('status', { verbose: true });
  });

  it('returns an error when a clashing flat tool is called without a prefix', async () => {
    const server = await createServer({
      configFilePath: '/tmp/mcp-config.yaml',
      proxyMode: 'flat',
    });
    const callToolHandler = getRequestHandler<
      (request: { method: string; params: { name: string; arguments?: Record<string, unknown> } }) => Promise<any>
    >(server, 'tools/call');

    const result = await callToolHandler({
      method: 'tools/call',
      params: {
        name: 'search',
        arguments: {},
      },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('found on multiple servers');
  });

  it('lists flat resources and prefixes only clashing URIs', async () => {
    const server = await createServer({
      configFilePath: '/tmp/mcp-config.yaml',
      proxyMode: 'flat',
    });
    const listResourcesHandler = getRequestHandler<
      (request: unknown) => Promise<{ resources: Array<{ uri: string }> }>
    >(server, 'resources/list');

    const result = await listResourcesHandler({ method: 'resources/list' });

    expect(result.resources.map((resource) => resource.uri)).toEqual([
      'alpha__file:///alpha.txt',
      'beta__file:///alpha.txt',
      'file:///beta.txt',
    ]);
  });

  it('routes unique resource reads to the matching downstream server', async () => {
    const server = await createServer({
      configFilePath: '/tmp/mcp-config.yaml',
      proxyMode: 'flat',
    });
    const readResourceHandler = getRequestHandler<
      (request: { method: string; params: { uri: string } }) => Promise<any>
    >(server, 'resources/read');

    const result = await readResourceHandler({
      method: 'resources/read',
      params: {
        uri: 'file:///beta.txt',
      },
    });

    expect(mocks.mockEnsureConnected).toHaveBeenCalledWith('beta');
    expect(mocks.mockConnectedClient?.readResource).toHaveBeenCalledWith('file:///beta.txt');
    expect(result.contents[0].text).toBe('resource body');
  });

  it('routes prefixed resource reads to the specified downstream server', async () => {
    const server = await createServer({
      configFilePath: '/tmp/mcp-config.yaml',
      proxyMode: 'flat',
    });
    const readResourceHandler = getRequestHandler<
      (request: { method: string; params: { uri: string } }) => Promise<any>
    >(server, 'resources/read');

    await readResourceHandler({
      method: 'resources/read',
      params: {
        uri: 'alpha__file:///alpha.txt',
      },
    });

    expect(mocks.mockEnsureConnected).toHaveBeenCalledWith('alpha');
    expect(mocks.mockConnectedClient?.readResource).toHaveBeenCalledWith('file:///alpha.txt');
  });

  it('rejects ambiguous resource reads unless the URI is prefixed', async () => {
    const server = await createServer({
      configFilePath: '/tmp/mcp-config.yaml',
      proxyMode: 'flat',
    });
    const readResourceHandler = getRequestHandler<
      (request: { method: string; params: { uri: string } }) => Promise<any>
    >(server, 'resources/read');

    await expect(
      readResourceHandler({
        method: 'resources/read',
        params: {
          uri: 'file:///alpha.txt',
        },
      }),
    ).rejects.toThrow('exists on multiple servers');
  });

  it('search mode exposes describe_tools, list_tools, and use_tool instead of flat tools', async () => {
    const server = await createServer({
      configFilePath: '/tmp/mcp-config.yaml',
      proxyMode: 'search',
    });
    const listToolsHandler = getRequestHandler<
      (request: unknown) => Promise<{ tools: Array<{ name: string; description?: string }> }>
    >(server, 'tools/list');

    const result = await listToolsHandler({ method: 'tools/list' });

    expect(result.tools.map((tool) => tool.name)).toEqual([
      'describe_tools',
      'list_tools',
      'use_tool',
    ]);
    expect(result.tools[0].description).toContain('Use list_tools first');
  });

  it('meta mode keeps only describe_tools and use_tool', async () => {
    const server = await createServer({
      configFilePath: '/tmp/mcp-config.yaml',
      proxyMode: 'meta',
    });
    const listToolsHandler = getRequestHandler<
      (request: unknown) => Promise<{ tools: Array<{ name: string; description?: string }> }>
    >(server, 'tools/list');

    const result = await listToolsHandler({ method: 'tools/list' });

    expect(result.tools.map((tool) => tool.name)).toEqual([
      'describe_tools',
      'use_tool',
    ]);
    expect(server._instructions).toContain('meta mode');
  });

  it('search mode routes list_tools execution through the search tool handler', async () => {
    const server = await createServer({
      configFilePath: '/tmp/mcp-config.yaml',
      proxyMode: 'search',
    });
    const callToolHandler = getRequestHandler<
      (request: { method: string; params: { name: string; arguments?: Record<string, unknown> } }) => Promise<any>
    >(server, 'tools/call');

    const result = await callToolHandler({
      method: 'tools/call',
      params: {
        name: 'list_tools',
        arguments: {
          capability: 'status',
        },
      },
    });
    const parsed = JSON.parse(String(result.content[0].text));

    expect(parsed.servers).toHaveLength(1);
    expect(parsed.servers[0].server).toBe('beta');
  });
});
