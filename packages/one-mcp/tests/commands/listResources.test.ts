/**
 * ListResources Command Tests
 *
 * TESTING PATTERNS:
 * - Test command metadata (name, description)
 * - Test option parsing and defaults
 * - Mock external dependencies
 *
 * CODING STANDARDS:
 * - Use descriptive test names (should...)
 * - Test both success and error paths
 * - Mock console output for verification
 *
 * AVOID:
 * - Testing implementation details
 * - Not mocking external dependencies
 * - Missing error case tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { listResourcesCommand } from '../../src/commands';
import { findConfigFile } from '../../src/utils';

interface MockResource {
  uri: string;
  name: string;
  description: string;
}

interface MockServerOutput {
  [serverName: string]: MockResource[];
}

interface MockClient {
  serverName: string;
  listResources: () => Promise<MockResource[]>;
}

const MOCK_RESOURCE: MockResource = {
  uri: 'file:///readme.md',
  name: 'README',
  description: 'Project readme',
};

vi.mock('../../src/services', (): Record<string, unknown> => ({
  ConfigFetcherService: vi.fn().mockImplementation(function(): Record<string, unknown> {
    return {
      fetchConfiguration: vi.fn<() => Promise<Record<string, unknown>>>().mockResolvedValue({
        mcpServers: {
          'test-server': { transport: 'http', config: { url: 'http://localhost:3000' } },
        },
      }),
    };
  }),
  McpClientManagerService: vi.fn().mockImplementation(function(): Record<string, unknown> {
    return {
      connectToServer: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      getAllClients: vi.fn<() => MockClient[]>().mockReturnValue([
        {
          serverName: 'test-server',
          listResources: vi.fn<() => Promise<MockResource[]>>().mockResolvedValue([MOCK_RESOURCE]),
        } satisfies MockClient,
      ]),
      getClient: vi.fn<() => undefined>().mockReturnValue(undefined),
      disconnectAll: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    };
  }),
}));

vi.mock('../../src/utils', (): Record<string, unknown> => ({
  findConfigFile: vi.fn<() => string | null>().mockReturnValue('/mock/config.yaml'),
}));

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isMockServerOutput(value: unknown): value is MockServerOutput {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.values(value).every((entry: unknown): boolean => Array.isArray(entry))
  );
}

describe('ListResourcesCommand', (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it('should have correct name', (): void => {
    expect(listResourcesCommand.name()).toBe('list-resources');
  });

  it('should have correct description', (): void => {
    expect(listResourcesCommand.description()).toBe(
      'List all available resources from connected MCP servers',
    );
  });

  it('should define --config option', (): void => {
    const option = listResourcesCommand.options.find(
      (option): boolean => option.long === '--config',
    );
    expect(option).toBeDefined();
  });

  it('should define --server option', (): void => {
    const option = listResourcesCommand.options.find(
      (option): boolean => option.long === '--server',
    );
    expect(option).toBeDefined();
  });

  it('should define --json option with default false', (): void => {
    const option = listResourcesCommand.options.find(
      (option): boolean => option.long === '--json',
    );
    expect(option).toBeDefined();
    expect(option?.defaultValue).toBe(false);
  });

  it('should output resources as JSON with full resource structure', async (): Promise<void> => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((): void => {});
    await listResourcesCommand.parseAsync(['node', 'cli', '--json']);
    const raw = consoleSpy.mock.calls[0]?.[0];
    expect(isString(raw)).toBe(true);
    if (isString(raw)) {
      const parsed: unknown = JSON.parse(raw);
      expect(isMockServerOutput(parsed)).toBe(true);
      if (isMockServerOutput(parsed)) {
        const resources = parsed['test-server'];
        expect(resources).toBeDefined();
        expect(resources?.[0]?.uri).toBe(MOCK_RESOURCE.uri);
        expect(resources?.[0]?.name).toBe(MOCK_RESOURCE.name);
        expect(resources?.[0]?.description).toBe(MOCK_RESOURCE.description);
      }
    }
  });

  it('should exit with code 1 when no config file is found', async (): Promise<void> => {
    vi.mocked(findConfigFile).mockReturnValue(null);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((): never => {
      throw new Error('process.exit called');
    });
    await expect(listResourcesCommand.parseAsync(['node', 'cli'])).rejects.toThrow();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should exit with code 1 when specified server is not connected', async (): Promise<void> => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((): never => {
      throw new Error('process.exit called');
    });
    await expect(
      listResourcesCommand.parseAsync(['node', 'cli', '--server', 'unknown-server']),
    ).rejects.toThrow();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
