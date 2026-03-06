import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { searchToolsCommand } from '../../src/commands';
import { findConfigFile } from '../../src/utils';

vi.mock('../../src/services', () => ({
  ConfigFetcherService: vi.fn().mockImplementation(function() {
    return {
      fetchConfiguration: vi.fn().mockResolvedValue({
        mcpServers: {
          alpha: { transport: 'http', config: { url: 'http://localhost:3000' } },
        },
      }),
    };
  }),
  DefinitionsCacheService: Object.assign(
    vi.fn().mockImplementation(function() {
      return {
        getServerDefinitions: vi.fn().mockResolvedValue([
          {
            serverName: 'alpha',
            serverInstruction: 'Review code and patterns',
            tools: [
              {
                name: 'review_code',
                description: 'Review code changes',
                inputSchema: { type: 'object', properties: {} },
                _meta: { 'agiflowai/capabilities': ['code-review'] },
              },
            ],
            resources: [],
            prompts: [],
            promptSkills: [],
          },
        ]),
      };
    }),
    {
      getDefaultCachePath: vi.fn().mockReturnValue('/mock/definitions-cache.json'),
      readFromFile: vi.fn().mockRejectedValue(new Error('missing cache')),
    },
  ),
  McpClientManagerService: vi.fn().mockImplementation(function() {
    return {
      registerServerConfigs: vi.fn(),
      connectToServer: vi.fn().mockResolvedValue(undefined),
      getAllClients: vi.fn().mockReturnValue([{ serverName: 'alpha' }]),
      disconnectAll: vi.fn().mockResolvedValue(undefined),
    };
  }),
}));

vi.mock('../../src/utils', async () => {
  const actual = await vi.importActual('../../src/utils');
  return {
    ...actual,
    findConfigFile: vi.fn().mockReturnValue('/mock/config.yaml'),
  };
});

describe('SearchToolsCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should have correct name', () => {
    expect(searchToolsCommand.name()).toBe('search-tools');
  });

  it('should output filtered tool search results as JSON', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await searchToolsCommand.parseAsync(['node', 'cli', '--json', '--capability', 'review']);

    const raw = consoleSpy.mock.calls[0]?.[0];
    const parsed = JSON.parse(String(raw));
    expect(parsed.servers).toHaveLength(1);
    expect(parsed.servers[0].tools[0].name).toBe('review_code');
    expect(parsed.servers[0].tools[0].capabilities).toEqual(['code-review']);
  });

  it('should exit with code 1 when no config file is found', async () => {
    vi.mocked(findConfigFile).mockReturnValue(null);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((): never => {
      throw new Error('process.exit called');
    });

    await expect(searchToolsCommand.parseAsync(['node', 'cli'])).rejects.toThrow();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
