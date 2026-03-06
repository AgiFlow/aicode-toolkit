import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listPromptsCommand } from '../../src/commands';
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
  McpClientManagerService: vi.fn().mockImplementation(function() {
    const client = {
      serverName: 'alpha',
      listPrompts: vi.fn().mockResolvedValue([
        {
          name: 'scaffold-feature',
          description: 'Scaffold a feature',
          arguments: [{ name: 'projectPath', required: true }],
        },
      ]),
    };

    return {
      connectToServer: vi.fn().mockResolvedValue(undefined),
      getAllClients: vi.fn().mockReturnValue([client]),
      getClient: vi.fn().mockReturnValue(client),
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

describe('ListPromptsCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should have correct name', () => {
    expect(listPromptsCommand.name()).toBe('list-prompts');
  });

  it('should output prompts as JSON', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await listPromptsCommand.parseAsync(['node', 'cli', '--json']);

    const raw = consoleSpy.mock.calls[0]?.[0];
    const parsed = JSON.parse(String(raw));
    expect(parsed.alpha[0].name).toBe('scaffold-feature');
  });

  it('should exit with code 1 when no config file is found', async () => {
    vi.mocked(findConfigFile).mockReturnValue(null);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((): never => {
      throw new Error('process.exit called');
    });

    await expect(listPromptsCommand.parseAsync(['node', 'cli'])).rejects.toThrow();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
