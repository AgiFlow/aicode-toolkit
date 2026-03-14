import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mcpServeCommand } from '../../src/commands';

interface MockRegistry {
  mockCreateServer: ReturnType<typeof vi.fn>;
  mockFetchConfiguration: ReturnType<typeof vi.fn>;
  mockGenerateServerId: ReturnType<typeof vi.fn>;
  mockRuntimeStateWrite: ReturnType<typeof vi.fn>;
  mockRuntimeStateRemove: ReturnType<typeof vi.fn>;
  mockStdioConstructor: ReturnType<typeof vi.fn>;
  mockHttpConstructor: ReturnType<typeof vi.fn>;
  mockSseConstructor: ReturnType<typeof vi.fn>;
  mockStdioHttpConstructor: ReturnType<typeof vi.fn>;
  mockStdioStart: ReturnType<typeof vi.fn>;
  mockHttpStart: ReturnType<typeof vi.fn>;
  mockSseStart: ReturnType<typeof vi.fn>;
  mockStdioHttpStart: ReturnType<typeof vi.fn>;
  mockStdioStop: ReturnType<typeof vi.fn>;
  mockHttpStop: ReturnType<typeof vi.fn>;
  mockSseStop: ReturnType<typeof vi.fn>;
  mockStdioHttpStop: ReturnType<typeof vi.fn>;
}

interface EndpointLike {
  toString: () => string;
}

interface StdioHttpHandlerArgs {
  endpoint: EndpointLike;
}

interface MockTransportHandler {
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

interface MockConfigFetcherService {
  fetchConfiguration: ReturnType<typeof vi.fn>;
}

interface MockRuntimeStateService {
  write: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
}

function isStdioHttpHandlerArgs(value: unknown): value is StdioHttpHandlerArgs {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  if (!('endpoint' in value)) {
    return false;
  }

  const endpointValue = value.endpoint;
  if (typeof endpointValue !== 'object' || endpointValue === null) {
    return false;
  }

  if (!('toString' in endpointValue)) {
    return false;
  }

  return typeof endpointValue.toString === 'function';
}

const MOCKS = vi.hoisted((): MockRegistry => {
  const mockStdioStart = vi.fn().mockResolvedValue(undefined);
  const mockHttpStart = vi.fn().mockResolvedValue(undefined);
  const mockSseStart = vi.fn().mockResolvedValue(undefined);
  const mockStdioHttpStart = vi.fn().mockResolvedValue(undefined);
  const mockStdioStop = vi.fn().mockResolvedValue(undefined);
  const mockHttpStop = vi.fn().mockResolvedValue(undefined);
  const mockSseStop = vi.fn().mockResolvedValue(undefined);
  const mockStdioHttpStop = vi.fn().mockResolvedValue(undefined);

  const mockStdioConstructor = vi.fn().mockImplementation(function (): MockTransportHandler {
    return {
      start: mockStdioStart,
      stop: mockStdioStop,
    };
  });

  const mockHttpConstructor = vi.fn().mockImplementation(function (): MockTransportHandler {
    return {
      start: mockHttpStart,
      stop: mockHttpStop,
    };
  });

  const mockSseConstructor = vi.fn().mockImplementation(function (): MockTransportHandler {
    return {
      start: mockSseStart,
      stop: mockSseStop,
    };
  });

  const mockStdioHttpConstructor = vi.fn().mockImplementation(function (): MockTransportHandler {
    return {
      start: mockStdioHttpStart,
      stop: mockStdioHttpStop,
    };
  });

  return {
    mockCreateServer: vi.fn(),
    mockFetchConfiguration: vi.fn().mockResolvedValue({}),
    mockGenerateServerId: vi.fn((): string => 'generated-server-id'),
    mockRuntimeStateWrite: vi.fn().mockResolvedValue(undefined),
    mockRuntimeStateRemove: vi.fn().mockResolvedValue(undefined),
    mockStdioConstructor,
    mockHttpConstructor,
    mockSseConstructor,
    mockStdioHttpConstructor,
    mockStdioStart,
    mockHttpStart,
    mockSseStart,
    mockStdioHttpStart,
    mockStdioStop,
    mockHttpStop,
    mockSseStop,
    mockStdioHttpStop,
  };
});

vi.mock('../../src', (): Record<string, unknown> => ({
  createServer: MOCKS.mockCreateServer,
  ConfigFetcherService: vi.fn().mockImplementation(function (): MockConfigFetcherService {
    return {
      fetchConfiguration: MOCKS.mockFetchConfiguration,
    };
  }),
  generateServerId: MOCKS.mockGenerateServerId,
  RuntimeStateService: vi.fn().mockImplementation(function (): MockRuntimeStateService {
    return {
      write: MOCKS.mockRuntimeStateWrite,
      remove: MOCKS.mockRuntimeStateRemove,
    };
  }),
  TRANSPORT_MODE: {
    STDIO: 'stdio',
    HTTP: 'http',
    SSE: 'sse',
  },
  StdioTransportHandler: MOCKS.mockStdioConstructor,
  HttpTransportHandler: MOCKS.mockHttpConstructor,
  SseTransportHandler: MOCKS.mockSseConstructor,
  StdioHttpTransportHandler: MOCKS.mockStdioHttpConstructor,
}));

function createExitSpy(): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(process, 'exit').mockImplementation((_code?: string | number | null): never => {
    throw new Error('process.exit called');
  });
}

function createErrorSpy(): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(console, 'error').mockImplementation((): void => {});
}

describe('mcp-serve command', (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
    MOCKS.mockCreateServer.mockResolvedValue({ server: true });
    MOCKS.mockFetchConfiguration.mockResolvedValue({});
    MOCKS.mockGenerateServerId.mockReturnValue('generated-server-id');
    MOCKS.mockRuntimeStateWrite.mockResolvedValue(undefined);
    MOCKS.mockRuntimeStateRemove.mockResolvedValue(undefined);
    MOCKS.mockStdioStart.mockResolvedValue(undefined);
    MOCKS.mockHttpStart.mockResolvedValue(undefined);
    MOCKS.mockSseStart.mockResolvedValue(undefined);
    MOCKS.mockStdioHttpStart.mockResolvedValue(undefined);
    MOCKS.mockStdioStop.mockResolvedValue(undefined);
    MOCKS.mockHttpStop.mockResolvedValue(undefined);
    MOCKS.mockSseStop.mockResolvedValue(undefined);
    MOCKS.mockStdioHttpStop.mockResolvedValue(undefined);
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it('should default proxy mode to meta', async (): Promise<void> => {
    await mcpServeCommand.parseAsync(['node', 'cli']);

    expect(MOCKS.mockCreateServer).toHaveBeenCalledWith(
      expect.objectContaining({
        proxyMode: 'meta',
      }),
    );
  });

  it('should pass explicit search proxy mode to createServer', async (): Promise<void> => {
    await mcpServeCommand.parseAsync(['node', 'cli', '--proxy-mode', 'search']);

    expect(MOCKS.mockCreateServer).toHaveBeenCalledWith(
      expect.objectContaining({
        proxyMode: 'search',
      }),
    );
  });

  it('should reject invalid proxy modes', async (): Promise<void> => {
    const exitSpy = createExitSpy();
    const errorSpy = createErrorSpy();

    await expect(
      mcpServeCommand.parseAsync(['node', 'cli', '--proxy-mode', 'invalid']),
    ).rejects.toThrow('process.exit called');

    expect(errorSpy).toHaveBeenCalledWith(
      "Failed to start MCP server with transport 'stdio': Unknown proxy mode: 'invalid'. Valid options: meta, flat, search",
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(MOCKS.mockCreateServer).not.toHaveBeenCalled();
  });

  it('should reject invalid transport modes', async (): Promise<void> => {
    const exitSpy = createExitSpy();
    const errorSpy = createErrorSpy();

    await expect(
      mcpServeCommand.parseAsync(['node', 'cli', '--type', 'invalid']),
    ).rejects.toThrow('process.exit called');

    expect(errorSpy).toHaveBeenCalledWith(
      "Failed to start MCP server with transport 'stdio': Unknown transport type: 'invalid'. Valid options: stdio, http, sse, stdio-http",
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(MOCKS.mockCreateServer).not.toHaveBeenCalled();
  });

  it('should reuse existing http endpoint for stdio-http without starting internal http', async (): Promise<void> => {
    await mcpServeCommand.parseAsync(['node', 'cli', '--type', 'stdio-http', '--port', '3123']);

    expect(MOCKS.mockCreateServer).not.toHaveBeenCalled();
    expect(MOCKS.mockHttpConstructor).not.toHaveBeenCalled();

    const firstStdioHttpArg: unknown = MOCKS.mockStdioHttpConstructor.mock.calls[0]?.[0];
    if (!isStdioHttpHandlerArgs(firstStdioHttpArg)) {
      throw new Error('Expected stdio-http constructor to receive endpoint argument');
    }

    expect(firstStdioHttpArg.endpoint.toString()).toBe('http://localhost:3123/mcp');
    expect(MOCKS.mockStdioHttpStart).toHaveBeenCalledTimes(1);
    expect(MOCKS.mockHttpStart).not.toHaveBeenCalled();
  });

  it('should bootstrap internal http when stdio-http cannot connect initially', async (): Promise<void> => {
    MOCKS.mockStdioHttpStart
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
      .mockResolvedValueOnce(undefined);

    await mcpServeCommand.parseAsync(['node', 'cli', '--type', 'stdio-http', '--port', '3123']);

    expect(MOCKS.mockCreateServer).toHaveBeenCalledTimes(1);
    expect(MOCKS.mockHttpConstructor).toHaveBeenCalledTimes(1);
    expect(MOCKS.mockHttpStart).toHaveBeenCalledTimes(1);
    expect(MOCKS.mockStdioHttpStart).toHaveBeenCalledTimes(2);
  });

  it('should handle EADDRINUSE race by retrying stdio-http connect', async (): Promise<void> => {
    MOCKS.mockStdioHttpStart
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
      .mockResolvedValueOnce(undefined);
    MOCKS.mockHttpStart.mockRejectedValueOnce({ code: 'EADDRINUSE', message: 'address in use' });

    await mcpServeCommand.parseAsync(['node', 'cli', '--type', 'stdio-http', '--port', '3123']);

    expect(MOCKS.mockCreateServer).toHaveBeenCalledTimes(1);
    expect(MOCKS.mockHttpStart).toHaveBeenCalledTimes(1);
    expect(MOCKS.mockStdioHttpStart).toHaveBeenCalledTimes(2);
  });

  it('should stop only stdio proxy on shutdown when reusing existing http', async (): Promise<void> => {
    const exitSpy = createExitSpy();
    const onSpy = vi.spyOn(process, 'on');

    await mcpServeCommand.parseAsync(['node', 'cli', '--type', 'stdio-http', '--port', '3123']);

    const sigtermHandler = onSpy.mock.calls.find((args): boolean => args[0] === 'SIGTERM')?.[1];
    if (!sigtermHandler) {
      throw new Error('Expected SIGTERM handler to be registered');
    }

    await expect(sigtermHandler()).rejects.toThrow('process.exit called');

    expect(MOCKS.mockStdioHttpStop).toHaveBeenCalledTimes(1);
    expect(MOCKS.mockHttpStop).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should stop internal http on shutdown when this process bootstrapped it', async (): Promise<void> => {
    MOCKS.mockStdioHttpStart
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
      .mockResolvedValueOnce(undefined);

    const exitSpy = createExitSpy();
    const onSpy = vi.spyOn(process, 'on');

    await mcpServeCommand.parseAsync(['node', 'cli', '--type', 'stdio-http', '--port', '3123']);

    const sigtermHandler = onSpy.mock.calls.find((args): boolean => args[0] === 'SIGTERM')?.[1];
    if (!sigtermHandler) {
      throw new Error('Expected SIGTERM handler to be registered');
    }

    await expect(sigtermHandler()).rejects.toThrow('process.exit called');

    expect(MOCKS.mockStdioHttpStop).toHaveBeenCalledTimes(1);
    expect(MOCKS.mockHttpStop).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});
