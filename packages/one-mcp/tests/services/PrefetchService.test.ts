/**
 * PrefetchService Tests
 *
 * TESTING PATTERNS:
 * - Unit tests with mocked dependencies
 * - Test each method independently
 * - Cover success cases, edge cases, and error handling
 *
 * CODING STANDARDS:
 * - Use descriptive test names (should...)
 * - Arrange-Act-Assert pattern
 * - Mock external dependencies
 * - Test behavior, not implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PrefetchService } from '../../src/services/PrefetchService';
import type { RemoteMcpConfiguration } from '../../src/types';

// Mock child_process spawn
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';

/**
 * Interface for mock child process used in tests
 */
interface MockChildProcess extends EventEmitter {
  stdout: EventEmitter;
  stderr: EventEmitter;
}

/**
 * Helper to create a mock child process
 * @param exitCode - Exit code to emit on close
 * @param stdout - Optional stdout output
 * @param stderr - Optional stderr output
 * @returns Mock child process with stdout/stderr emitters
 */
function createMockProcess(exitCode: number, stdout = '', stderr = ''): MockChildProcess {
  const proc = new EventEmitter() as MockChildProcess;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();

  // Simulate async process execution
  setTimeout(() => {
    if (stdout) proc.stdout.emit('data', Buffer.from(stdout));
    if (stderr) proc.stderr.emit('data', Buffer.from(stderr));
    proc.emit('close', exitCode);
  }, 10);

  return proc;
}

describe('PrefetchService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('extractPackages', () => {
    it('should extract npx packages from config', () => {
      const config: RemoteMcpConfiguration = {
        mcpServers: {
          'mcp-server': {
            name: 'mcp-server',
            transport: 'stdio',
            config: {
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-filesystem'],
            },
          },
        },
      };

      const service = new PrefetchService({ mcpConfig: config });
      const packages = service.extractPackages();

      expect(packages).toHaveLength(1);
      expect(packages[0]).toEqual({
        serverName: 'mcp-server',
        packageManager: 'npx',
        packageName: '@modelcontextprotocol/server-filesystem',
        fullCommand: ['npx', '--yes', '@modelcontextprotocol/server-filesystem'],
      });
    });

    it('should extract pnpx packages from config', () => {
      const config: RemoteMcpConfiguration = {
        mcpServers: {
          'pnpm-server': {
            name: 'pnpm-server',
            transport: 'stdio',
            config: {
              command: 'pnpx',
              args: ['some-package'],
            },
          },
        },
      };

      const service = new PrefetchService({ mcpConfig: config });
      const packages = service.extractPackages();

      expect(packages).toHaveLength(1);
      expect(packages[0]).toEqual({
        serverName: 'pnpm-server',
        packageManager: 'pnpx',
        packageName: 'some-package',
        fullCommand: ['pnpx', '--yes', 'some-package'],
      });
    });

    it('should extract uvx packages from config', () => {
      const config: RemoteMcpConfiguration = {
        mcpServers: {
          'python-server': {
            name: 'python-server',
            transport: 'stdio',
            config: {
              command: 'uvx',
              args: ['mcp-server-fetch'],
            },
          },
        },
      };

      const service = new PrefetchService({ mcpConfig: config });
      const packages = service.extractPackages();

      expect(packages).toHaveLength(1);
      expect(packages[0]).toEqual({
        serverName: 'python-server',
        packageManager: 'uvx',
        packageName: 'mcp-server-fetch',
        fullCommand: ['uvx', 'mcp-server-fetch'],
      });
    });

    it('should extract uv run packages from config', () => {
      const config: RemoteMcpConfiguration = {
        mcpServers: {
          'uv-server': {
            name: 'uv-server',
            transport: 'stdio',
            config: {
              command: 'uv',
              args: ['run', 'mcp-server-tool'],
            },
          },
        },
      };

      const service = new PrefetchService({ mcpConfig: config });
      const packages = service.extractPackages();

      expect(packages).toHaveLength(1);
      expect(packages[0]).toEqual({
        serverName: 'uv-server',
        packageManager: 'uv',
        packageName: 'mcp-server-tool',
        fullCommand: ['uv', 'tool', 'install', 'mcp-server-tool'],
      });
    });

    it('should handle command paths with full path prefix', () => {
      const config: RemoteMcpConfiguration = {
        mcpServers: {
          'full-path-server': {
            name: 'full-path-server',
            transport: 'stdio',
            config: {
              command: '/usr/local/bin/npx',
              args: ['some-package'],
            },
          },
        },
      };

      const service = new PrefetchService({ mcpConfig: config });
      const packages = service.extractPackages();

      expect(packages).toHaveLength(1);
      expect(packages[0].packageManager).toBe('npx');
      expect(packages[0].packageName).toBe('some-package');
    });

    it('should skip non-stdio transport servers', () => {
      const config: RemoteMcpConfiguration = {
        mcpServers: {
          'http-server': {
            name: 'http-server',
            transport: 'http',
            config: {
              url: 'http://localhost:3000',
            },
          },
          'sse-server': {
            name: 'sse-server',
            transport: 'sse',
            config: {
              url: 'http://localhost:3001',
            },
          },
        },
      };

      const service = new PrefetchService({ mcpConfig: config });
      const packages = service.extractPackages();

      expect(packages).toHaveLength(0);
    });

    it('should skip disabled servers', () => {
      const config: RemoteMcpConfiguration = {
        mcpServers: {
          'enabled-server': {
            name: 'enabled-server',
            transport: 'stdio',
            config: {
              command: 'npx',
              args: ['enabled-package'],
            },
          },
          'disabled-server': {
            name: 'disabled-server',
            transport: 'stdio',
            disabled: true,
            config: {
              command: 'npx',
              args: ['disabled-package'],
            },
          },
        },
      };

      const service = new PrefetchService({ mcpConfig: config });
      const packages = service.extractPackages();

      expect(packages).toHaveLength(1);
      expect(packages[0].packageName).toBe('enabled-package');
    });

    it('should skip unsupported commands', () => {
      const config: RemoteMcpConfiguration = {
        mcpServers: {
          'node-server': {
            name: 'node-server',
            transport: 'stdio',
            config: {
              command: 'node',
              args: ['server.js'],
            },
          },
        },
      };

      const service = new PrefetchService({ mcpConfig: config });
      const packages = service.extractPackages();

      expect(packages).toHaveLength(0);
    });

    it('should filter packages by package manager type', () => {
      const config: RemoteMcpConfiguration = {
        mcpServers: {
          'npx-server': {
            name: 'npx-server',
            transport: 'stdio',
            config: {
              command: 'npx',
              args: ['package-a'],
            },
          },
          'uvx-server': {
            name: 'uvx-server',
            transport: 'stdio',
            config: {
              command: 'uvx',
              args: ['package-b'],
            },
          },
        },
      };

      const service = new PrefetchService({ mcpConfig: config, filter: 'npx' });
      const packages = service.extractPackages();

      expect(packages).toHaveLength(1);
      expect(packages[0].packageManager).toBe('npx');
    });

    it('should extract multiple packages from config', () => {
      const config: RemoteMcpConfiguration = {
        mcpServers: {
          'server-1': {
            name: 'server-1',
            transport: 'stdio',
            config: {
              command: 'npx',
              args: ['package-1'],
            },
          },
          'server-2': {
            name: 'server-2',
            transport: 'stdio',
            config: {
              command: 'pnpx',
              args: ['package-2'],
            },
          },
          'server-3': {
            name: 'server-3',
            transport: 'stdio',
            config: {
              command: 'uvx',
              args: ['package-3'],
            },
          },
        },
      };

      const service = new PrefetchService({ mcpConfig: config });
      const packages = service.extractPackages();

      expect(packages).toHaveLength(3);
    });

    it('should skip flags when extracting package name', () => {
      const config: RemoteMcpConfiguration = {
        mcpServers: {
          'server-with-flags': {
            name: 'server-with-flags',
            transport: 'stdio',
            config: {
              command: 'npx',
              args: ['-y', '--quiet', 'actual-package', '--arg1'],
            },
          },
        },
      };

      const service = new PrefetchService({ mcpConfig: config });
      const packages = service.extractPackages();

      expect(packages).toHaveLength(1);
      expect(packages[0].packageName).toBe('actual-package');
    });

    it('should extract package from --package=value pattern', () => {
      const config: RemoteMcpConfiguration = {
        mcpServers: {
          'package-flag-server': {
            name: 'package-flag-server',
            transport: 'stdio',
            config: {
              command: 'npx',
              args: ['--package=@scope/my-package', 'run-command'],
            },
          },
        },
      };

      const service = new PrefetchService({ mcpConfig: config });
      const packages = service.extractPackages();

      expect(packages).toHaveLength(1);
      expect(packages[0].packageName).toBe('@scope/my-package');
    });

    it('should extract package from --package value pattern', () => {
      const config: RemoteMcpConfiguration = {
        mcpServers: {
          'package-flag-space-server': {
            name: 'package-flag-space-server',
            transport: 'stdio',
            config: {
              command: 'npx',
              args: ['--package', 'my-package', 'run-command'],
            },
          },
        },
      };

      const service = new PrefetchService({ mcpConfig: config });
      const packages = service.extractPackages();

      expect(packages).toHaveLength(1);
      expect(packages[0].packageName).toBe('my-package');
    });

    it('should extract package from -p value pattern (short form)', () => {
      const config: RemoteMcpConfiguration = {
        mcpServers: {
          'short-flag-server': {
            name: 'short-flag-server',
            transport: 'stdio',
            config: {
              command: 'npx',
              args: ['-p', '@org/package', 'script'],
            },
          },
        },
      };

      const service = new PrefetchService({ mcpConfig: config });
      const packages = service.extractPackages();

      expect(packages).toHaveLength(1);
      expect(packages[0].packageName).toBe('@org/package');
    });

    it('should handle scoped packages with version specifiers', () => {
      const config: RemoteMcpConfiguration = {
        mcpServers: {
          'versioned-server': {
            name: 'versioned-server',
            transport: 'stdio',
            config: {
              command: 'npx',
              args: ['-y', '@scope/package@1.2.3'],
            },
          },
        },
      };

      const service = new PrefetchService({ mcpConfig: config });
      const packages = service.extractPackages();

      expect(packages).toHaveLength(1);
      expect(packages[0].packageName).toBe('@scope/package@1.2.3');
    });

    it('should return null for --package= with empty value', () => {
      const config: RemoteMcpConfiguration = {
        mcpServers: {
          'empty-package-server': {
            name: 'empty-package-server',
            transport: 'stdio',
            config: {
              command: 'npx',
              args: ['--package='],
            },
          },
        },
      };

      const service = new PrefetchService({ mcpConfig: config });
      const packages = service.extractPackages();

      expect(packages).toHaveLength(0);
    });

    it('should fallback when --package flag has no value (followed by another flag)', () => {
      const config: RemoteMcpConfiguration = {
        mcpServers: {
          'flag-no-value-server': {
            name: 'flag-no-value-server',
            transport: 'stdio',
            config: {
              command: 'npx',
              args: ['--package', '--yes', 'fallback-package'],
            },
          },
        },
      };

      const service = new PrefetchService({ mcpConfig: config });
      const packages = service.extractPackages();

      expect(packages).toHaveLength(1);
      expect(packages[0].packageName).toBe('fallback-package');
    });

    it('should return empty array when no packages found', () => {
      const config: RemoteMcpConfiguration = {
        mcpServers: {},
      };

      const service = new PrefetchService({ mcpConfig: config });
      const packages = service.extractPackages();

      expect(packages).toHaveLength(0);
    });
  });

  describe('prefetch', () => {
    it('should return empty summary when no packages to prefetch', async () => {
      const config: RemoteMcpConfiguration = {
        mcpServers: {},
      };

      const service = new PrefetchService({ mcpConfig: config });
      const summary = await service.prefetch();

      expect(summary).toEqual({
        totalPackages: 0,
        successful: 0,
        failed: 0,
        results: [],
      });
    });

    it('should prefetch packages sequentially by default', async () => {
      const mockSpawn = vi.mocked(spawn);
      mockSpawn.mockImplementation(() => createMockProcess(0, 'Success'));

      const config: RemoteMcpConfiguration = {
        mcpServers: {
          'server-1': {
            name: 'server-1',
            transport: 'stdio',
            config: {
              command: 'npx',
              args: ['package-1'],
            },
          },
          'server-2': {
            name: 'server-2',
            transport: 'stdio',
            config: {
              command: 'npx',
              args: ['package-2'],
            },
          },
        },
      };

      const service = new PrefetchService({ mcpConfig: config });
      const summary = await service.prefetch();

      expect(summary.totalPackages).toBe(2);
      expect(summary.successful).toBe(2);
      expect(summary.failed).toBe(0);
      expect(mockSpawn).toHaveBeenCalledTimes(2);
    });

    it('should prefetch packages in parallel when parallel option is true', async () => {
      const mockSpawn = vi.mocked(spawn);
      mockSpawn.mockImplementation(() => createMockProcess(0, 'Success'));

      const config: RemoteMcpConfiguration = {
        mcpServers: {
          'server-1': {
            name: 'server-1',
            transport: 'stdio',
            config: {
              command: 'npx',
              args: ['package-1'],
            },
          },
          'server-2': {
            name: 'server-2',
            transport: 'stdio',
            config: {
              command: 'npx',
              args: ['package-2'],
            },
          },
        },
      };

      const service = new PrefetchService({ mcpConfig: config, parallel: true });
      const summary = await service.prefetch();

      expect(summary.totalPackages).toBe(2);
      expect(summary.successful).toBe(2);
      expect(summary.failed).toBe(0);
    });

    it('should handle failed prefetch commands', async () => {
      const mockSpawn = vi.mocked(spawn);
      mockSpawn.mockImplementation(() => createMockProcess(1, '', 'Package not found'));

      const config: RemoteMcpConfiguration = {
        mcpServers: {
          'failing-server': {
            name: 'failing-server',
            transport: 'stdio',
            config: {
              command: 'npx',
              args: ['non-existent-package'],
            },
          },
        },
      };

      const service = new PrefetchService({ mcpConfig: config });
      const summary = await service.prefetch();

      expect(summary.totalPackages).toBe(1);
      expect(summary.successful).toBe(0);
      expect(summary.failed).toBe(1);
      expect(summary.results[0].success).toBe(false);
      expect(summary.results[0].output).toBe('Package not found');
    });

    it('should handle spawn errors', async () => {
      const mockSpawn = vi.mocked(spawn);
      mockSpawn.mockImplementation(() => {
        const proc = new EventEmitter() as MockChildProcess;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        setTimeout(() => {
          proc.emit('error', new Error('Command not found'));
        }, 10);
        return proc;
      });

      const config: RemoteMcpConfiguration = {
        mcpServers: {
          'error-server': {
            name: 'error-server',
            transport: 'stdio',
            config: {
              command: 'npx',
              args: ['some-package'],
            },
          },
        },
      };

      const service = new PrefetchService({ mcpConfig: config });
      const summary = await service.prefetch();

      expect(summary.totalPackages).toBe(1);
      expect(summary.failed).toBe(1);
      expect(summary.results[0].output).toBe('Command not found');
    });

    it('should include package info in results', async () => {
      const mockSpawn = vi.mocked(spawn);
      mockSpawn.mockImplementation(() => createMockProcess(0, 'Installed'));

      const config: RemoteMcpConfiguration = {
        mcpServers: {
          'test-server': {
            name: 'test-server',
            transport: 'stdio',
            config: {
              command: 'npx',
              args: ['test-package'],
            },
          },
        },
      };

      const service = new PrefetchService({ mcpConfig: config });
      const summary = await service.prefetch();

      expect(summary.results[0].package).toEqual({
        serverName: 'test-server',
        packageManager: 'npx',
        packageName: 'test-package',
        fullCommand: ['npx', '--yes', 'test-package'],
      });
    });
  });
});
