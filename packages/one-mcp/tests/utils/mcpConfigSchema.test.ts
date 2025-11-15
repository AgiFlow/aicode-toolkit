import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ClaudeCodeMcpConfigSchema,
  InternalMcpConfigSchema,
  transformClaudeCodeConfig,
  parseMcpConfig,
} from '../../src/utils/mcpConfigSchema';
import { ZodError } from 'zod';

describe('mcpConfigSchema', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset process.env before each test
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('ClaudeCodeMcpConfigSchema validation', () => {
    it('should validate stdio server config', () => {
      const config = {
        mcpServers: {
          'test-server': {
            command: 'node',
            args: ['server.js'],
            env: {
              NODE_ENV: 'production',
            },
          },
        },
      };

      const result = ClaudeCodeMcpConfigSchema.parse(config);
      expect(result.mcpServers['test-server'].command).toBe('node');
    });

    it('should validate HTTP server config', () => {
      const config = {
        mcpServers: {
          'http-server': {
            url: 'https://example.com/mcp',
            headers: {
              Authorization: 'Bearer token',
            },
          },
        },
      };

      const result = ClaudeCodeMcpConfigSchema.parse(config);
      expect(result.mcpServers['http-server'].url).toBe('https://example.com/mcp');
    });

    it('should validate SSE server config', () => {
      const config = {
        mcpServers: {
          'sse-server': {
            url: 'https://example.com/mcp/sse',
            type: 'sse' as const,
          },
        },
      };

      const result = ClaudeCodeMcpConfigSchema.parse(config);
      expect(result.mcpServers['sse-server'].type).toBe('sse');
    });

    it('should validate config with instruction', () => {
      const config = {
        mcpServers: {
          'server-with-instruction': {
            command: 'node',
            args: ['server.js'],
            instruction: 'Use this server for data operations',
          },
        },
      };

      const result = ClaudeCodeMcpConfigSchema.parse(config);
      expect(result.mcpServers['server-with-instruction'].instruction).toBe(
        'Use this server for data operations'
      );
    });

    it('should validate config with nested instruction', () => {
      const config = {
        mcpServers: {
          'server-with-nested-instruction': {
            command: 'node',
            args: ['server.js'],
            config: {
              instruction: 'Server default instruction',
            },
          },
        },
      };

      const result = ClaudeCodeMcpConfigSchema.parse(config);
      expect(result.mcpServers['server-with-nested-instruction'].config?.instruction).toBe(
        'Server default instruction'
      );
    });

    it('should throw error for invalid URL', () => {
      const config = {
        mcpServers: {
          'invalid-server': {
            url: 'not-a-valid-url',
          },
        },
      };

      expect(() => ClaudeCodeMcpConfigSchema.parse(config)).toThrow(ZodError);
    });

    it('should throw error for missing required fields', () => {
      const config = {
        mcpServers: {
          'incomplete-server': {
            args: ['server.js'],
          },
        },
      };

      expect(() => ClaudeCodeMcpConfigSchema.parse(config)).toThrow(ZodError);
    });
  });

  describe('transformClaudeCodeConfig', () => {
    it('should transform stdio config to internal format', () => {
      const claudeConfig = {
        mcpServers: {
          'stdio-server': {
            command: 'node',
            args: ['server.js'],
            env: {
              NODE_ENV: 'production',
            },
          },
        },
      };

      const result = transformClaudeCodeConfig(claudeConfig);

      expect(result.mcpServers['stdio-server'].transport).toBe('stdio');
      expect(result.mcpServers['stdio-server'].config.command).toBe('node');
      expect(result.mcpServers['stdio-server'].config.args).toEqual(['server.js']);
      expect(result.mcpServers['stdio-server'].config.env).toEqual({
        NODE_ENV: 'production',
      });
    });

    it('should transform HTTP config to internal format', () => {
      const claudeConfig = {
        mcpServers: {
          'http-server': {
            url: 'https://example.com/mcp',
            headers: {
              Authorization: 'Bearer token',
            },
          },
        },
      };

      const result = transformClaudeCodeConfig(claudeConfig);

      expect(result.mcpServers['http-server'].transport).toBe('http');
      expect(result.mcpServers['http-server'].config.url).toBe('https://example.com/mcp');
      expect(result.mcpServers['http-server'].config.headers).toEqual({
        Authorization: 'Bearer token',
      });
    });

    it('should transform SSE config to internal format', () => {
      const claudeConfig = {
        mcpServers: {
          'sse-server': {
            url: 'https://example.com/mcp/sse',
            type: 'sse' as const,
          },
        },
      };

      const result = transformClaudeCodeConfig(claudeConfig);

      expect(result.mcpServers['sse-server'].transport).toBe('sse');
      expect(result.mcpServers['sse-server'].config.url).toBe('https://example.com/mcp/sse');
    });

    it('should skip disabled servers', () => {
      const claudeConfig = {
        mcpServers: {
          'enabled-server': {
            command: 'node',
            args: ['server.js'],
          },
          'disabled-server': {
            command: 'node',
            args: ['disabled.js'],
            disabled: true,
          },
        },
      };

      const result = transformClaudeCodeConfig(claudeConfig);

      expect(result.mcpServers['enabled-server']).toBeDefined();
      expect(result.mcpServers['disabled-server']).toBeUndefined();
    });

    it('should prioritize top-level instruction over nested instruction', () => {
      const claudeConfig = {
        mcpServers: {
          'server-with-both-instructions': {
            command: 'node',
            args: ['server.js'],
            instruction: 'User override instruction',
            config: {
              instruction: 'Server default instruction',
            },
          },
        },
      };

      const result = transformClaudeCodeConfig(claudeConfig);

      expect(result.mcpServers['server-with-both-instructions'].instruction).toBe(
        'User override instruction'
      );
    });

    it('should use nested instruction when top-level is not provided', () => {
      const claudeConfig = {
        mcpServers: {
          'server-with-nested-only': {
            command: 'node',
            args: ['server.js'],
            config: {
              instruction: 'Server default instruction',
            },
          },
        },
      };

      const result = transformClaudeCodeConfig(claudeConfig);

      expect(result.mcpServers['server-with-nested-only'].instruction).toBe(
        'Server default instruction'
      );
    });
  });

  describe('environment variable interpolation', () => {
    it('should interpolate environment variables in command', () => {
      process.env.NODE_BIN = '/usr/bin/node';

      const claudeConfig = {
        mcpServers: {
          'env-server': {
            command: '${NODE_BIN}',
            args: ['server.js'],
          },
        },
      };

      const result = transformClaudeCodeConfig(claudeConfig);

      expect(result.mcpServers['env-server'].config.command).toBe('/usr/bin/node');
    });

    it('should interpolate environment variables in args', () => {
      process.env.SERVER_PATH = '/path/to/server.js';

      const claudeConfig = {
        mcpServers: {
          'env-server': {
            command: 'node',
            args: ['${SERVER_PATH}'],
          },
        },
      };

      const result = transformClaudeCodeConfig(claudeConfig);

      expect(result.mcpServers['env-server'].config.args).toEqual(['/path/to/server.js']);
    });

    it('should interpolate environment variables in env values', () => {
      process.env.API_KEY = 'secret-key-123';

      const claudeConfig = {
        mcpServers: {
          'env-server': {
            command: 'node',
            args: ['server.js'],
            env: {
              API_TOKEN: '${API_KEY}',
            },
          },
        },
      };

      const result = transformClaudeCodeConfig(claudeConfig);

      expect(result.mcpServers['env-server'].config.env?.API_TOKEN).toBe('secret-key-123');
    });

    it('should interpolate environment variables in URLs', () => {
      process.env.MCP_HOST = 'https://mcp.example.com';

      const claudeConfig = {
        mcpServers: {
          'http-server': {
            url: '${MCP_HOST}/api',
          },
        },
      };

      const result = transformClaudeCodeConfig(claudeConfig);

      expect(result.mcpServers['http-server'].config.url).toBe('https://mcp.example.com/api');
    });

    it('should interpolate environment variables in headers', () => {
      process.env.AUTH_TOKEN = 'Bearer token123';

      const claudeConfig = {
        mcpServers: {
          'http-server': {
            url: 'https://example.com/mcp',
            headers: {
              Authorization: '${AUTH_TOKEN}',
            },
          },
        },
      };

      const result = transformClaudeCodeConfig(claudeConfig);

      expect(result.mcpServers['http-server'].config.headers?.Authorization).toBe(
        'Bearer token123'
      );
    });

    it('should keep placeholder if environment variable is undefined', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const claudeConfig = {
        mcpServers: {
          'env-server': {
            command: '${UNDEFINED_VAR}',
            args: ['server.js'],
          },
        },
      };

      const result = transformClaudeCodeConfig(claudeConfig);

      expect(result.mcpServers['env-server'].config.command).toBe('${UNDEFINED_VAR}');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Environment variable UNDEFINED_VAR is not defined')
      );

      consoleSpy.mockRestore();
    });

    it('should interpolate multiple environment variables in single string', () => {
      process.env.HOME = '/home/user';
      process.env.PROJECT = 'myproject';

      const claudeConfig = {
        mcpServers: {
          'env-server': {
            command: 'node',
            args: ['${HOME}/${PROJECT}/server.js'],
          },
        },
      };

      const result = transformClaudeCodeConfig(claudeConfig);

      expect(result.mcpServers['env-server'].config.args).toEqual([
        '/home/user/myproject/server.js',
      ]);
    });
  });

  describe('parseMcpConfig', () => {
    it('should parse and transform valid config', () => {
      const rawConfig = {
        mcpServers: {
          'test-server': {
            command: 'node',
            args: ['server.js'],
          },
        },
      };

      const result = parseMcpConfig(rawConfig);

      expect(result.mcpServers['test-server'].transport).toBe('stdio');
      expect(result.mcpServers['test-server'].config.command).toBe('node');
    });

    it('should throw error for invalid Claude Code config', () => {
      const rawConfig = {
        mcpServers: {
          'invalid-server': {
            invalidField: 'value',
          },
        },
      };

      expect(() => parseMcpConfig(rawConfig)).toThrow(ZodError);
    });

    it('should throw error for missing mcpServers', () => {
      const rawConfig = {
        servers: {},
      };

      expect(() => parseMcpConfig(rawConfig)).toThrow(ZodError);
    });

    it('should parse complex real-world config', () => {
      process.env.HOME = '/home/user';
      process.env.API_KEY = 'secret123';

      const rawConfig = {
        mcpServers: {
          filesystem: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '${HOME}/Documents'],
            instruction: 'Access files in Documents folder',
          },
          'remote-api': {
            url: 'https://api.example.com/mcp',
            type: 'sse' as const,
            headers: {
              Authorization: 'Bearer ${API_KEY}',
            },
          },
          'disabled-server': {
            command: 'node',
            args: ['disabled.js'],
            disabled: true,
          },
        },
      };

      const result = parseMcpConfig(rawConfig);

      expect(result.mcpServers.filesystem).toBeDefined();
      expect(result.mcpServers.filesystem.config.args).toContain('/home/user/Documents');
      expect(result.mcpServers['remote-api']).toBeDefined();
      expect(result.mcpServers['remote-api'].transport).toBe('sse');
      expect(result.mcpServers['remote-api'].config.headers?.Authorization).toBe(
        'Bearer secret123'
      );
      expect(result.mcpServers['disabled-server']).toBeUndefined();
    });
  });

  describe('InternalMcpConfigSchema validation', () => {
    it('should validate stdio transport config', () => {
      const config = {
        mcpServers: {
          'test-server': {
            name: 'test-server',
            transport: 'stdio' as const,
            config: {
              command: 'node',
              args: ['server.js'],
            },
          },
        },
      };

      const result = InternalMcpConfigSchema.parse(config);
      expect(result.mcpServers['test-server'].transport).toBe('stdio');
    });

    it('should validate http transport config', () => {
      const config = {
        mcpServers: {
          'http-server': {
            name: 'http-server',
            transport: 'http' as const,
            config: {
              url: 'https://example.com/mcp',
            },
          },
        },
      };

      const result = InternalMcpConfigSchema.parse(config);
      expect(result.mcpServers['http-server'].transport).toBe('http');
    });

    it('should validate sse transport config', () => {
      const config = {
        mcpServers: {
          'sse-server': {
            name: 'sse-server',
            transport: 'sse' as const,
            config: {
              url: 'https://example.com/mcp/sse',
            },
          },
        },
      };

      const result = InternalMcpConfigSchema.parse(config);
      expect(result.mcpServers['sse-server'].transport).toBe('sse');
    });

    it('should throw error for invalid transport type', () => {
      const config = {
        mcpServers: {
          'invalid-server': {
            name: 'invalid-server',
            transport: 'invalid',
            config: {
              command: 'node',
            },
          },
        },
      };

      expect(() => InternalMcpConfigSchema.parse(config)).toThrow(ZodError);
    });
  });
});
