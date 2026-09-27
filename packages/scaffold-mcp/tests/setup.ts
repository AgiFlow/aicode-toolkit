import { beforeEach, vi } from 'vitest';

// Mock the v2 server for isolated unit tests; integration tests use the real SDK.
vi.mock('@modelcontextprotocol/server', () => {
  class MockServer {
    public name: string;
    public version: string;
    public requestHandlers: Map<any, (...args: unknown[]) => unknown>;

    constructor(info: any, _options?: any) {
      this.name = info.name;
      this.version = info.version;
      this.requestHandlers = new Map();
    }

    setRequestHandler(schema: any, handler: (...args: unknown[]) => unknown) {
      this.requestHandlers.set(schema, handler);
    }

    connect = vi.fn();
  }

  return {
    Server: MockServer,
  };
});

// Global test setup
beforeEach(() => {
  vi.clearAllMocks();
});
