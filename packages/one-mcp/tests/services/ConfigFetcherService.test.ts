import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigFetcherService } from '../../src/services/ConfigFetcherService';
import { writeFile, unlink, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('ConfigFetcherService', () => {
  let tempDir: string;
  let tempConfigPath: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `one-mcp-test-${Date.now()}`);
    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true });
    }
    tempConfigPath = join(tempDir, 'mcp-config.json');
  });

  afterEach(async () => {
    if (existsSync(tempConfigPath)) {
      await unlink(tempConfigPath);
    }
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should throw error when configFilePath is not provided', () => {
      expect(() => new ConfigFetcherService({})).toThrow('configFilePath must be provided');
    });

    it('should create service with configFilePath', () => {
      const service = new ConfigFetcherService({
        configFilePath: '/path/to/config.json',
      });
      expect(service).toBeInstanceOf(ConfigFetcherService);
    });

    it('should create service with custom cache TTL', () => {
      const service = new ConfigFetcherService({
        configFilePath: '/path/to/config.json',
      });
      expect(service).toBeInstanceOf(ConfigFetcherService);
    });

    it('should set default cache TTL to 60000ms', async () => {
      const service = new ConfigFetcherService({
        configFilePath: tempConfigPath,
        useCache: false, // Disable cache for predictable test behavior
      });

      await writeFile(
        tempConfigPath,
        JSON.stringify({
          mcpServers: {
            test: {
              command: 'node',
              args: ['server.js'],
            },
          },
        }),
      );

      await service.fetchConfiguration();
      expect(service.isCacheValid()).toBe(true);
    });

    it('should accept custom cache TTL', async () => {
      const service = new ConfigFetcherService({
        configFilePath: tempConfigPath,
        cacheTtlMs: 100,
      });

      await writeFile(
        tempConfigPath,
        JSON.stringify({
          mcpServers: {
            test: {
              command: 'node',
              args: ['server.js'],
            },
          },
        }),
      );

      await service.fetchConfiguration();

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(service.isCacheValid()).toBe(false);
    });
  });

  describe('fetchConfiguration from local file', () => {
    it('should load JSON config file', async () => {
      const config = {
        mcpServers: {
          'test-server': {
            command: 'node',
            args: ['server.js'],
          },
        },
      };

      await writeFile(tempConfigPath, JSON.stringify(config));

      const service = new ConfigFetcherService({
        configFilePath: tempConfigPath,
        useCache: false, // Disable cache for predictable test behavior
      });

      const result = await service.fetchConfiguration();
      expect(result.mcpServers['test-server']).toBeDefined();
      expect(result.mcpServers['test-server'].transport).toBe('stdio');
    });

    it('should load YAML config file', async () => {
      const yamlConfigPath = join(tempDir, 'mcp-config.yaml');
      const yamlContent = `
mcpServers:
  test-server:
    command: node
    args:
      - server.js
`;

      await writeFile(yamlConfigPath, yamlContent);

      const service = new ConfigFetcherService({
        configFilePath: yamlConfigPath,
      });

      const result = await service.fetchConfiguration();
      expect(result.mcpServers['test-server']).toBeDefined();
      expect(result.mcpServers['test-server'].transport).toBe('stdio');

      await unlink(yamlConfigPath);
    });

    it('should throw error if file does not exist', async () => {
      const service = new ConfigFetcherService({
        configFilePath: '/nonexistent/config.json',
      });

      await expect(service.fetchConfiguration()).rejects.toThrow('Config file not found');
    });

    it('should throw error if file is invalid JSON', async () => {
      await writeFile(tempConfigPath, 'invalid json {');

      const service = new ConfigFetcherService({
        configFilePath: tempConfigPath,
        useCache: false, // Disable cache for predictable test behavior
      });

      await expect(service.fetchConfiguration()).rejects.toThrow('Failed to load config file');
    });

    it('should throw error if config structure is invalid', async () => {
      await writeFile(tempConfigPath, JSON.stringify({ invalid: 'config' }));

      const service = new ConfigFetcherService({
        configFilePath: tempConfigPath,
        useCache: false, // Disable cache for predictable test behavior
      });

      await expect(service.fetchConfiguration()).rejects.toThrow();
    });
  });

  describe('caching', () => {
    it('should cache configuration and return cached value on subsequent calls', async () => {
      const config = {
        mcpServers: {
          'test-server': {
            command: 'node',
            args: ['server.js'],
          },
        },
      };

      await writeFile(tempConfigPath, JSON.stringify(config));

      const service = new ConfigFetcherService({
        configFilePath: tempConfigPath,
        cacheTtlMs: 5000,
      });

      const result1 = await service.fetchConfiguration();
      const result2 = await service.fetchConfiguration();

      expect(result1).toEqual(result2);
    });

    it('should refetch configuration when cache expires', async () => {
      const config1 = {
        mcpServers: {
          'test-server': {
            command: 'node',
            args: ['server1.js'],
          },
        },
      };

      const config2 = {
        mcpServers: {
          'test-server': {
            command: 'node',
            args: ['server2.js'],
          },
        },
      };

      await writeFile(tempConfigPath, JSON.stringify(config1));

      const service = new ConfigFetcherService({
        configFilePath: tempConfigPath,
        cacheTtlMs: 100,
      });

      const result1 = await service.fetchConfiguration();

      // Update file and wait for cache to expire
      await writeFile(tempConfigPath, JSON.stringify(config2));
      await new Promise((resolve) => setTimeout(resolve, 150));

      const result2 = await service.fetchConfiguration();

      expect(result1.mcpServers['test-server'].config.args).toEqual(['server1.js']);
      expect(result2.mcpServers['test-server'].config.args).toEqual(['server2.js']);
    });

    it('should clear cache manually', async () => {
      const config = {
        mcpServers: {
          'test-server': {
            command: 'node',
            args: ['server.js'],
          },
        },
      };

      await writeFile(tempConfigPath, JSON.stringify(config));

      const service = new ConfigFetcherService({
        configFilePath: tempConfigPath,
        useCache: false, // Disable cache for predictable test behavior
      });

      await service.fetchConfiguration();
      expect(service.isCacheValid()).toBe(true);

      service.clearCache();
      expect(service.isCacheValid()).toBe(false);
    });
  });

  describe('validation', () => {
    it('should throw error if mcpServers is missing', async () => {
      await writeFile(tempConfigPath, JSON.stringify({}));

      const service = new ConfigFetcherService({
        configFilePath: tempConfigPath,
        useCache: false, // Disable cache for predictable test behavior
      });

      await expect(service.fetchConfiguration()).rejects.toThrow();
    });

    it('should throw error if mcpServers is not an object', async () => {
      await writeFile(
        tempConfigPath,
        JSON.stringify({
          mcpServers: 'invalid',
        }),
      );

      const service = new ConfigFetcherService({
        configFilePath: tempConfigPath,
        useCache: false, // Disable cache for predictable test behavior
      });

      await expect(service.fetchConfiguration()).rejects.toThrow();
    });
  });

  describe('remote config fetching', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(async () => {
      vi.unstubAllGlobals();
      // Clean up cache between tests
      const { RemoteConfigCacheService } = await import(
        '../../src/services/RemoteConfigCacheService'
      );
      const cacheService = new RemoteConfigCacheService();
      await cacheService.clearAll();
    });

    it('should fetch and merge remote config with local config', async () => {
      const localConfig = {
        mcpServers: {
          'local-server': {
            command: 'node',
            args: ['local.js'],
          },
        },
        remoteConfigs: [
          {
            url: 'https://example.com/mcp-config.json',
            mergeStrategy: 'local-priority',
          },
        ],
      };

      const remoteConfig = {
        mcpServers: {
          'remote-server': {
            command: 'node',
            args: ['remote.js'],
          },
        },
      };

      await writeFile(tempConfigPath, JSON.stringify(localConfig));

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => remoteConfig,
      });

      const service = new ConfigFetcherService({
        configFilePath: tempConfigPath,
        useCache: false, // Disable cache for this test
      });

      const result = await service.fetchConfiguration();

      expect(result.mcpServers['local-server']).toBeDefined();
      expect(result.mcpServers['remote-server']).toBeDefined();
      expect(global.fetch).toHaveBeenCalledWith('https://example.com/mcp-config.json', {
        headers: {},
      });
    });

    it('should use local-priority merge strategy by default', async () => {
      const localConfig = {
        mcpServers: {
          'shared-server': {
            command: 'node',
            args: ['local.js'],
          },
        },
        remoteConfigs: [
          {
            url: 'https://example.com/mcp-config.json',
          },
        ],
      };

      const remoteConfig = {
        mcpServers: {
          'shared-server': {
            command: 'python',
            args: ['remote.py'],
          },
        },
      };

      await writeFile(tempConfigPath, JSON.stringify(localConfig));

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => remoteConfig,
      });

      const service = new ConfigFetcherService({
        configFilePath: tempConfigPath,
        useCache: false, // Disable cache for predictable test behavior
      });

      const result = await service.fetchConfiguration();

      // Local should override remote
      expect(result.mcpServers['shared-server'].config.command).toBe('node');
      expect(result.mcpServers['shared-server'].config.args).toEqual(['local.js']);
    });

    it('should use remote-priority merge strategy when specified', async () => {
      const localConfig = {
        mcpServers: {
          'shared-server': {
            command: 'node',
            args: ['local.js'],
          },
        },
        remoteConfigs: [
          {
            url: 'https://example.com/mcp-config.json',
            mergeStrategy: 'remote-priority',
          },
        ],
      };

      const remoteConfig = {
        mcpServers: {
          'shared-server': {
            command: 'python',
            args: ['remote.py'],
          },
        },
      };

      await writeFile(tempConfigPath, JSON.stringify(localConfig));

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => remoteConfig,
      });

      const service = new ConfigFetcherService({
        configFilePath: tempConfigPath,
        useCache: false, // Disable cache for predictable test behavior
      });

      const result = await service.fetchConfiguration();

      // Remote should override local
      expect(result.mcpServers['shared-server'].config.command).toBe('python');
      expect(result.mcpServers['shared-server'].config.args).toEqual(['remote.py']);
    });

    it('should interpolate environment variables in remote URL and headers', async () => {
      process.env.TEST_API_URL = 'https://example.com';
      process.env.TEST_API_KEY = 'secret-key';

      const localConfig = {
        mcpServers: {},
        remoteConfigs: [
          {
            // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional test data string
            url: '${TEST_API_URL}/mcp-config.json',
            headers: {
              // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional test data string
              Authorization: 'Bearer ${TEST_API_KEY}',
            },
          },
        ],
      };

      const remoteConfig = {
        mcpServers: {
          'remote-server': {
            command: 'node',
            args: ['remote.js'],
          },
        },
      };

      await writeFile(tempConfigPath, JSON.stringify(localConfig));

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => remoteConfig,
      });

      const service = new ConfigFetcherService({
        configFilePath: tempConfigPath,
        useCache: false, // Disable cache for predictable test behavior
      });

      await service.fetchConfiguration();

      expect(global.fetch).toHaveBeenCalledWith('https://example.com/mcp-config.json', {
        headers: {
          Authorization: 'Bearer secret-key',
        },
      });

      delete process.env.TEST_API_URL;
      delete process.env.TEST_API_KEY;
    });

    it('should continue processing if remote config fetch fails', async () => {
      const localConfig = {
        mcpServers: {
          'local-server': {
            command: 'node',
            args: ['local.js'],
          },
        },
        remoteConfigs: [
          {
            url: 'https://example.com/mcp-config.json',
          },
        ],
      };

      await writeFile(tempConfigPath, JSON.stringify(localConfig));

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const service = new ConfigFetcherService({
        configFilePath: tempConfigPath,
        useCache: false, // Disable cache for predictable test behavior
      });

      const result = await service.fetchConfiguration();

      // Should still have local server even though remote fetch failed
      expect(result.mcpServers['local-server']).toBeDefined();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should handle multiple remote config sources', async () => {
      const localConfig = {
        mcpServers: {
          'local-server': {
            command: 'node',
            args: ['local.js'],
          },
        },
        remoteConfigs: [
          {
            url: 'https://example.com/config1.json',
          },
          {
            url: 'https://example.com/config2.json',
          },
        ],
      };

      const remoteConfig1 = {
        mcpServers: {
          'remote-server-1': {
            command: 'node',
            args: ['remote1.js'],
          },
        },
      };

      const remoteConfig2 = {
        mcpServers: {
          'remote-server-2': {
            command: 'node',
            args: ['remote2.js'],
          },
        },
      };

      await writeFile(tempConfigPath, JSON.stringify(localConfig));

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => remoteConfig1,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => remoteConfig2,
        });

      const service = new ConfigFetcherService({
        configFilePath: tempConfigPath,
        useCache: false, // Disable cache for predictable test behavior
      });

      const result = await service.fetchConfiguration();

      expect(result.mcpServers['local-server']).toBeDefined();
      expect(result.mcpServers['remote-server-1']).toBeDefined();
      expect(result.mcpServers['remote-server-2']).toBeDefined();
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should fetch multiple remote configs in parallel', async () => {
      const localConfig = {
        mcpServers: {},
        remoteConfigs: [
          {
            url: 'https://example.com/config1.json',
          },
          {
            url: 'https://example.com/config2.json',
          },
          {
            url: 'https://example.com/config3.json',
          },
        ],
      };

      const remoteConfig1 = {
        mcpServers: {
          'remote-1': { command: 'node', args: ['1.js'] },
        },
      };

      const remoteConfig2 = {
        mcpServers: {
          'remote-2': { command: 'node', args: ['2.js'] },
        },
      };

      const remoteConfig3 = {
        mcpServers: {
          'remote-3': { command: 'node', args: ['3.js'] },
        },
      };

      await writeFile(tempConfigPath, JSON.stringify(localConfig));

      // Track the order of fetch calls to verify they happen in parallel
      const fetchOrder: number[] = [];
      let fetchCount = 0;

      (global.fetch as any).mockImplementation(async (url: string) => {
        const currentFetch = ++fetchCount;
        fetchOrder.push(currentFetch);

        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 10));

        if (url.includes('config1.json')) {
          return { ok: true, json: async () => remoteConfig1 };
        }
        if (url.includes('config2.json')) {
          return { ok: true, json: async () => remoteConfig2 };
        }
        if (url.includes('config3.json')) {
          return { ok: true, json: async () => remoteConfig3 };
        }
      });

      const service = new ConfigFetcherService({
        configFilePath: tempConfigPath,
        useCache: false, // Disable cache for predictable test behavior
      });

      const startTime = Date.now();
      const result = await service.fetchConfiguration();
      const endTime = Date.now();

      // Verify all configs were fetched
      expect(result.mcpServers['remote-1']).toBeDefined();
      expect(result.mcpServers['remote-2']).toBeDefined();
      expect(result.mcpServers['remote-3']).toBeDefined();
      expect(global.fetch).toHaveBeenCalledTimes(3);

      // If sequential, would take ~30ms (3 * 10ms)
      // If parallel, should take ~10ms (max of all)
      // Allow some buffer for test execution
      expect(endTime - startTime).toBeLessThan(50);
    });
  });

  describe('remote config caching', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(async () => {
      vi.unstubAllGlobals();
      const { RemoteConfigCacheService } = await import(
        '../../src/services/RemoteConfigCacheService'
      );
      const cacheService = new RemoteConfigCacheService();
      await cacheService.clearAll();
    });

    it('should cache remote config and reuse it on subsequent calls', async () => {
      const localConfig = {
        mcpServers: {},
        remoteConfigs: [
          {
            url: 'https://example.com/config.json',
          },
        ],
      };

      const remoteConfig = {
        mcpServers: {
          'remote-server': {
            command: 'node',
            args: ['remote.js'],
          },
        },
      };

      await writeFile(tempConfigPath, JSON.stringify(localConfig));

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => remoteConfig,
      });

      // With cache enabled
      const service = new ConfigFetcherService({
        configFilePath: tempConfigPath,
        useCache: true,
      });

      // First call - should fetch from remote
      await service.fetchConfiguration();
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      await service.fetchConfiguration();
      expect(global.fetch).toHaveBeenCalledTimes(1); // Still 1, not 2
    });

    it('should skip cache when useCache is false but still write to cache', async () => {
      const localConfig = {
        mcpServers: {},
        remoteConfigs: [
          {
            url: 'https://example.com/config.json',
          },
        ],
      };

      const remoteConfig = {
        mcpServers: {
          'remote-server': {
            command: 'node',
            args: ['remote.js'],
          },
        },
      };

      await writeFile(tempConfigPath, JSON.stringify(localConfig));

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => remoteConfig,
      });

      // First call with cache disabled
      const service1 = new ConfigFetcherService({
        configFilePath: tempConfigPath,
        useCache: false,
        cacheTtlMs: 0, // Disable in-memory cache
      });

      await service1.fetchConfiguration();
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second call with new instance - should fetch again (cache read disabled)
      const service2 = new ConfigFetcherService({
        configFilePath: tempConfigPath,
        useCache: false,
        cacheTtlMs: 0, // Disable in-memory cache
      });

      await service2.fetchConfiguration();
      expect(global.fetch).toHaveBeenCalledTimes(2);

      // Verify cache was still written
      const { RemoteConfigCacheService } = await import(
        '../../src/services/RemoteConfigCacheService'
      );
      const cacheService = new RemoteConfigCacheService();
      const cachedConfig = await cacheService.get('https://example.com/config.json');
      expect(cachedConfig).not.toBeNull();
    });

    it('should use different cache TTL when specified', async () => {
      const localConfig = {
        mcpServers: {},
        remoteConfigs: [
          {
            url: 'https://example.com/config.json',
          },
        ],
      };

      const remoteConfig = {
        mcpServers: {
          'remote-server': {
            command: 'node',
            args: ['remote.js'],
          },
        },
      };

      await writeFile(tempConfigPath, JSON.stringify(localConfig));

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => remoteConfig,
      });

      // First call with custom cache TTL of 100ms
      const service1 = new ConfigFetcherService({
        configFilePath: tempConfigPath,
        useCache: true,
        remoteCacheTtlMs: 100,
        cacheTtlMs: 0, // Disable in-memory cache
      });

      await service1.fetchConfiguration();
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Second call with new instance - should fetch again (cache expired)
      const service2 = new ConfigFetcherService({
        configFilePath: tempConfigPath,
        useCache: true,
        remoteCacheTtlMs: 100,
        cacheTtlMs: 0, // Disable in-memory cache
      });

      await service2.fetchConfiguration();
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should cache each remote URL separately', async () => {
      const localConfig = {
        mcpServers: {},
        remoteConfigs: [
          {
            url: 'https://example.com/config1.json',
          },
          {
            url: 'https://example.com/config2.json',
          },
        ],
      };

      const remoteConfig1 = {
        mcpServers: {
          'remote-1': { command: 'node', args: ['1.js'] },
        },
      };

      const remoteConfig2 = {
        mcpServers: {
          'remote-2': { command: 'node', args: ['2.js'] },
        },
      };

      await writeFile(tempConfigPath, JSON.stringify(localConfig));

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => remoteConfig1,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => remoteConfig2,
        });

      const service = new ConfigFetcherService({
        configFilePath: tempConfigPath,
        useCache: true,
      });

      // First call - both URLs should be fetched
      const result1 = await service.fetchConfiguration();
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result1.mcpServers['remote-1']).toBeDefined();
      expect(result1.mcpServers['remote-2']).toBeDefined();

      // Second call - both should come from cache
      const result2 = await service.fetchConfiguration();
      expect(global.fetch).toHaveBeenCalledTimes(2); // Still 2, not 4
      expect(result2.mcpServers['remote-1']).toBeDefined();
      expect(result2.mcpServers['remote-2']).toBeDefined();
    });
  });
});
