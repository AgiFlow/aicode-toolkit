import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DefinitionsCacheService } from '../../src/services/DefinitionsCacheService';
import { SearchListToolsTool } from '../../src/tools/SearchListToolsTool';
import type { DefinitionsCacheFile } from '../../src/types';
import type { McpClientManagerService } from '../../src/services/McpClientManagerService';

describe('SearchListToolsTool', () => {
  let mockClientManager: McpClientManagerService;
  let cache: DefinitionsCacheFile;

  beforeEach(() => {
    mockClientManager = {
      getKnownServerNames: vi.fn().mockReturnValue(['alpha', 'beta']),
      getAllClients: vi.fn().mockReturnValue([]),
    } as unknown as McpClientManagerService;

    cache = {
      version: 1,
      generatedAt: new Date().toISOString(),
      servers: {
        alpha: {
          serverName: 'alpha',
          serverInstruction: 'Search documentation and references',
          tools: [
            {
              name: 'search_docs',
              description: 'Search docs',
              inputSchema: { type: 'object', properties: {} },
            },
          ],
          resources: [],
          prompts: [],
          promptSkills: [],
        },
        beta: {
          serverName: 'beta',
          serverInstruction: 'Review code and inspect diffs',
          tools: [
            {
              name: 'search_docs',
              description: 'Search code notes',
              inputSchema: { type: 'object', properties: {} },
            },
            {
              name: 'review_code',
              description: 'Review code changes',
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
  });

  it('lists all tools with prefixed names only for clashes', async () => {
    const definitions = new DefinitionsCacheService(mockClientManager, undefined, {
      cacheData: cache,
    });
    const tool = new SearchListToolsTool(mockClientManager, definitions);

    const result = await tool.execute({});
    const parsed = JSON.parse(String(result.content[0].text));

    expect(parsed.servers).toHaveLength(2);
    expect(parsed.servers[0].tools[0].name).toBe('alpha__search_docs');
    expect(parsed.servers[1].tools[0].name).toBe('beta__search_docs');
    expect(parsed.servers[1].tools[1].name).toBe('review_code');
  });

  it('filters by capability summary', async () => {
    const definitions = new DefinitionsCacheService(mockClientManager, undefined, {
      cacheData: cache,
    });
    const tool = new SearchListToolsTool(mockClientManager, definitions);

    const result = await tool.execute({ capability: 'review' });
    const parsed = JSON.parse(String(result.content[0].text));

    expect(parsed.servers).toHaveLength(1);
    expect(parsed.servers[0].server).toBe('beta');
  });

  it('filters by server name', async () => {
    const definitions = new DefinitionsCacheService(mockClientManager, undefined, {
      cacheData: cache,
    });
    const tool = new SearchListToolsTool(mockClientManager, definitions);

    const result = await tool.execute({ serverName: 'alpha' });
    const parsed = JSON.parse(String(result.content[0].text));

    expect(parsed.servers).toHaveLength(1);
    expect(parsed.servers[0].server).toBe('alpha');
  });

  it('returns an error result when nothing matches the filter', async () => {
    const definitions = new DefinitionsCacheService(mockClientManager, undefined, {
      cacheData: cache,
    });
    const tool = new SearchListToolsTool(mockClientManager, definitions);

    const result = await tool.execute({ capability: 'nonexistent' });
    const parsed = JSON.parse(String(result.content[0].text));

    expect(result.isError).toBe(true);
    expect(parsed.servers).toEqual([]);
  });
});
