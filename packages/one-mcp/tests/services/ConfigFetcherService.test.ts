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
      expect(() => new ConfigFetcherService({})).toThrow(
        'configFilePath must be provided'
      );
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
