/**
 * ReadResource Command Tests
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
import type { Option } from 'commander';
import { readResourceCommand } from '../../src/commands';
import { findConfigFile } from '../../src/utils';

interface MockResourceContent {
  uri: string;
  text: string;
  mimeType: string;
}

interface MockReadResult {
  contents: MockResourceContent[];
}

interface ResourceReference {
  uri: string;
}

interface MockClient {
  serverName: string;
  listResources: () => Promise<ResourceReference[]>;
  readResource: (uri: string) => Promise<MockReadResult>;
}

const MOCK_URI = 'file:///readme.md';
const MOCK_CONTENT: MockResourceContent = {
  uri: MOCK_URI,
  text: '# README content',
  mimeType: 'text/markdown',
};
const MOCK_READ_RESULT: MockReadResult = { contents: [MOCK_CONTENT] };

vi.mock('../../src/services', (): Record<string, unknown> => ({
  ConfigFetcherService: vi.fn<() => Record<string, unknown>>().mockImplementation(function(): Record<string, unknown> {
    return {
      fetchConfiguration: vi.fn<() => Promise<Record<string, unknown>>>().mockResolvedValue({
        mcpServers: {
          'test-server': { transport: 'http', config: { url: 'http://localhost:3000' } },
        },
      }),
    };
  }),
  McpClientManagerService: vi.fn<() => Record<string, unknown>>().mockImplementation(function(): Record<string, unknown> {
    return {
      connectToServer: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      getAllClients: vi.fn<() => MockClient[]>().mockReturnValue([
        {
          serverName: 'test-server',
          listResources: vi.fn<() => Promise<ResourceReference[]>>().mockResolvedValue([
            { uri: MOCK_URI },
          ]),
          readResource: vi.fn<() => Promise<MockReadResult>>().mockResolvedValue(MOCK_READ_RESULT),
        } satisfies MockClient,
      ]),
      getClient: vi.fn<(name: string) => MockClient | undefined>().mockImplementation(
        (name: string): MockClient | undefined => {
          if (name === 'test-server') {
            return {
              serverName: 'test-server',
              listResources: vi.fn<() => Promise<ResourceReference[]>>().mockResolvedValue([
                { uri: MOCK_URI },
              ]),
              readResource: vi.fn<() => Promise<MockReadResult>>().mockResolvedValue(MOCK_READ_RESULT),
            };
          }
          return undefined;
        },
      ),
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

describe('ReadResourceCommand', (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it('should have correct name', (): void => {
    expect(readResourceCommand.name()).toBe('read-resource');
  });

  it('should have correct description', (): void => {
    expect(readResourceCommand.description()).toBe(
      'Read a resource by URI from a connected MCP server',
    );
  });

  it('should define <uri> argument', (): void => {
    const args = readResourceCommand.registeredArguments;
    expect(args.length).toBeGreaterThan(0);
    expect(args[0]?.name()).toBe('uri');
  });

  it('should define --config option', (): void => {
    const option = readResourceCommand.options.find(
      (option: Option): boolean => option.long === '--config',
    );
    expect(option).toBeDefined();
  });

  it('should define --server option', (): void => {
    const option = readResourceCommand.options.find(
      (option: Option): boolean => option.long === '--server',
    );
    expect(option).toBeDefined();
  });

  it('should define --json option with default false', (): void => {
    const option = readResourceCommand.options.find(
      (option: Option): boolean => option.long === '--json',
    );
    expect(option).toBeDefined();
    expect(option?.defaultValue).toBe(false);
  });

  it('should output resource content as JSON when --json flag is set', async (): Promise<void> => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((): void => {});
    await readResourceCommand.parseAsync(['node', 'cli', '--json', MOCK_URI]);
    const raw = consoleSpy.mock.calls[0]?.[0];
    expect(isString(raw)).toBe(true);
    if (isString(raw)) {
      const parsed: unknown = JSON.parse(raw);
      expect(parsed).toMatchObject({ contents: [{ uri: MOCK_URI, text: MOCK_CONTENT.text }] });
    }
  });

  it('should read directly from specified server when --server is set', async (): Promise<void> => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((): void => {});
    await readResourceCommand.parseAsync([
      'node', 'cli', '--json', '--server', 'test-server', MOCK_URI,
    ]);
    const raw = consoleSpy.mock.calls[0]?.[0];
    expect(isString(raw)).toBe(true);
  });

  it('should exit with code 1 when no config file is found', async (): Promise<void> => {
    vi.mocked(findConfigFile).mockReturnValue(null);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((): never => {
      throw new Error('process.exit called');
    });
    await expect(
      readResourceCommand.parseAsync(['node', 'cli', MOCK_URI]),
    ).rejects.toThrow();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should exit with code 1 when resource is not found on any server', async (): Promise<void> => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((): never => {
      throw new Error('process.exit called');
    });
    await expect(
      readResourceCommand.parseAsync(['node', 'cli', 'file:///nonexistent.md']),
    ).rejects.toThrow();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
