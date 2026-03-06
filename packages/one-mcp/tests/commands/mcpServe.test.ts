import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockCreateServer: vi.fn(),
  mockStart: vi.fn().mockResolvedValue(undefined),
  mockStop: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/server', () => ({
  createServer: mocks.mockCreateServer,
}));

vi.mock('../../src/transports/stdio', () => ({
  StdioTransportHandler: vi.fn().mockImplementation(function() {
    return {
      start: mocks.mockStart,
      stop: mocks.mockStop,
    };
  }),
}));

vi.mock('../../src/transports/http', () => ({
  HttpTransportHandler: vi.fn().mockImplementation(function() {
    return {
      start: mocks.mockStart,
      stop: mocks.mockStop,
    };
  }),
}));

vi.mock('../../src/transports/sse', () => ({
  SseTransportHandler: vi.fn().mockImplementation(function() {
    return {
      start: mocks.mockStart,
      stop: mocks.mockStop,
    };
  }),
}));

vi.mock('../../src/utils', () => ({
  findConfigFile: vi.fn(() => '/mock/mcp-config.yaml'),
}));

import { mcpServeCommand } from '../../src/commands/mcp-serve';

describe('mcp-serve command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockCreateServer.mockResolvedValue({ server: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults proxy mode to meta', async () => {
    await mcpServeCommand.parseAsync(['node', 'cli']);

    expect(mocks.mockCreateServer).toHaveBeenCalledWith(
      expect.objectContaining({
        proxyMode: 'meta',
      }),
    );
  });

  it('passes explicit search proxy mode to createServer', async () => {
    await mcpServeCommand.parseAsync(['node', 'cli', '--proxy-mode', 'search']);

    expect(mocks.mockCreateServer).toHaveBeenCalledWith(
      expect.objectContaining({
        proxyMode: 'search',
      }),
    );
  });

  it('rejects invalid proxy modes', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((): never => {
      throw new Error('process.exit called');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      mcpServeCommand.parseAsync(['node', 'cli', '--proxy-mode', 'invalid']),
    ).rejects.toThrow('process.exit called');

    expect(errorSpy).toHaveBeenCalledWith(
      "Unknown proxy mode: 'invalid'. Valid options: meta, flat, search",
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
