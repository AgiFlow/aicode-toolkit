import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UseToolTool } from '../../src/tools/UseToolTool';
import { DefinitionsCacheService } from '../../src/services/DefinitionsCacheService';
import type { DefinitionsCacheFile, McpClientConnection } from '../../src/types';
import type { McpClientManagerService } from '../../src/services/McpClientManagerService';
import type { SkillService } from '../../src/services/SkillService';

function createMockClient(serverName: string): McpClientConnection {
  return {
    serverName,
    transport: 'stdio',
    listTools: vi.fn().mockResolvedValue([
      {
        name: 'live_tool',
        description: 'Live tool description',
        inputSchema: { type: 'object', properties: {} },
      },
    ]),
    listResources: vi.fn().mockResolvedValue([]),
    listPrompts: vi.fn().mockResolvedValue([]),
    callTool: vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'tool result' }],
    }),
    readResource: vi.fn(),
    getPrompt: vi.fn(),
    close: vi.fn(),
  };
}

describe('UseToolTool', () => {
  let mockClientManager: McpClientManagerService;
  let mockSkillService: SkillService;
  let connectedClient: McpClientConnection;

  beforeEach(() => {
    connectedClient = createMockClient('server-a');
    mockClientManager = {
      getKnownServerNames: vi.fn().mockReturnValue(['server-a']),
      ensureConnected: vi.fn().mockResolvedValue(connectedClient),
      getAllClients: vi.fn().mockReturnValue([]),
      getServerRequestTimeout: vi.fn().mockReturnValue(undefined),
    } as unknown as McpClientManagerService;
    mockSkillService = {
      getSkill: vi.fn(),
    } as unknown as SkillService;
  });

  it('routes unprefixed tool calls from cached definitions without live listTools fan-out', async () => {
    const cache: DefinitionsCacheFile = {
      version: 1,
      generatedAt: new Date().toISOString(),
      servers: {
        'server-a': {
          serverName: 'server-a',
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
    const definitionsCacheService = new DefinitionsCacheService(mockClientManager, undefined, {
      cacheData: cache,
    });
    const tool = new UseToolTool(
      mockClientManager,
      mockSkillService,
      undefined,
      definitionsCacheService,
    );

    const result = await tool.execute({
      toolName: 'cached_tool',
      toolArgs: { foo: 'bar' },
    });

    expect(mockClientManager.ensureConnected).toHaveBeenCalledWith('server-a');
    expect(connectedClient.callTool).toHaveBeenCalledWith('cached_tool', { foo: 'bar' }, undefined);
    expect(connectedClient.listTools).not.toHaveBeenCalled();
    expect(result.isError).toBeUndefined();
  });

  it('finds prompt-based skills from cached definitions', async () => {
    const cache: DefinitionsCacheFile = {
      version: 1,
      generatedAt: new Date().toISOString(),
      servers: {
        'server-a': {
          serverName: 'server-a',
          tools: [],
          resources: [],
          prompts: [],
          promptSkills: [
            {
              promptName: 'review_prompt',
              skill: {
                name: 'review-skill',
                description: 'Review code changes',
              },
            },
          ],
        },
      },
      skills: [],
      failures: [],
    };
    const definitionsCacheService = new DefinitionsCacheService(mockClientManager, undefined, {
      cacheData: cache,
    });
    const tool = new UseToolTool(
      mockClientManager,
      mockSkillService,
      undefined,
      definitionsCacheService,
    );

    const result = await tool.execute({ toolName: 'skill__review-skill' });

    expect(result.isError).toBeUndefined();
    expect(result.content[0]).toEqual({
      type: 'text',
      text: expect.stringContaining('review-skill'),
    });
  });
});
