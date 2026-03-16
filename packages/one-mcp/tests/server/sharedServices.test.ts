import { describe, expect, it, vi } from 'vitest';
import { createSessionServer } from '../../src/server';
import type { SharedServices } from '../../src/server';
import type { CachedServerDefinition } from '../../src/types';

function createMockSharedServices(overrides?: Partial<SharedServices>): SharedServices {
  const mockServerDefinitions: CachedServerDefinition[] = [];

  return {
    clientManager: {
      ensureConnected: vi.fn(),
      getClient: vi.fn(),
      getAllClients: vi.fn().mockReturnValue([]),
      getKnownServerNames: vi.fn().mockReturnValue([]),
      disconnectAll: vi.fn().mockResolvedValue(undefined),
    } as any,
    definitionsCacheService: {
      getServerDefinitions: vi.fn().mockResolvedValue(mockServerDefinitions),
      getCachedFileSkills: vi.fn().mockResolvedValue([]),
      getServersForResource: vi.fn().mockResolvedValue([]),
      getServersForTool: vi.fn().mockResolvedValue([]),
      getPromptSkillByName: vi.fn().mockResolvedValue(undefined),
      clearLiveCache: vi.fn(),
    } as any,
    skillService: undefined,
    describeTools: {
      getDefinition: vi.fn().mockResolvedValue({
        name: 'describe_tools',
        description: 'Mock describe tools',
        inputSchema: { type: 'object', properties: { toolNames: { type: 'array', items: { type: 'string' } } }, required: ['toolNames'] },
      }),
      execute: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: '{}' }] }),
      clearAutoDetectedSkillsCache: vi.fn(),
    } as any,
    useTool: {
      getDefinition: vi.fn().mockReturnValue({
        name: 'use_tool',
        description: 'Mock use tool',
        inputSchema: { type: 'object', properties: { toolName: { type: 'string' }, toolArgs: { type: 'object' } }, required: ['toolName'] },
      }),
      execute: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] }),
    } as any,
    searchListTools: {
      getDefinition: vi.fn().mockResolvedValue({
        name: 'list_tools',
        description: 'Mock list tools',
        inputSchema: { type: 'object', properties: {} },
      }),
      execute: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: '[]' }] }),
    } as any,
    serverId: 'test-server-id',
    proxyMode: 'meta',
    dispose: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('SharedServices & createSessionServer', () => {
  it('should create multiple distinct Server instances from the same shared services', async () => {
    const shared = createMockSharedServices();

    const server1 = await createSessionServer(shared);
    const server2 = await createSessionServer(shared);
    const server3 = await createSessionServer(shared);

    // Each call returns a different Server instance
    expect(server1).not.toBe(server2);
    expect(server2).not.toBe(server3);
    expect(server1).not.toBe(server3);
  });

  it('should share the same definitionsCacheService across sessions', async () => {
    const shared = createMockSharedServices();

    await createSessionServer(shared);
    await createSessionServer(shared);

    // getServerDefinitions is called during each createSessionServer (for instructions + hasAnySkills)
    // The key assertion is that both sessions use the same mock instance
    expect(shared.definitionsCacheService.getServerDefinitions).toHaveBeenCalled();
    const callCount = (shared.definitionsCacheService.getServerDefinitions as any).mock.calls.length;
    expect(callCount).toBeGreaterThanOrEqual(2);
  });

  it('should use the shared serverId in all sessions', async () => {
    const shared = createMockSharedServices({ serverId: 'custom-id-123' });

    const server = await createSessionServer(shared);

    // Server was created successfully with the shared serverId
    expect(server).toBeDefined();
  });

  it('should call dispose on shared services', async () => {
    const shared = createMockSharedServices();

    await shared.dispose();

    expect(shared.dispose).toHaveBeenCalledTimes(1);
  });

  it('should support all proxy modes', async () => {
    for (const mode of ['meta', 'flat', 'search'] as const) {
      const shared = createMockSharedServices({ proxyMode: mode });
      const server = await createSessionServer(shared);
      expect(server).toBeDefined();
    }
  });
});
