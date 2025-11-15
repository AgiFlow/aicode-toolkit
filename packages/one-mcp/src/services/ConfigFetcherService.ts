/**
 * ConfigFetcherService
 *
 * DESIGN PATTERNS:
 * - Service pattern for business logic encapsulation
 * - Single responsibility principle
 * - Caching pattern for performance optimization
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

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import yaml from 'js-yaml';
import type { RemoteMcpConfiguration } from '../types';
import { parseMcpConfig } from '../utils/mcpConfigSchema';

export interface ConfigFetcherOptions {
  configUrl?: string;
  configFilePath?: string;
  headers?: Record<string, string>;
  cacheTtlMs?: number;
  /**
   * Strategy for merging remote and local configs when both are provided
   * - 'local-priority': Local config overrides remote (default)
   * - 'remote-priority': Remote config overrides local
   * - 'merge-deep': Deep merge both configs (local overrides on conflict)
   */
  mergeStrategy?: 'local-priority' | 'remote-priority' | 'merge-deep';
}

/**
 * Service for fetching and caching MCP server configurations
 * Supports both remote URLs and local file paths
 */
export class ConfigFetcherService {
  private configUrl?: string;
  private configFilePath?: string;
  private headers: Record<string, string>;
  private cacheTtlMs: number;
  private cachedConfig: RemoteMcpConfiguration | null = null;
  private lastFetchTime: number = 0;
  private mergeStrategy: 'local-priority' | 'remote-priority' | 'merge-deep';

  constructor(options: ConfigFetcherOptions) {
    this.configUrl = options.configUrl;
    this.configFilePath = options.configFilePath;
    this.headers = options.headers || {};
    this.cacheTtlMs = options.cacheTtlMs || 60000; // Default 1 minute cache
    this.mergeStrategy = options.mergeStrategy || 'local-priority'; // Default to local overrides remote

    if (!this.configUrl && !this.configFilePath) {
      throw new Error(
        'Either configUrl or configFilePath must be provided',
      );
    }
  }

  /**
   * Fetch MCP configuration from remote URL or local file with caching
   * Supports merging both remote and local configurations based on mergeStrategy
   * @param forceRefresh - Force reload from source, bypassing cache
   */
  async fetchConfiguration(forceRefresh = false): Promise<RemoteMcpConfiguration> {
    const now = Date.now();

    // Return cached config if still valid and not forcing refresh
    if (!forceRefresh && this.cachedConfig && now - this.lastFetchTime < this.cacheTtlMs) {
      return this.cachedConfig;
    }

    let config: RemoteMcpConfiguration;

    // Load configurations from available sources
    const hasLocalConfig = !!this.configFilePath;
    const hasRemoteConfig = !!this.configUrl;

    if (hasLocalConfig && hasRemoteConfig) {
      // Both sources available - merge them
      const [localConfig, remoteConfig] = await Promise.all([
        this.loadFromFile(),
        this.loadFromUrl(),
      ]);
      config = this.mergeConfigurations(localConfig, remoteConfig);
    } else if (hasLocalConfig) {
      // Only local config
      config = await this.loadFromFile();
    } else if (hasRemoteConfig) {
      // Only remote config
      config = await this.loadFromUrl();
    } else {
      throw new Error('No configuration source available');
    }

    // Validate configuration structure
    if (!config.mcpServers || typeof config.mcpServers !== 'object') {
      throw new Error('Invalid MCP configuration: missing or invalid mcpServers');
    }

    // Cache the configuration
    this.cachedConfig = config;
    this.lastFetchTime = now;

    return config;
  }

  /**
   * Load configuration from a local file (supports JSON and YAML)
   */
  private async loadFromFile(): Promise<RemoteMcpConfiguration> {
    if (!this.configFilePath) {
      throw new Error('No config file path provided');
    }

    if (!existsSync(this.configFilePath)) {
      throw new Error(`Config file not found: ${this.configFilePath}`);
    }

    try {
      const content = await readFile(this.configFilePath, 'utf-8');
      let rawConfig: any;

      // Detect file format by extension
      const isYaml = this.configFilePath.endsWith('.yaml') || this.configFilePath.endsWith('.yml');

      if (isYaml) {
        rawConfig = yaml.load(content);
      } else {
        rawConfig = JSON.parse(content);
      }

      // Parse and transform using Zod schema
      return parseMcpConfig(rawConfig) as RemoteMcpConfiguration;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to load config file: ${error.message}`);
      }
      throw new Error('Failed to load config file: Unknown error');
    }
  }

  /**
   * Load configuration from a remote URL
   */
  private async loadFromUrl(): Promise<RemoteMcpConfiguration> {
    if (!this.configUrl) {
      throw new Error('No config URL provided');
    }

    try {
      const response = await fetch(this.configUrl, {
        headers: this.headers,
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch MCP configuration: ${response.status} ${response.statusText}`,
        );
      }

      const rawConfig = await response.json();

      // Parse and transform using Zod schema
      return parseMcpConfig(rawConfig) as RemoteMcpConfiguration;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch MCP configuration from URL: ${error.message}`);
      }
      throw new Error('Failed to fetch MCP configuration from URL: Unknown error');
    }
  }

  /**
   * Merge two MCP configurations based on the configured merge strategy
   * @param localConfig Configuration loaded from local file
   * @param remoteConfig Configuration loaded from remote URL
   * @returns Merged configuration
   */
  private mergeConfigurations(
    localConfig: RemoteMcpConfiguration,
    remoteConfig: RemoteMcpConfiguration,
  ): RemoteMcpConfiguration {
    switch (this.mergeStrategy) {
      case 'local-priority':
        // Local servers override remote servers with the same name
        return {
          mcpServers: {
            ...remoteConfig.mcpServers,
            ...localConfig.mcpServers,
          },
        };

      case 'remote-priority':
        // Remote servers override local servers with the same name
        return {
          mcpServers: {
            ...localConfig.mcpServers,
            ...remoteConfig.mcpServers,
          },
        };

      case 'merge-deep': {
        // Deep merge: combine both, local overrides on conflict
        const merged: Record<string, any> = { ...remoteConfig.mcpServers };

        // Merge local servers, performing deep merge for servers with the same name
        for (const [serverName, localServerConfig] of Object.entries(localConfig.mcpServers)) {
          if (merged[serverName]) {
            // Server exists in both - deep merge the config
            const remoteServer = merged[serverName];
            const mergedConfig: any = {
              ...remoteServer.config,
              ...localServerConfig.config,
            };

            // Deep merge nested objects like env, headers
            const remoteEnv = 'env' in remoteServer.config ? remoteServer.config.env : undefined;
            const localEnv =
              'env' in localServerConfig.config ? localServerConfig.config.env : undefined;
            if (remoteEnv || localEnv) {
              mergedConfig.env = {
                ...(remoteEnv || {}),
                ...(localEnv || {}),
              };
            }

            const remoteHeaders =
              'headers' in remoteServer.config ? remoteServer.config.headers : undefined;
            const localHeaders =
              'headers' in localServerConfig.config ? localServerConfig.config.headers : undefined;
            if (remoteHeaders || localHeaders) {
              mergedConfig.headers = {
                ...(remoteHeaders || {}),
                ...(localHeaders || {}),
              };
            }

            merged[serverName] = {
              ...remoteServer,
              ...localServerConfig,
              config: mergedConfig,
            };
          } else {
            // Server only in local - add it
            merged[serverName] = localServerConfig;
          }
        }

        return { mcpServers: merged };
      }

      default:
        throw new Error(`Unknown merge strategy: ${this.mergeStrategy}`);
    }
  }

  /**
   * Clear the cached configuration
   */
  clearCache(): void {
    this.cachedConfig = null;
    this.lastFetchTime = 0;
  }

  /**
   * Check if cache is valid
   */
  isCacheValid(): boolean {
    const now = Date.now();
    return this.cachedConfig !== null && now - this.lastFetchTime < this.cacheTtlMs;
  }
}
