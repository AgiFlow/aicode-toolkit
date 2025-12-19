/**
 * PrefetchService Types
 *
 * Type definitions for the PrefetchService service.
 */

import type { RemoteMcpConfiguration } from '../../types';

/**
 * Package manager types that support prefetching
 * - npx: Node.js package runner (npm)
 * - pnpx: Node.js package runner (pnpm)
 * - uvx: Python package runner (uv)
 * - uv: Python package manager with 'run' subcommand
 */
export type PackageManager = 'npx' | 'pnpx' | 'uvx' | 'uv';

/**
 * Configuration options for PrefetchService
 */
export interface PrefetchServiceConfig {
  /**
   * MCP configuration containing server definitions
   */
  mcpConfig: RemoteMcpConfiguration;

  /**
   * Filter by package manager type
   */
  filter?: PackageManager;

  /**
   * Run prefetch commands in parallel
   * @default false
   */
  parallel?: boolean;
}

/**
 * Package info extracted from server config
 */
export interface PackageInfo {
  /**
   * Name of the MCP server
   */
  serverName: string;

  /**
   * Package manager used (npx, uvx, uv)
   */
  packageManager: PackageManager;

  /**
   * Package name to prefetch
   */
  packageName: string;

  /**
   * Full command to execute for prefetching
   */
  fullCommand: string[];
}

/**
 * Result of a single package prefetch operation
 */
export interface PrefetchResult {
  /**
   * Package info that was prefetched
   */
  package: PackageInfo;

  /**
   * Whether the prefetch was successful
   */
  success: boolean;

  /**
   * Output from the prefetch command
   */
  output: string;
}

/**
 * Summary result returned by PrefetchService operations
 */
export interface PrefetchSummary {
  /**
   * Total packages found
   */
  totalPackages: number;

  /**
   * Number of successful prefetches
   */
  successful: number;

  /**
   * Number of failed prefetches
   */
  failed: number;

  /**
   * Individual results for each package
   */
  results: PrefetchResult[];
}
