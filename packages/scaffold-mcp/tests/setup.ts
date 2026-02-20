import { beforeEach, vi } from 'vitest';

// Mock @modelcontextprotocol/sdk
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => {
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

vi.mock('@modelcontextprotocol/sdk/types.js', () => ({
  CallToolRequestSchema: {},
  ListToolsRequestSchema: {},
  ListPromptsRequestSchema: {},
  GetPromptRequestSchema: {},
}));

// Global test setup
beforeEach(() => {
  vi.clearAllMocks();
});
