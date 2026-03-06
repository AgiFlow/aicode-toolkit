import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPromptCommand } from '../../src/commands';
import { findConfigFile } from '../../src/utils';

const mockClient = {
  serverName: 'alpha',
  listPrompts: vi.fn().mockResolvedValue([{ name: 'scaffold-feature' }]),
  getPrompt: vi.fn().mockResolvedValue({
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: 'Build a feature scaffold',
        },
      },
    ],
  }),
};

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
    return {
      connectToServer: vi.fn().mockResolvedValue(undefined),
      getAllClients: vi.fn().mockReturnValue([mockClient]),
      getClient: vi.fn().mockReturnValue(mockClient),
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

describe('GetPromptCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should have correct name', () => {
    expect(getPromptCommand.name()).toBe('get-prompt');
  });

  it('should output prompt as JSON', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await getPromptCommand.parseAsync(['node', 'cli', '--json', 'scaffold-feature']);

    const raw = consoleSpy.mock.calls[0]?.[0];
    const parsed = JSON.parse(String(raw));
    expect(parsed.messages[0].content.text).toBe('Build a feature scaffold');
  });

  it('should exit with code 1 when prompt is missing', async () => {
    mockClient.listPrompts.mockResolvedValueOnce([]);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((): never => {
      throw new Error('process.exit called');
    });

    await expect(getPromptCommand.parseAsync(['node', 'cli', 'missing-prompt'])).rejects.toThrow();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should exit with code 1 when no config file is found', async () => {
    vi.mocked(findConfigFile).mockReturnValue(null);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((): never => {
      throw new Error('process.exit called');
    });

    await expect(getPromptCommand.parseAsync(['node', 'cli', 'scaffold-feature'])).rejects.toThrow();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
