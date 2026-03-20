import { beforeEach, describe, expect, it, vi } from 'vitest';
import { McpClientManagerService } from '../../src/services/McpClientManagerService';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { McpServerConfig } from '../../src/types';

// Track all created mock client instances
let mockClientInstances: Array<Record<string, ReturnType<typeof vi.fn>>> = [];

function createMockClientInstance(): Record<string, ReturnType<typeof vi.fn>> {
  const instance = {
    connect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn().mockResolvedValue({ tools: [{ name: 'test_tool' }] }),
    callTool: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] }),
    listResources: vi.fn().mockResolvedValue({ resources: [] }),
    listPrompts: vi.fn().mockResolvedValue({ prompts: [] }),
    readResource: vi.fn().mockResolvedValue({ contents: [] }),
    getPrompt: vi.fn().mockResolvedValue({ messages: [] }),
    getInstructions: vi.fn().mockReturnValue(undefined),
  };
  mockClientInstances.push(instance);
  return instance;
}

// Mock the SDK transports
vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: class MockHTTPTransport {
    constructor() {}
  },
}));
vi.mock('@modelcontextprotocol/sdk/client/sse.js', () => ({
  SSEClientTransport: class MockSSETransport {
    constructor() {}
  },
}));
vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: class MockStdioTransport {
    constructor() {}
  },
}));

// Mock the Client class as a proper constructor
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: class MockClient {
    [key: string]: ReturnType<typeof vi.fn> | undefined;
    constructor() {
      const instance = createMockClientInstance();
      Object.assign(this, instance);
    }
  },
}));

const httpConfig: McpServerConfig = {
  name: 'http-server',
  transport: 'http',
  config: { url: 'http://localhost:3000/mcp' },
};

const stdioConfig: McpServerConfig = {
  name: 'stdio-server',
  transport: 'stdio',
  config: { command: 'node', args: ['server.js'] },
};

describe('McpClientManagerService', () => {
  let service: McpClientManagerService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClientInstances = [];
    service = new McpClientManagerService();
  });

  describe('session retry on HTTP transport', () => {
    it('should reconnect and retry when callTool gets a session error', async () => {
      await service.connectToServer('http-server', httpConfig);

      const client = service.getClient('http-server');
      expect(client).toBeDefined();
      if (!client) return;

      expect(mockClientInstances).toHaveLength(1);
      const firstInstance = mockClientInstances[0];

      // Make callTool fail with a session error on the first client
      firstInstance.callTool.mockRejectedValueOnce(
        new Error(
          'Streamable HTTP error: Error POSTing to endpoint: {"jsonrpc":"2.0","error":{"code":-32000,"message":"Bad Request: unknown session ID \'abc123\'."},"id":null}',
        ),
      );

      // The retry after reconnection should succeed
      const result = await client.callTool('test_tool', {});
      expect(result).toBeDefined();

      // Should have created a second Client for the reconnection
      expect(mockClientInstances).toHaveLength(2);
    });

    it('should reconnect and retry when listTools gets a session error', async () => {
      await service.connectToServer('http-server', httpConfig);

      const client = service.getClient('http-server');
      expect(client).toBeDefined();
      if (!client) return;

      const firstInstance = mockClientInstances[0];
      firstInstance.listTools.mockRejectedValueOnce(
        new Error('Bad Request: unknown session ID'),
      );

      const tools = await client.listTools();
      expect(tools).toBeDefined();
      expect(mockClientInstances).toHaveLength(2);
    });

    it('should not retry on non-session errors', async () => {
      await service.connectToServer('http-server', httpConfig);

      const client = service.getClient('http-server');
      expect(client).toBeDefined();
      if (!client) return;

      const firstInstance = mockClientInstances[0];
      firstInstance.callTool.mockRejectedValue(new Error('Network timeout'));

      await expect(client.callTool('test_tool', {})).rejects.toThrow('Network timeout');
      // Should NOT have created a second Client
      expect(mockClientInstances).toHaveLength(1);
    });

    it('should not set up reconnect for stdio transport', async () => {
      await service.connectToServer('stdio-server', stdioConfig);

      const client = service.getClient('stdio-server');
      expect(client).toBeDefined();
      if (!client) return;

      const firstInstance = mockClientInstances[0];
      firstInstance.callTool.mockRejectedValue(
        new Error('Bad Request: unknown session ID'),
      );

      // Should throw without retrying since stdio has no reconnect
      await expect(client.callTool('test_tool', {})).rejects.toThrow('unknown session');
      expect(mockClientInstances).toHaveLength(1);
    });
  });
});
