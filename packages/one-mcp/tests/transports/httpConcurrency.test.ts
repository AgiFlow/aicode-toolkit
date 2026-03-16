import http from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpTransportHandler } from '../../src/transports/http';
import { createSessionServer } from '../../src/server';
import type { SharedServices } from '../../src/server';
import type { CachedServerDefinition } from '../../src/types';

/**
 * Helper: send a JSON-RPC request to the MCP HTTP endpoint.
 */
function mcpRequest(
  port: number,
  method: 'POST' | 'GET' | 'DELETE',
  body?: unknown,
  sessionId?: string,
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: unknown }> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    };
    if (sessionId) {
      headers['mcp-session-id'] = sessionId;
    }

    const payload = body ? JSON.stringify(body) : undefined;
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload).toString();
    }

    const req = http.request(
      { hostname: '127.0.0.1', port, path: '/mcp', method, headers },
      (res) => {
        let data = '';
        res.on('data', (chunk: string) => { data += chunk; });
        res.on('end', () => {
          let parsed: unknown;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body: parsed });
        });
      },
    );
    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

const INITIALIZE_REQUEST = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'test-client', version: '1.0.0' },
  },
};

const LIST_TOOLS_REQUEST = {
  jsonrpc: '2.0',
  id: 2,
  method: 'tools/list',
  params: {},
};

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

/**
 * Initialize a session against the test server, returns the session ID.
 */
async function initializeSession(port: number): Promise<string> {
  const res = await mcpRequest(port, 'POST', INITIALIZE_REQUEST);
  expect(res.status).toBe(200);
  const sessionId = res.headers['mcp-session-id'];
  expect(sessionId).toBeDefined();
  return sessionId as string;
}

// Use a unique port range to avoid conflicts with parallel test runs
let portCounter = 19100;
function getNextPort(): number {
  return portCounter++;
}

describe('HTTP Transport - Concurrent Sessions', () => {
  let handler: HttpTransportHandler;
  let port: number;
  let shared: SharedServices;

  beforeEach(() => {
    vi.clearAllMocks();
    port = getNextPort();
    shared = createMockSharedServices();
  });

  afterEach(async () => {
    try {
      await handler?.stop();
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should create separate server instances per session via factory', async () => {
    const factorySpy = vi.fn(async () => createSessionServer(shared));

    handler = new HttpTransportHandler(factorySpy, { mode: 'http', port, host: '127.0.0.1' });
    await handler.start();

    // Initialize 3 sessions concurrently
    const [s1, s2, s3] = await Promise.all([
      initializeSession(port),
      initializeSession(port),
      initializeSession(port),
    ]);

    // Factory called once per session
    expect(factorySpy).toHaveBeenCalledTimes(3);

    // All session IDs are unique
    const ids = new Set([s1, s2, s3]);
    expect(ids.size).toBe(3);
  });

  it('should return tools from shared services for all sessions', async () => {
    handler = new HttpTransportHandler(
      () => createSessionServer(shared),
      { mode: 'http', port, host: '127.0.0.1' },
    );
    await handler.start();

    const s1 = await initializeSession(port);
    const s2 = await initializeSession(port);

    // Both sessions should return the same tool list from shared definitionsCacheService
    const [res1, res2] = await Promise.all([
      mcpRequest(port, 'POST', LIST_TOOLS_REQUEST, s1),
      mcpRequest(port, 'POST', LIST_TOOLS_REQUEST, s2),
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    // Both should have called the same shared definitionsCacheService
    expect(shared.definitionsCacheService.getServerDefinitions).toHaveBeenCalled();
  });

  it('should handle session deletion without affecting other sessions', async () => {
    handler = new HttpTransportHandler(
      () => createSessionServer(shared),
      { mode: 'http', port, host: '127.0.0.1' },
    );
    await handler.start();

    const sessionA = await initializeSession(port);
    const sessionB = await initializeSession(port);

    // Delete session A
    const deleteRes = await mcpRequest(port, 'DELETE', undefined, sessionA);
    expect(deleteRes.status).toBe(200);

    // Session B still works
    const resB = await mcpRequest(port, 'POST', LIST_TOOLS_REQUEST, sessionB);
    expect(resB.status).toBe(200);

    // Session A returns 400 (unknown session)
    const resA = await mcpRequest(port, 'POST', LIST_TOOLS_REQUEST, sessionA);
    expect(resA.status).toBe(400);
  });

  it('should clean up all sessions on stop', async () => {
    handler = new HttpTransportHandler(
      () => createSessionServer(shared),
      { mode: 'http', port, host: '127.0.0.1' },
    );
    await handler.start();

    await initializeSession(port);
    await initializeSession(port);

    // Stop should not throw
    await handler.stop();

    // Further requests should fail (server closed)
    await expect(mcpRequest(port, 'POST', INITIALIZE_REQUEST)).rejects.toThrow();
  });

  it('should handle 20 concurrent initializations', async () => {
    const factorySpy = vi.fn(async () => createSessionServer(shared));

    handler = new HttpTransportHandler(factorySpy, { mode: 'http', port, host: '127.0.0.1' });
    await handler.start();

    // Initialize 20 sessions concurrently
    const sessionIds = await Promise.all(
      Array.from({ length: 20 }, () => initializeSession(port)),
    );

    // All 20 should succeed with unique IDs
    expect(factorySpy).toHaveBeenCalledTimes(20);
    const uniqueIds = new Set(sessionIds);
    expect(uniqueIds.size).toBe(20);
  });

  it('should reject requests with unknown session ID', async () => {
    handler = new HttpTransportHandler(
      () => createSessionServer(shared),
      { mode: 'http', port, host: '127.0.0.1' },
    );
    await handler.start();

    const res = await mcpRequest(port, 'POST', LIST_TOOLS_REQUEST, 'non-existent-session-id');
    expect(res.status).toBe(400);
  });

  it('should reject non-initialize POST without session ID', async () => {
    handler = new HttpTransportHandler(
      () => createSessionServer(shared),
      { mode: 'http', port, host: '127.0.0.1' },
    );
    await handler.start();

    const res = await mcpRequest(port, 'POST', LIST_TOOLS_REQUEST);
    expect(res.status).toBe(400);
  });
});
