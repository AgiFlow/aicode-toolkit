import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rm, mkdtemp, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DefinitionsCacheService } from '../../src/services/DefinitionsCacheService';
import type { DefinitionsCacheFile, McpClientConnection, Skill } from '../../src/types';
import type { McpClientManagerService } from '../../src/services/McpClientManagerService';
import type { SkillService } from '../../src/services/SkillService';

function createMockClient(serverName: string): McpClientConnection {
  return {
    serverName,
    serverInstruction: `${serverName} instruction`,
    prompts: {
      configured_prompt: {
        skill: {
          name: 'configured-skill',
          description: 'Configured skill description',
        },
      },
    },
    transport: 'stdio',
    listTools: vi.fn().mockResolvedValue([
      {
        name: 'tool_one',
        description: 'Tool one description',
        inputSchema: { type: 'object', properties: {} },
        _meta: {
          'agiflowai/capabilities': ['search', 'documentation'],
        },
      },
    ]),
    listResources: vi.fn().mockResolvedValue([]),
    listPrompts: vi.fn().mockResolvedValue([
      {
        name: 'configured_prompt',
        description: 'Configured prompt',
      },
      {
        name: 'auto_prompt',
        description: 'Auto prompt',
      },
    ]),
    callTool: vi.fn(),
    readResource: vi.fn(),
    getPrompt: vi.fn().mockImplementation(async (promptName: string) => ({
      messages: [
        {
          content:
            promptName === 'auto_prompt'
              ? '---\nname: auto-skill\ndescription: Auto detected skill\n---\nUse this skill'
              : 'Configured prompt body',
        },
      ],
    })),
    close: vi.fn(),
  };
}

function createMockSkill(name: string, description: string): Skill {
  return {
    name,
    description,
    content: `# ${name}`,
    location: 'project',
    basePath: `/skills/${name}`,
  };
}

describe('DefinitionsCacheService', () => {
  let tempDir: string;
  let mockClientManager: McpClientManagerService;
  let mockSkillService: SkillService;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'one-mcp-definitions-'));
    mockClientManager = {
      getAllClients: vi.fn().mockReturnValue([createMockClient('server-a')]),
      getKnownServerNames: vi.fn().mockReturnValue(['server-a']),
    } as unknown as McpClientManagerService;
    mockSkillService = {
      getSkills: vi.fn().mockResolvedValue([createMockSkill('local-skill', 'Local skill')]),
    } as unknown as SkillService;
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('collects tools, prompts, and prompt skills for cache generation', async () => {
    const service = new DefinitionsCacheService(mockClientManager, mockSkillService);
    const cache = await service.collectForCache({
      configPath: '/tmp/mcp-config.yaml',
      serverId: 'server-id',
    });

    expect(cache.serverId).toBe('server-id');
    expect(cache.configPath).toBe('/tmp/mcp-config.yaml');
    expect(cache.skills).toEqual([
      {
        name: 'local-skill',
        description: 'Local skill',
        location: 'project',
        basePath: '/skills/local-skill',
      },
    ]);
    expect(cache.servers['server-a'].tools).toHaveLength(1);
    expect(cache.servers['server-a'].tools[0]._meta).toEqual({
      'agiflowai/capabilities': ['search', 'documentation'],
    });
    expect(cache.servers['server-a'].resources).toEqual([]);
    expect(cache.servers['server-a'].prompts).toHaveLength(2);
    expect(cache.servers['server-a'].promptSkills).toEqual([
      {
        promptName: 'configured_prompt',
        skill: {
          name: 'configured-skill',
          description: 'Configured skill description',
        },
      },
      {
        promptName: 'auto_prompt',
        skill: {
          name: 'auto-skill',
          description: 'Auto detected skill',
        },
        autoDetected: true,
      },
    ]);
  });

  it('writes and reads JSON cache files', async () => {
    const cachePath = join(tempDir, 'definitions.json');
    const cache: DefinitionsCacheFile = {
      version: 1,
      generatedAt: new Date().toISOString(),
      configPath: '/tmp/mcp-config.yaml',
      serverId: 'server-id',
      servers: {
        'server-a': {
          serverName: 'server-a',
          tools: [],
          resources: [],
          prompts: [],
          promptSkills: [],
        },
      },
      skills: [],
      failures: [],
    };

    await DefinitionsCacheService.writeToFile(cachePath, cache);
    const loaded = await DefinitionsCacheService.readFromFile(cachePath);

    expect(loaded).toEqual(cache);
  });

  it('defaults missing optional cache skill fields to empty arrays', async () => {
    const cachePath = join(tempDir, 'legacy-definitions.json');
    await DefinitionsCacheService.writeToFile(cachePath, {
      version: 1,
      generatedAt: new Date().toISOString(),
      servers: {
        'server-a': {
          serverName: 'server-a',
          tools: [],
          resources: [],
          prompts: [],
          promptSkills: [],
        },
      },
      skills: [],
      failures: [],
    });

    const rawContent = JSON.stringify({
      version: 1,
      generatedAt: new Date().toISOString(),
      servers: {
        'server-a': {
          serverName: 'server-a',
        },
      },
    });

    await rm(cachePath, { force: true });
    await writeFile(cachePath, rawContent, 'utf-8');

    const loaded = await DefinitionsCacheService.readFromFile(cachePath);

    expect(loaded.skills).toEqual([]);
    expect(loaded.failures).toEqual([]);
    expect(loaded.servers['server-a'].tools).toEqual([]);
    expect(loaded.servers['server-a'].resources).toEqual([]);
    expect(loaded.servers['server-a'].prompts).toEqual([]);
    expect(loaded.servers['server-a'].promptSkills).toEqual([]);
  });

  it('uses cached definitions without re-listing live tools', async () => {
    const client = createMockClient('server-a');
    const cache: DefinitionsCacheFile = {
      version: 1,
      generatedAt: new Date().toISOString(),
      servers: {
        'server-a': {
          serverName: 'server-a',
          serverInstruction: 'cached instruction',
          tools: [
            {
              name: 'cached_tool',
              description: 'Cached tool description',
              inputSchema: { type: 'object', properties: {} },
            },
          ],
          resources: [],
          prompts: [],
          promptSkills: [],
        },
      },
      skills: [],
      failures: [],
    };

    const clientManager = {
      getAllClients: vi.fn().mockReturnValue([client]),
      getKnownServerNames: vi.fn().mockReturnValue(['server-a']),
    } as unknown as McpClientManagerService;

    const service = new DefinitionsCacheService(clientManager, undefined, { cacheData: cache });
    const serverDefinitions = await service.getServerDefinitions();

    expect(serverDefinitions[0].tools[0].name).toBe('cached_tool');
    expect(client.listTools).not.toHaveBeenCalled();
    expect(client.listPrompts).not.toHaveBeenCalled();
  });

  it('finds matching servers for cached resources', async () => {
    const cache: DefinitionsCacheFile = {
      version: 1,
      generatedAt: new Date().toISOString(),
      servers: {
        'server-a': {
          serverName: 'server-a',
          tools: [],
          resources: [
            {
              uri: 'file:///tmp/example.txt',
              name: 'example.txt',
            },
          ],
          prompts: [],
          promptSkills: [],
        },
      },
      skills: [],
      failures: [],
    };

    const service = new DefinitionsCacheService(mockClientManager, undefined, { cacheData: cache });

    await expect(service.getServersForResource('file:///tmp/example.txt')).resolves.toEqual([
      'server-a',
    ]);
  });

  it('derives a home-directory cache path from the sanitized absolute config path', () => {
    expect(
      DefinitionsCacheService.getDefaultCachePath('/tmp/project/mcp-config.yaml'),
    ).toBe(
      join(
        homedir(),
        '.aicode-toolkit',
        'tmp_project_mcp-config.yaml.definitions-cache.json',
      ),
    );
  });

  it('validates cache metadata', () => {

    expect(
      DefinitionsCacheService.isCacheValid(
        {
          version: 1,
          generatedAt: new Date().toISOString(),
          configHash: 'abc',
          oneMcpVersion: '1.0.0',
          servers: {},
          skills: [],
          failures: [],
        },
        { configHash: 'abc', oneMcpVersion: '1.0.0' },
      ),
    ).toBe(true);

    expect(
      DefinitionsCacheService.isCacheValid(
        {
          version: 1,
          generatedAt: new Date().toISOString(),
          configHash: 'abc',
          oneMcpVersion: '1.0.0',
          servers: {},
          skills: [],
          failures: [],
        },
        { configHash: 'xyz', oneMcpVersion: '1.0.0' },
      ),
    ).toBe(false);
  });
});
