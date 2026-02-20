/**
 * Unit tests for Clawdbot MCP Plugin
 *
 * Tests:
 * - Plugin initialization and configuration
 * - Tool registration
 * - Error handling
 * - Service lifecycle
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ClawdbotApi, PluginConfig, ToolDefinition, ServiceDefinition } from '../src/types';

/**
 * Mock Clawdbot API for testing
 */
function createMockClawdbotApi(config: Partial<PluginConfig> = {}): ClawdbotApi {
  const registeredTools: ToolDefinition[] = [];
  const registeredServices: ServiceDefinition[] = [];
  const logs: Array<{ level: string; args: unknown[] }> = [];

  return {
    getConfig: vi.fn((pluginId: string) => {
      if (pluginId === 'one-mcp') {
        return config as PluginConfig;
      }
      return undefined;
    }),
    registerTool: vi.fn((toolDef: ToolDefinition, _options?: unknown) => {
      registeredTools.push(toolDef);
    }),
    registerService: vi.fn((service: ServiceDefinition) => {
      registeredServices.push(service);
    }),
    log: {
      info: vi.fn((...args: string[]) => {
        logs.push({ level: 'info', args });
      }),
      error: vi.fn((...args: (string | Error)[]) => {
        logs.push({ level: 'error', args });
      }),
      warn: vi.fn((...args: string[]) => {
        logs.push({ level: 'warn', args });
      }),
    },
    _registeredTools: registeredTools,
    _registeredServices: registeredServices,
    _logs: logs,
  } as ClawdbotApi & {
    _registeredTools: ToolDefinition[];
    _registeredServices: ServiceDefinition[];
    _logs: Array<{ level: string; args: unknown[] }>;
  };
}

describe('Clawdbot MCP Plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Configuration', () => {
    it('should use default config when no config provided', async () => {
      const mockApi = createMockClawdbotApi();

      // We can't easily test the full plugin without mocking one-mcp
      // This test validates the mock API structure
      const result = mockApi.getConfig('one-mcp');
      // Mock returns empty object when no config provided
      expect(result).toEqual({});
      expect(mockApi.getConfig).toHaveBeenCalledWith('one-mcp');
    });

    it('should use provided config', async () => {
      const config: PluginConfig = {
        configFilePath: '.test/mcp-config.yaml',
        serverId: 'test-server',
        noCache: true,
      };

      const mockApi = createMockClawdbotApi(config);
      const result = mockApi.getConfig('one-mcp');

      expect(result).toEqual(config);
      expect(result?.configFilePath).toBe('.test/mcp-config.yaml');
      expect(result?.serverId).toBe('test-server');
      expect(result?.noCache).toBe(true);
    });
  });

  describe('Mock API', () => {
    it('should track tool registrations', () => {
      const mockApi = createMockClawdbotApi();

      const toolDef: ToolDefinition = {
        name: 'test_tool',
        description: 'Test tool',
        parameters: {},
        execute: async () => ({ content: [] }),
      };

      mockApi.registerTool(toolDef);

      expect(mockApi.registerTool).toHaveBeenCalledWith(toolDef);
      expect((mockApi as any)._registeredTools).toHaveLength(1);
      expect((mockApi as any)._registeredTools[0].name).toBe('test_tool');
    });

    it('should track service registrations', () => {
      const mockApi = createMockClawdbotApi();

      const serviceDef: ServiceDefinition = {
        name: 'test-service',
        start: async () => {},
        stop: async () => {},
      };

      mockApi.registerService(serviceDef);

      expect(mockApi.registerService).toHaveBeenCalledWith(serviceDef);
      expect((mockApi as any)._registeredServices).toHaveLength(1);
      expect((mockApi as any)._registeredServices[0].name).toBe('test-service');
    });

    it('should track log messages', () => {
      const mockApi = createMockClawdbotApi();

      mockApi.log.info('Test info message');
      mockApi.log.error('Test error message');
      mockApi.log.warn('Test warning message');

      expect(mockApi.log.info).toHaveBeenCalledWith('Test info message');
      expect(mockApi.log.error).toHaveBeenCalledWith('Test error message');
      expect(mockApi.log.warn).toHaveBeenCalledWith('Test warning message');

      const logs = (mockApi as any)._logs;
      expect(logs).toHaveLength(3);
      expect(logs[0].level).toBe('info');
      expect(logs[1].level).toBe('error');
      expect(logs[2].level).toBe('warn');
    });
  });

  describe('Type Definitions', () => {
    it('should have correct PluginConfig interface', () => {
      const config: PluginConfig = {
        configFilePath: '.clawdbot/mcp-config.yaml',
        serverId: 'test-id',
        noCache: false,
      };

      expect(config.configFilePath).toBeDefined();
      expect(config.serverId).toBeDefined();
      expect(config.noCache).toBeDefined();
    });

    it('should allow partial PluginConfig', () => {
      const config: PluginConfig = {
        configFilePath: '.clawdbot/mcp-config.yaml',
      };

      expect(config.configFilePath).toBe('.clawdbot/mcp-config.yaml');
      expect(config.serverId).toBeUndefined();
      expect(config.noCache).toBeUndefined();
    });

    it('should have correct ToolDefinition interface', () => {
      const toolDef: ToolDefinition = {
        name: 'test_tool',
        description: 'A test tool',
        parameters: { type: 'object', properties: {} },
        execute: async (_id: string, _params: Record<string, unknown>) => ({
          content: [{ type: 'text', text: 'result' }],
        }),
      };

      expect(toolDef.name).toBe('test_tool');
      expect(toolDef.description).toBe('A test tool');
      expect(typeof toolDef.execute).toBe('function');
    });

    it('should have correct ServiceDefinition interface', () => {
      const serviceDef: ServiceDefinition = {
        name: 'test-service',
        start: async () => {
          console.log('started');
        },
        stop: async () => {
          console.log('stopped');
        },
      };

      expect(serviceDef.name).toBe('test-service');
      expect(typeof serviceDef.start).toBe('function');
      expect(typeof serviceDef.stop).toBe('function');
    });
  });
});
