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
    it('should throw error when neither configUrl nor configFilePath is provided', () => {
      expect(() => new ConfigFetcherService({})).toThrow(
        'Either configUrl or configFilePath must be provided'
      );
    });

    it('should create service with configUrl', () => {
      const service = new ConfigFetcherService({
        configUrl: 'https://example.com/config.json',
      });
      expect(service).toBeInstanceOf(ConfigFetcherService);
    });

    it('should create service with configFilePath', () => {
      const service = new ConfigFetcherService({
        configFilePath: '/path/to/config.json',
      });
      expect(service).toBeInstanceOf(ConfigFetcherService);
    });

    it('should create service with both configUrl and configFilePath', () => {
      const service = new ConfigFetcherService({
        configUrl: 'https://example.com/config.json',
        configFilePath: '/path/to/config.json',
      });
      expect(service).toBeInstanceOf(ConfigFetcherService);
    });

    it('should set default cache TTL to 60000ms', async () => {
      const service = new ConfigFetcherService({
        configFilePath: tempConfigPath,
      });

      await writeFile(tempConfigPath, JSON.stringify({
        mcpServers: {
          test: {
            command: 'node',
            args: ['server.js'],
          },
        },
      }));

      await service.fetchConfiguration();
      expect(service.isCacheValid()).toBe(true);
    });

    it('should accept custom cache TTL', async () => {
      const service = new ConfigFetcherService({
        configFilePath: tempConfigPath,
        cacheTtlMs: 100,
      });

      await writeFile(tempConfigPath, JSON.stringify({
        mcpServers: {
          test: {
            command: 'node',
            args: ['server.js'],
          },
        },
      }));

      await service.fetchConfiguration();

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));
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

      await expect(service.fetchConfiguration()).rejects.toThrow(
        'Config file not found'
      );
    });

    it('should throw error if file is invalid JSON', async () => {
      await writeFile(tempConfigPath, 'invalid json {');

      const service = new ConfigFetcherService({
        configFilePath: tempConfigPath,
      });

      await expect(service.fetchConfiguration()).rejects.toThrow(
        'Failed to load config file'
      );
    });

    it('should throw error if config structure is invalid', async () => {
      await writeFile(tempConfigPath, JSON.stringify({ invalid: 'config' }));

      const service = new ConfigFetcherService({
        configFilePath: tempConfigPath,
      });

      await expect(service.fetchConfiguration()).rejects.toThrow();
    });
  });

  describe('fetchConfiguration from URL', () => {
    it('should fetch config from remote URL', async () => {
      const mockConfig = {
        mcpServers: {
          'remote-server': {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-everything'],
          },
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockConfig,
      });

      const service = new ConfigFetcherService({
        configUrl: 'https://example.com/config.json',
      });

      const result = await service.fetchConfiguration();
      expect(result.mcpServers['remote-server']).toBeDefined();
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/config.json',
        { headers: {} }
      );
    });

    it('should pass custom headers when fetching', async () => {
      const mockConfig = {
        mcpServers: {
          'remote-server': {
            command: 'node',
            args: ['server.js'],
          },
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockConfig,
      });

      const service = new ConfigFetcherService({
        configUrl: 'https://example.com/config.json',
        headers: { Authorization: 'Bearer token123' },
      });

      await service.fetchConfiguration();
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/config.json',
        { headers: { Authorization: 'Bearer token123' } }
      );
    });

    it('should throw error if fetch fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const service = new ConfigFetcherService({
        configUrl: 'https://example.com/config.json',
      });

      await expect(service.fetchConfiguration()).rejects.toThrow(
        'Failed to fetch MCP configuration: 404 Not Found'
      );
    });

    it('should throw error if network error occurs', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const service = new ConfigFetcherService({
        configUrl: 'https://example.com/config.json',
      });

      await expect(service.fetchConfiguration()).rejects.toThrow(
        'Failed to fetch MCP configuration from URL'
      );
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
      await new Promise(resolve => setTimeout(resolve, 150));

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
      });

      await service.fetchConfiguration();
      expect(service.isCacheValid()).toBe(true);

      service.clearCache();
      expect(service.isCacheValid()).toBe(false);
    });
  });

  describe('configuration merging', () => {
    it('should merge local and remote configs with local-priority strategy', async () => {
      const localConfig = {
        mcpServers: {
          'local-server': {
            command: 'node',
            args: ['local.js'],
          },
          'shared-server': {
            command: 'node',
            args: ['local-shared.js'],
          },
        },
      };

      const remoteConfig = {
        mcpServers: {
          'remote-server': {
            command: 'node',
            args: ['remote.js'],
          },
          'shared-server': {
            command: 'node',
            args: ['remote-shared.js'],
          },
        },
      };

      await writeFile(tempConfigPath, JSON.stringify(localConfig));

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => remoteConfig,
      });

      const service = new ConfigFetcherService({
        configUrl: 'https://example.com/config.json',
        configFilePath: tempConfigPath,
        mergeStrategy: 'local-priority',
      });

      const result = await service.fetchConfiguration();

      expect(result.mcpServers['local-server']).toBeDefined();
      expect(result.mcpServers['remote-server']).toBeDefined();
      // Local should override remote for shared server
      expect(result.mcpServers['shared-server'].config.args).toEqual(['local-shared.js']);
    });

    it('should merge local and remote configs with remote-priority strategy', async () => {
      const localConfig = {
        mcpServers: {
          'local-server': {
            command: 'node',
            args: ['local.js'],
          },
          'shared-server': {
            command: 'node',
            args: ['local-shared.js'],
          },
        },
      };

      const remoteConfig = {
        mcpServers: {
          'remote-server': {
            command: 'node',
            args: ['remote.js'],
          },
          'shared-server': {
            command: 'node',
            args: ['remote-shared.js'],
          },
        },
      };

      await writeFile(tempConfigPath, JSON.stringify(localConfig));

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => remoteConfig,
      });

      const service = new ConfigFetcherService({
        configUrl: 'https://example.com/config.json',
        configFilePath: tempConfigPath,
        mergeStrategy: 'remote-priority',
      });

      const result = await service.fetchConfiguration();

      expect(result.mcpServers['local-server']).toBeDefined();
      expect(result.mcpServers['remote-server']).toBeDefined();
      // Remote should override local for shared server
      expect(result.mcpServers['shared-server'].config.args).toEqual(['remote-shared.js']);
    });

    it('should deep merge configs with merge-deep strategy', async () => {
      const localConfig = {
        mcpServers: {
          'shared-server': {
            command: 'node',
            args: ['local.js'],
            env: {
              LOCAL_VAR: 'local-value',
              SHARED_VAR: 'local-shared',
            },
          },
        },
      };

      const remoteConfig = {
        mcpServers: {
          'shared-server': {
            command: 'node',
            args: ['remote.js'],
            env: {
              REMOTE_VAR: 'remote-value',
              SHARED_VAR: 'remote-shared',
            },
          },
        },
      };

      await writeFile(tempConfigPath, JSON.stringify(localConfig));

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => remoteConfig,
      });

      const service = new ConfigFetcherService({
        configUrl: 'https://example.com/config.json',
        configFilePath: tempConfigPath,
        mergeStrategy: 'merge-deep',
      });

      const result = await service.fetchConfiguration();

      expect(result.mcpServers['shared-server'].config.env).toEqual({
        LOCAL_VAR: 'local-value',
        REMOTE_VAR: 'remote-value',
        SHARED_VAR: 'local-shared', // Local overrides remote
      });
    });
  });

  describe('validation', () => {
    it('should throw error if mcpServers is missing', async () => {
      await writeFile(tempConfigPath, JSON.stringify({}));

      const service = new ConfigFetcherService({
        configFilePath: tempConfigPath,
      });

      await expect(service.fetchConfiguration()).rejects.toThrow();
    });

    it('should throw error if mcpServers is not an object', async () => {
      await writeFile(tempConfigPath, JSON.stringify({
        mcpServers: 'invalid',
      }));

      const service = new ConfigFetcherService({
        configFilePath: tempConfigPath,
      });

      await expect(service.fetchConfiguration()).rejects.toThrow();
    });
  });
});
