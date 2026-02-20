import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ClaudeCodeMcpConfigSchema,
  InternalMcpConfigSchema,
  transformClaudeCodeConfig,
  parseMcpConfig,
  validateRemoteConfigSource,
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
        'Use this server for data operations',
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
        'Server default instruction',
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
        'User override instruction',
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
        'Server default instruction',
      );
    });
  });

  describe('environment variable interpolation', () => {
    it('should interpolate environment variables in command', () => {
      process.env.NODE_BIN = '/usr/bin/node';

      const claudeConfig = {
        mcpServers: {
          'env-server': {
            // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional test data string
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
            // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional test data string
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
              // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional test data string
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
            // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional test data string
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
              // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional test data string
              Authorization: '${AUTH_TOKEN}',
            },
          },
        },
      };

      const result = transformClaudeCodeConfig(claudeConfig);

      expect(result.mcpServers['http-server'].config.headers?.Authorization).toBe(
        'Bearer token123',
      );
    });

    it('should keep placeholder if environment variable is undefined', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const claudeConfig = {
        mcpServers: {
          'env-server': {
            // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional test data string
            command: '${UNDEFINED_VAR}',
            args: ['server.js'],
          },
        },
      };

      const result = transformClaudeCodeConfig(claudeConfig);

      // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional test data string
      expect(result.mcpServers['env-server'].config.command).toBe('${UNDEFINED_VAR}');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Environment variable UNDEFINED_VAR is not defined'),
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
            // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional test data string
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
            // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional test data string
            args: ['-y', '@modelcontextprotocol/server-filesystem', '${HOME}/Documents'],
            instruction: 'Access files in Documents folder',
          },
          'remote-api': {
            url: 'https://api.example.com/mcp',
            type: 'sse' as const,
            headers: {
              // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional test data string
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
        'Bearer secret123',
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

  describe('validateRemoteConfigSource', () => {
    it('should pass validation when no validation rules are provided', () => {
      const source = {
        url: 'https://example.com/mcp-config.json',
      };

      expect(() => validateRemoteConfigSource(source)).not.toThrow();
    });

    it('should validate URL against regex pattern', () => {
      const source = {
        url: 'https://example.com/mcp-config.json',
        validation: {
          url: '^https://.*',
        },
      };

      expect(() => validateRemoteConfigSource(source)).not.toThrow();
    });

    it('should throw error when URL does not match pattern', () => {
      const source = {
        url: 'http://example.com/mcp-config.json',
        security: {
          enforceHttps: false, // Allow HTTP to test validation pattern
        },
        validation: {
          url: '^https://.*',
        },
      };

      expect(() => validateRemoteConfigSource(source)).toThrow('does not match validation pattern');
    });

    it('should validate URL with environment variable interpolation', () => {
      process.env.TEST_URL = 'https://secure.example.com';

      const source = {
        // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional test data string
        url: '${TEST_URL}/mcp-config.json',
        validation: {
          url: '^https://secure\\..*',
        },
      };

      expect(() => validateRemoteConfigSource(source)).not.toThrow();

      delete process.env.TEST_URL;
    });

    it('should validate header values against regex patterns', () => {
      const source = {
        url: 'https://example.com/mcp-config.json',
        headers: {
          Authorization: 'Bearer token123',
          'Content-Type': 'application/json',
        },
        validation: {
          headers: {
            Authorization: '^Bearer .*',
            'Content-Type': '^application/json$',
          },
        },
      };

      expect(() => validateRemoteConfigSource(source)).not.toThrow();
    });

    it('should throw error when header value does not match pattern', () => {
      const source = {
        url: 'https://example.com/mcp-config.json',
        headers: {
          Authorization: 'Basic token123',
          'Content-Type': 'application/json',
        },
        validation: {
          headers: {
            Authorization: '^Bearer .*',
          },
        },
      };

      expect(() => validateRemoteConfigSource(source)).toThrow('does not match validation pattern');
    });

    it('should throw error when required headers are missing', () => {
      const source = {
        url: 'https://example.com/mcp-config.json',
        headers: {
          'Content-Type': 'application/json',
        },
        validation: {
          headers: {
            Authorization: '^Bearer .*',
            'Content-Type': '^application/json$',
          },
        },
      };

      expect(() => validateRemoteConfigSource(source)).toThrow(
        'missing required header: Authorization',
      );
    });

    it('should throw error when headers object is not provided but required', () => {
      const source = {
        url: 'https://example.com/mcp-config.json',
        validation: {
          headers: {
            Authorization: '^Bearer .*',
          },
        },
      };

      expect(() => validateRemoteConfigSource(source)).toThrow(
        'missing required headers: Authorization',
      );
    });

    it('should validate header values with environment variable interpolation', () => {
      process.env.TEST_TOKEN = 'secret-token-123';

      const source = {
        url: 'https://example.com/mcp-config.json',
        headers: {
          // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional test data string
          Authorization: 'Bearer ${TEST_TOKEN}',
        },
        validation: {
          headers: {
            Authorization: '^Bearer secret-token-.*',
          },
        },
      };

      expect(() => validateRemoteConfigSource(source)).not.toThrow();

      delete process.env.TEST_TOKEN;
    });

    it('should validate both URL pattern and headers together', () => {
      const source = {
        url: 'https://api.example.com/mcp-config.json',
        headers: {
          Authorization: 'Bearer token123',
          'X-API-Key': 'key123',
        },
        validation: {
          url: '^https://api\\..*',
          headers: {
            Authorization: '^Bearer .*',
            'X-API-Key': '^key\\d+$',
          },
        },
      };

      expect(() => validateRemoteConfigSource(source)).not.toThrow();
    });

    it('should throw error when URL pattern fails even if headers are valid', () => {
      const source = {
        url: 'http://api.example.com/mcp-config.json',
        headers: {
          Authorization: 'Bearer token',
        },
        security: {
          enforceHttps: false, // Allow HTTP to test validation pattern
        },
        validation: {
          url: '^https://.*',
          headers: {
            Authorization: '^Bearer .*',
          },
        },
      };

      expect(() => validateRemoteConfigSource(source)).toThrow('does not match validation pattern');
    });
  });

  describe('SSRF Protection', () => {
    describe('default security (HTTPS enforcement)', () => {
      it('should allow HTTPS URLs by default', () => {
        const source = {
          url: 'https://example.com/config.json',
        };

        expect(() => validateRemoteConfigSource(source)).not.toThrow();
      });

      it('should block HTTP URLs by default', () => {
        const source = {
          url: 'http://example.com/config.json',
        };

        expect(() => validateRemoteConfigSource(source)).toThrow('HTTPS is required for security');
      });

      it('should allow HTTP when enforceHttps is false', () => {
        const source = {
          url: 'http://example.com/config.json',
          security: {
            enforceHttps: false,
          },
        };

        expect(() => validateRemoteConfigSource(source)).not.toThrow();
      });
    });

    describe('private IP blocking', () => {
      it('should block localhost by default', () => {
        const source = {
          url: 'https://localhost/config.json',
        };

        expect(() => validateRemoteConfigSource(source)).toThrow(
          'Private IP addresses and localhost are blocked for security',
        );
      });

      it('should block 127.0.0.1 (loopback)', () => {
        const source = {
          url: 'https://127.0.0.1/config.json',
        };

        expect(() => validateRemoteConfigSource(source)).toThrow(
          'Private IP addresses and localhost are blocked for security',
        );
      });

      it('should block 10.x.x.x (private Class A)', () => {
        const source = {
          url: 'https://10.0.0.1/config.json',
        };

        expect(() => validateRemoteConfigSource(source)).toThrow(
          'Private IP addresses and localhost are blocked for security',
        );
      });

      it('should block 192.168.x.x (private Class C)', () => {
        const source = {
          url: 'https://192.168.1.1/config.json',
        };

        expect(() => validateRemoteConfigSource(source)).toThrow(
          'Private IP addresses and localhost are blocked for security',
        );
      });

      it('should block 172.16-31.x.x (private Class B)', () => {
        const source = {
          url: 'https://172.16.0.1/config.json',
        };

        expect(() => validateRemoteConfigSource(source)).toThrow(
          'Private IP addresses and localhost are blocked for security',
        );
      });

      it('should block 169.254.x.x (link-local)', () => {
        const source = {
          url: 'https://169.254.169.254/latest/meta-data/',
        };

        expect(() => validateRemoteConfigSource(source)).toThrow(
          'Private IP addresses and localhost are blocked for security',
        );
      });

      it('should block *.localhost domains', () => {
        const source = {
          url: 'https://api.localhost/config.json',
        };

        expect(() => validateRemoteConfigSource(source)).toThrow(
          'Private IP addresses and localhost are blocked for security',
        );
      });

      it('should allow private IPs when allowPrivateIPs is true', () => {
        const source = {
          url: 'https://192.168.1.1/config.json',
          security: {
            allowPrivateIPs: true,
          },
        };

        expect(() => validateRemoteConfigSource(source)).not.toThrow();
      });

      it('should allow localhost when allowPrivateIPs is true', () => {
        const source = {
          url: 'https://localhost/config.json',
          security: {
            allowPrivateIPs: true,
          },
        };

        expect(() => validateRemoteConfigSource(source)).not.toThrow();
      });
    });

    describe('IPv6 SSRF protection', () => {
      it('should block IPv6 loopback (::1)', () => {
        const source = {
          url: 'https://[::1]/config.json',
        };

        expect(() => validateRemoteConfigSource(source)).toThrow(
          'Private IP addresses and localhost are blocked for security',
        );
      });

      it('should block IPv6 loopback compressed (::)', () => {
        const source = {
          url: 'https://[::]/config.json',
        };

        expect(() => validateRemoteConfigSource(source)).toThrow(
          'Private IP addresses and localhost are blocked for security',
        );
      });

      it('should block IPv6 loopback full notation', () => {
        const source = {
          url: 'https://[0:0:0:0:0:0:0:1]/config.json',
        };

        expect(() => validateRemoteConfigSource(source)).toThrow(
          'Private IP addresses and localhost are blocked for security',
        );
      });

      it('should block IPv4-mapped IPv6 loopback (::ffff:127.0.0.1)', () => {
        const source = {
          url: 'https://[::ffff:127.0.0.1]/config.json',
        };

        expect(() => validateRemoteConfigSource(source)).toThrow(
          'Private IP addresses and localhost are blocked for security',
        );
      });

      it('should block IPv4-mapped IPv6 private IP (::ffff:10.0.0.1)', () => {
        const source = {
          url: 'https://[::ffff:10.0.0.1]/config.json',
        };

        expect(() => validateRemoteConfigSource(source)).toThrow(
          'Private IP addresses and localhost are blocked for security',
        );
      });

      it('should block IPv4-mapped IPv6 private IP (::ffff:192.168.1.1)', () => {
        const source = {
          url: 'https://[::ffff:192.168.1.1]/config.json',
        };

        expect(() => validateRemoteConfigSource(source)).toThrow(
          'Private IP addresses and localhost are blocked for security',
        );
      });

      it('should block IPv4-mapped IPv6 link-local (::ffff:169.254.169.254)', () => {
        const source = {
          url: 'https://[::ffff:169.254.169.254]/latest/meta-data/',
        };

        expect(() => validateRemoteConfigSource(source)).toThrow(
          'Private IP addresses and localhost are blocked for security',
        );
      });

      it('should block IPv4-compatible IPv6 loopback (::127.0.0.1)', () => {
        const source = {
          url: 'https://[::127.0.0.1]/config.json',
        };

        expect(() => validateRemoteConfigSource(source)).toThrow(
          'Private IP addresses and localhost are blocked for security',
        );
      });

      it('should block IPv6 link-local (fe80::1)', () => {
        const source = {
          url: 'https://[fe80::1]/config.json',
        };

        expect(() => validateRemoteConfigSource(source)).toThrow(
          'Private IP addresses and localhost are blocked for security',
        );
      });

      it('should block IPv6 unique local (fc00::1)', () => {
        const source = {
          url: 'https://[fc00::1]/config.json',
        };

        expect(() => validateRemoteConfigSource(source)).toThrow(
          'Private IP addresses and localhost are blocked for security',
        );
      });

      it('should block IPv6 unique local (fd00::1)', () => {
        const source = {
          url: 'https://[fd00::1]/config.json',
        };

        expect(() => validateRemoteConfigSource(source)).toThrow(
          'Private IP addresses and localhost are blocked for security',
        );
      });

      it('should allow IPv6 when allowPrivateIPs is true', () => {
        const source = {
          url: 'https://[::1]/config.json',
          security: {
            allowPrivateIPs: true,
          },
        };

        expect(() => validateRemoteConfigSource(source)).not.toThrow();
      });

      it('should allow public IPv6 addresses', () => {
        const source = {
          url: 'https://[2001:4860:4860::8888]/config.json', // Google DNS
        };

        expect(() => validateRemoteConfigSource(source)).not.toThrow();
      });
    });

    describe('protocol validation', () => {
      it('should block non-HTTP/HTTPS protocols', () => {
        const source = {
          url: 'file:///etc/passwd',
          security: {
            enforceHttps: false,
          },
        };

        expect(() => validateRemoteConfigSource(source)).toThrow('Invalid URL protocol');
      });

      it('should block FTP protocol', () => {
        const source = {
          url: 'ftp://example.com/config.json',
          security: {
            enforceHttps: false,
          },
        };

        expect(() => validateRemoteConfigSource(source)).toThrow('Invalid URL protocol');
      });
    });

    describe('environment variable interpolation with security', () => {
      it('should validate URL after env var interpolation', () => {
        process.env.TEST_HOST = '127.0.0.1';

        const source = {
          // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional test data string
          url: 'https://${TEST_HOST}/config.json',
        };

        expect(() => validateRemoteConfigSource(source)).toThrow(
          'Private IP addresses and localhost are blocked for security',
        );

        delete process.env.TEST_HOST;
      });

      it('should allow safe URLs after env var interpolation', () => {
        process.env.TEST_HOST = 'api.example.com';

        const source = {
          // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional test data string
          url: 'https://${TEST_HOST}/config.json',
        };

        expect(() => validateRemoteConfigSource(source)).not.toThrow();

        delete process.env.TEST_HOST;
      });
    });

    describe('combined security and validation', () => {
      it('should enforce both SSRF protection and custom validation', () => {
        const source = {
          url: 'https://example.com/config.json',
          validation: {
            url: '^https://example\\.com/.*',
          },
        };

        expect(() => validateRemoteConfigSource(source)).not.toThrow();
      });

      it('should fail SSRF check before custom validation', () => {
        const source = {
          url: 'https://127.0.0.1/config.json',
          validation: {
            url: '.*', // This would pass but SSRF check should fail first
          },
        };

        expect(() => validateRemoteConfigSource(source)).toThrow(
          'Private IP addresses and localhost are blocked for security',
        );
      });

      it('should pass SSRF but fail custom validation', () => {
        const source = {
          url: 'https://evil.com/config.json',
          validation: {
            url: '^https://example\\.com/.*',
          },
        };

        expect(() => validateRemoteConfigSource(source)).toThrow(
          'does not match validation pattern',
        );
      });
    });

    describe('error messages', () => {
      it('should provide helpful error message for HTTP block', () => {
        const source = {
          url: 'http://example.com/config.json',
        };

        expect(() => validateRemoteConfigSource(source)).toThrow(
          'Set security.enforceHttps: false to allow HTTP',
        );
      });

      it('should provide helpful error message for private IP block', () => {
        const source = {
          url: 'https://192.168.1.1/config.json',
        };

        expect(() => validateRemoteConfigSource(source)).toThrow(
          'Set security.allowPrivateIPs: true to allow internal networks',
        );
      });
    });
  });

  describe('remoteConfigs schema validation', () => {
    it('should validate config with remoteConfigs', () => {
      const config = {
        mcpServers: {
          'local-server': {
            command: 'node',
            args: ['server.js'],
          },
        },
        remoteConfigs: [
          {
            url: 'https://example.com/mcp-config.json',
            headers: {
              Authorization: 'Bearer token',
            },
            mergeStrategy: 'local-priority' as const,
          },
        ],
      };

      const result = ClaudeCodeMcpConfigSchema.parse(config);
      expect(result.remoteConfigs).toBeDefined();
      expect(result.remoteConfigs?.[0].url).toBe('https://example.com/mcp-config.json');
    });

    it('should validate config with multiple remoteConfigs', () => {
      const config = {
        mcpServers: {},
        remoteConfigs: [
          {
            url: 'https://example1.com/config.json',
            mergeStrategy: 'local-priority' as const,
          },
          {
            url: 'https://example2.com/config.json',
            mergeStrategy: 'remote-priority' as const,
          },
          {
            url: 'https://example3.com/config.json',
            mergeStrategy: 'merge-deep' as const,
          },
        ],
      };

      const result = ClaudeCodeMcpConfigSchema.parse(config);
      expect(result.remoteConfigs).toHaveLength(3);
    });

    it('should validate remoteConfig with validation rules', () => {
      const config = {
        mcpServers: {},
        remoteConfigs: [
          {
            url: 'https://example.com/config.json',
            headers: {
              Authorization: 'Bearer token',
            },
            validation: {
              url: '^https://.*',
              headers: {
                Authorization: '^Bearer .*',
              },
            },
            mergeStrategy: 'local-priority' as const,
          },
        ],
      };

      const result = ClaudeCodeMcpConfigSchema.parse(config);
      expect(result.remoteConfigs?.[0].validation).toBeDefined();
      expect(result.remoteConfigs?.[0].validation?.url).toBe('^https://.*');
      expect(result.remoteConfigs?.[0].validation?.headers?.Authorization).toBe('^Bearer .*');
    });

    it('should validate config without remoteConfigs (optional field)', () => {
      const config = {
        mcpServers: {
          'local-server': {
            command: 'node',
            args: ['server.js'],
          },
        },
      };

      const result = ClaudeCodeMcpConfigSchema.parse(config);
      expect(result.remoteConfigs).toBeUndefined();
    });

    it('should throw error for invalid merge strategy', () => {
      const config = {
        mcpServers: {},
        remoteConfigs: [
          {
            url: 'https://example.com/config.json',
            mergeStrategy: 'invalid-strategy',
          },
        ],
      };

      expect(() => ClaudeCodeMcpConfigSchema.parse(config)).toThrow(ZodError);
    });
  });
});
