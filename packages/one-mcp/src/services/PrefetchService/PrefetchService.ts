/**
 * PrefetchService
 *
 * DESIGN PATTERNS:
 * - Service pattern for business logic encapsulation
 * - Single responsibility principle
 *
 * CODING STANDARDS:
 * - Use async/await for asynchronous operations
 * - Throw descriptive errors for error cases
 * - Keep methods focused and well-named
 * - Document complex logic with comments
 *
 * AVOID:
 * - Mixing concerns (keep focused on single domain)
 * - Direct tool implementation (services should be tool-agnostic)
 */

import { spawn } from 'node:child_process';
import type { McpStdioConfig, McpServerTransportConfig } from '../../types';
import type {
  PrefetchServiceConfig,
  PackageInfo,
  PrefetchResult,
  PrefetchSummary,
} from './types';
import {
  TRANSPORT_STDIO,
  COMMAND_NPX,
  COMMAND_NPM,
  COMMAND_PNPX,
  COMMAND_PNPM,
  COMMAND_UVX,
  COMMAND_UV,
  COMMAND_NPX_SUFFIX,
  COMMAND_PNPX_SUFFIX,
  COMMAND_UVX_SUFFIX,
  COMMAND_UV_SUFFIX,
  ARG_RUN,
  ARG_TOOL,
  ARG_INSTALL,
  ARG_ADD,
  ARG_GLOBAL,
  FLAG_PREFIX,
  FLAG_PACKAGE_LONG,
  FLAG_PACKAGE_SHORT,
  EQUALS_DELIMITER,
  VALID_PACKAGE_NAME_PATTERN,
  PLATFORM_WIN32,
  EXIT_CODE_SUCCESS,
  STDIO_IGNORE,
  STDIO_PIPE,
} from './constants';

/**
 * Type guard to check if a config object is an McpStdioConfig
 * @param config - Config object to check
 * @returns True if config has required McpStdioConfig properties
 */
function isMcpStdioConfig(config: McpServerTransportConfig): config is McpStdioConfig {
  return typeof config === 'object' && config !== null && 'command' in config;
}

/**
 * PrefetchService handles pre-downloading packages used by MCP servers.
 * Supports npx (Node.js), uvx (Python/uv), and uv run commands.
 *
 * @example
 * ```typescript
 * const service = new PrefetchService({
 *   mcpConfig: await configFetcher.fetchConfiguration(),
 *   parallel: true,
 * });
 * const packages = service.extractPackages();
 * const summary = await service.prefetch();
 * ```
 */
export class PrefetchService {
  private config: PrefetchServiceConfig;

  /**
   * Creates a new PrefetchService instance
   * @param config - Service configuration options
   */
  constructor(config: PrefetchServiceConfig) {
    this.config = config;
  }

  /**
   * Extract all prefetchable packages from the MCP configuration
   * @returns Array of package info objects
   */
  extractPackages(): PackageInfo[] {
    const packages: PackageInfo[] = [];
    const { mcpConfig, filter } = this.config;

    for (const [serverName, serverConfig] of Object.entries(mcpConfig.mcpServers)) {
      // Skip disabled servers
      if (serverConfig.disabled) continue;

      // Only process stdio transport servers
      if (serverConfig.transport !== TRANSPORT_STDIO) continue;

      // Use type guard for safe type checking
      if (!isMcpStdioConfig(serverConfig.config)) continue;

      const packageInfo = this.extractPackageInfo(serverName, serverConfig.config);
      if (packageInfo) {
        // Apply filter if specified
        if (filter && packageInfo.packageManager !== filter) {
          continue;
        }
        packages.push(packageInfo);
      }
    }

    return packages;
  }

  /**
   * Prefetch all packages from the configuration
   * @returns Summary of prefetch results
   * @throws Error if prefetch operation fails unexpectedly
   */
  async prefetch(): Promise<PrefetchSummary> {
    try {
      const packages = this.extractPackages();
      const results: PrefetchResult[] = [];

      if (packages.length === 0) {
        return {
          totalPackages: 0,
          successful: 0,
          failed: 0,
          results: [],
        };
      }

      if (this.config.parallel) {
        // Run all prefetch commands in parallel
        const promises = packages.map(async (pkg) => this.prefetchPackage(pkg));
        results.push(...(await Promise.all(promises)));
      } else {
        // Run prefetch commands sequentially
        for (const pkg of packages) {
          const result = await this.prefetchPackage(pkg);
          results.push(result);
        }
      }

      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      return {
        totalPackages: packages.length,
        successful,
        failed,
        results,
      };
    } catch (error) {
      throw new Error(
        `Failed to prefetch packages: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Prefetch a single package
   * @param pkg - Package info to prefetch
   * @returns Result of the prefetch operation
   */
  private async prefetchPackage(pkg: PackageInfo): Promise<PrefetchResult> {
    try {
      const [command, ...args] = pkg.fullCommand;
      const result = await this.runCommand(command, args);

      return {
        package: pkg,
        success: result.success,
        output: result.output,
      };
    } catch (error) {
      return {
        package: pkg,
        success: false,
        output: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Validate package name to prevent command injection
   * @param packageName - Package name to validate
   * @returns True if package name is safe, false otherwise
   * @remarks Rejects package names containing shell metacharacters
   * @example
   * isValidPackageName('@scope/package') // true
   * isValidPackageName('my-package@1.0.0') // true
   * isValidPackageName('pkg; rm -rf /') // false (shell injection)
   * isValidPackageName('pkg$(whoami)') // false (command substitution)
   */
  private isValidPackageName(packageName: string): boolean {
    return VALID_PACKAGE_NAME_PATTERN.test(packageName);
  }

  /**
   * Extract package info from a server's stdio config
   * @param serverName - Name of the MCP server
   * @param config - Stdio configuration for the server
   * @returns Package info if extractable, null otherwise
   */
  private extractPackageInfo(serverName: string, config: McpStdioConfig): PackageInfo | null {
    const command = config.command.toLowerCase();
    const args = config.args || [];

    // Check for npx - use npm install -g to prefetch without running
    if (command === COMMAND_NPX || command.endsWith(COMMAND_NPX_SUFFIX)) {
      const packageName = this.extractNpxPackage(args);
      if (packageName && this.isValidPackageName(packageName)) {
        return {
          serverName,
          packageManager: COMMAND_NPX,
          packageName,
          fullCommand: [COMMAND_NPM, ARG_INSTALL, ARG_GLOBAL, packageName],
        };
      }
    }

    // Check for pnpx (pnpm's npx equivalent) - use pnpm add -g to prefetch without running
    if (command === COMMAND_PNPX || command.endsWith(COMMAND_PNPX_SUFFIX)) {
      const packageName = this.extractNpxPackage(args);
      if (packageName && this.isValidPackageName(packageName)) {
        return {
          serverName,
          packageManager: COMMAND_PNPX,
          packageName,
          fullCommand: [COMMAND_PNPM, ARG_ADD, ARG_GLOBAL, packageName],
        };
      }
    }

    // Check for uvx
    if (command === COMMAND_UVX || command.endsWith(COMMAND_UVX_SUFFIX)) {
      const packageName = this.extractUvxPackage(args);
      if (packageName && this.isValidPackageName(packageName)) {
        return {
          serverName,
          packageManager: COMMAND_UVX,
          packageName,
          fullCommand: [COMMAND_UVX, packageName],
        };
      }
    }

    // Check for uv run
    if ((command === COMMAND_UV || command.endsWith(COMMAND_UV_SUFFIX)) && args.includes(ARG_RUN)) {
      const packageName = this.extractUvRunPackage(args);
      if (packageName && this.isValidPackageName(packageName)) {
        return {
          serverName,
          packageManager: COMMAND_UV,
          packageName,
          fullCommand: [COMMAND_UV, ARG_TOOL, ARG_INSTALL, packageName],
        };
      }
    }

    return null;
  }

  /**
   * Extract package name from npx command args
   * @param args - Command arguments
   * @returns Package name or null
   * @remarks Handles --package=value, --package value, -p value patterns.
   *          Falls back to first non-flag argument if no --package/-p flag found.
   *          Returns null if flag has no value or is followed by another flag.
   *          When multiple --package flags exist, returns the first valid one.
   * @example
   * extractNpxPackage(['--package=@scope/pkg']) // returns '@scope/pkg'
   * extractNpxPackage(['--package', 'pkg-name']) // returns 'pkg-name'
   * extractNpxPackage(['-p', 'pkg']) // returns 'pkg'
   * extractNpxPackage(['-y', 'pkg-name', '--flag']) // returns 'pkg-name' (fallback)
   * extractNpxPackage(['--package=']) // returns null (empty value)
   */
  private extractNpxPackage(args: string[]): string | null {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      // Handle --package=value pattern
      if (arg.startsWith(FLAG_PACKAGE_LONG + EQUALS_DELIMITER)) {
        return arg.slice(FLAG_PACKAGE_LONG.length + EQUALS_DELIMITER.length) || null;
      }

      // Handle --package value pattern (value in next arg)
      if (arg === FLAG_PACKAGE_LONG && i + 1 < args.length) {
        const nextArg = args[i + 1];
        if (!nextArg.startsWith(FLAG_PREFIX)) {
          return nextArg;
        }
      }

      // Handle -p value pattern (short form)
      if (arg === FLAG_PACKAGE_SHORT && i + 1 < args.length) {
        const nextArg = args[i + 1];
        if (!nextArg.startsWith(FLAG_PREFIX)) {
          return nextArg;
        }
      }
    }

    // Fallback for simple npx patterns like: npx -y package-name
    // where the package is the first positional argument
    for (const arg of args) {
      if (arg.startsWith(FLAG_PREFIX)) continue;
      return arg;
    }
    return null;
  }

  /**
   * Extract package name from uvx command args
   * @param args - Command arguments
   * @returns Package name or null
   * @remarks Assumes the first non-flag argument is the package name.
   *          Handles both single (-) and double (--) dash flags.
   * @example
   * extractUvxPackage(['mcp-server-fetch']) // returns 'mcp-server-fetch'
   * extractUvxPackage(['--quiet', 'pkg-name']) // returns 'pkg-name'
   */
  private extractUvxPackage(args: string[]): string | null {
    for (const arg of args) {
      // Skip flags (both single and double dash)
      if (arg.startsWith(FLAG_PREFIX)) continue;
      // Return the first non-flag argument as package name
      return arg;
    }
    return null;
  }

  /**
   * Extract package name from uv run command args
   * @param args - Command arguments
   * @returns Package name or null
   * @remarks Looks for the first non-flag argument after the 'run' subcommand.
   *          Returns null if 'run' is not found in args.
   * @example
   * extractUvRunPackage(['run', 'mcp-server']) // returns 'mcp-server'
   * extractUvRunPackage(['run', '--verbose', 'pkg']) // returns 'pkg'
   * extractUvRunPackage(['install', 'pkg']) // returns null (no 'run')
   */
  private extractUvRunPackage(args: string[]): string | null {
    const runIndex = args.indexOf(ARG_RUN);
    if (runIndex === -1) return null;

    // Look for package name after 'run'
    for (let i = runIndex + 1; i < args.length; i++) {
      const arg = args[i];
      // Skip flags
      if (arg.startsWith(FLAG_PREFIX)) continue;
      // Return the first non-flag argument as package name
      return arg;
    }
    return null;
  }

  /**
   * Run a shell command and capture output
   * @param command - Command to run
   * @param args - Command arguments
   * @returns Promise with success status and output
   */
  private runCommand(command: string, args: string[]): Promise<{ success: boolean; output: string }> {
    return new Promise((resolve) => {
      const proc = spawn(command, args, {
        stdio: [STDIO_IGNORE, STDIO_PIPE, STDIO_PIPE],
        // Use shell on Windows to resolve commands from PATH and handle .cmd/.bat scripts
        shell: process.platform === PLATFORM_WIN32,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        resolve({
          success: code === EXIT_CODE_SUCCESS,
          output: stdout || stderr,
        });
      });

      proc.on('error', (error) => {
        resolve({
          success: false,
          output: error.message,
        });
      });
    });
  }
}
