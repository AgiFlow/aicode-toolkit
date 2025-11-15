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
import { parseMcpConfig, validateRemoteConfigSource, type RemoteConfigSource, type ClaudeCodeMcpConfig } from '../utils/mcpConfigSchema';
import { RemoteConfigCacheService } from './RemoteConfigCacheService';

export interface ConfigFetcherOptions {
  configFilePath?: string;
  cacheTtlMs?: number;
  useCache?: boolean; // Whether to use cache (both read and write)
  remoteCacheTtlMs?: number; // TTL for remote config cache
}

/**
 * Service for fetching and caching MCP server configurations from local file and remote sources
 * Supports merging multiple remote configs with local config
 */
export class ConfigFetcherService {
  private configFilePath?: string;
  private cacheTtlMs: number;
  private cachedConfig: RemoteMcpConfiguration | null = null;
  private lastFetchTime: number = 0;
  private remoteConfigCache: RemoteConfigCacheService;

  constructor(options: ConfigFetcherOptions) {
    this.configFilePath = options.configFilePath;
    this.cacheTtlMs = options.cacheTtlMs || 60000; // Default 1 minute cache

    // Initialize remote config cache service
    const useCache = options.useCache !== undefined ? options.useCache : true;
    this.remoteConfigCache = new RemoteConfigCacheService({
      ttl: options.remoteCacheTtlMs || 60 * 60 * 1000, // Default 1 hour
      readEnabled: useCache,
      writeEnabled: true, // Always write to cache (even when --no-cache is used)
    });

    if (!this.configFilePath) {
      throw new Error('configFilePath must be provided');
    }
  }

  /**
   * Fetch MCP configuration from local file and remote sources with caching
   * Merges remote configs with local config based on merge strategy
   * @param forceRefresh - Force reload from source, bypassing cache
   */
  async fetchConfiguration(forceRefresh = false): Promise<RemoteMcpConfiguration> {
    const now = Date.now();

    // Return cached config if still valid and not forcing refresh
    if (!forceRefresh && this.cachedConfig && now - this.lastFetchTime < this.cacheTtlMs) {
      return this.cachedConfig;
    }

    // Load local configuration from file
    const localConfigData = await this.loadRawConfigFromFile();

    // Parse the raw config to get remoteConfigs array
    const parsedLocalData = localConfigData as ClaudeCodeMcpConfig;
    const remoteConfigSources = parsedLocalData.remoteConfigs || [];

    // Start with local config
    let mergedConfig = await this.parseConfig(localConfigData);

    // Fetch all remote configs in parallel
    const remoteConfigPromises = remoteConfigSources.map(async (remoteSource) => {
      try {
        // Validate remote source
        validateRemoteConfigSource(remoteSource);

        // Fetch remote config
        const remoteConfig = await this.loadFromUrl(remoteSource);

        // Return the config with its merge strategy
        return {
          config: remoteConfig,
          mergeStrategy: remoteSource.mergeStrategy || 'local-priority',
          url: remoteSource.url,
        };
      } catch (error) {
        if (error instanceof Error) {
          console.error(`Failed to fetch remote config from ${remoteSource.url}: ${error.message}`);
        }
        return null; // Return null for failed fetches
      }
    });

    // Wait for all remote configs to be fetched
    const remoteConfigResults = await Promise.all(remoteConfigPromises);

    // Merge all successfully fetched remote configs
    for (const result of remoteConfigResults) {
      if (result !== null) {
        mergedConfig = this.mergeConfigurations(mergedConfig, result.config, result.mergeStrategy);
      }
    }

    // Validate final configuration structure
    if (!mergedConfig.mcpServers || typeof mergedConfig.mcpServers !== 'object') {
      throw new Error('Invalid MCP configuration: missing or invalid mcpServers');
    }

    // Cache the configuration
    this.cachedConfig = mergedConfig;
    this.lastFetchTime = now;

    return mergedConfig;
  }

  /**
   * Load raw configuration data from a local file (supports JSON and YAML)
   * Returns unparsed config data to allow access to remoteConfigs
   */
  private async loadRawConfigFromFile(): Promise<any> {
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

      return rawConfig;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to load config file: ${error.message}`);
      }
      throw new Error('Failed to load config file: Unknown error');
    }
  }

  /**
   * Parse raw config data using Zod schema
   * Filters out remoteConfigs to avoid including them in the final config
   */
  private async parseConfig(rawConfig: any): Promise<RemoteMcpConfiguration> {
    try {
      // Remove remoteConfigs before parsing to avoid validation errors
      const { remoteConfigs, ...configWithoutRemote } = rawConfig;

      // Parse and transform using Zod schema
      return parseMcpConfig(configWithoutRemote) as RemoteMcpConfiguration;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to parse config: ${error.message}`);
      }
      throw new Error('Failed to parse config: Unknown error');
    }
  }

  /**
   * Load configuration from a remote URL with caching
   */
  private async loadFromUrl(source: RemoteConfigSource): Promise<RemoteMcpConfiguration> {
    try {
      // Interpolate environment variables in URL
      const interpolatedUrl = this.interpolateEnvVars(source.url);

      // Try to get from cache first
      const cachedConfig = await this.remoteConfigCache.get(interpolatedUrl);
      if (cachedConfig) {
        return cachedConfig;
      }

      // Cache miss - fetch from remote
      const interpolatedHeaders = source.headers
        ? Object.fromEntries(
            Object.entries(source.headers).map(([key, value]) => [
              key,
              this.interpolateEnvVars(value),
            ])
          )
        : {};

      const response = await fetch(interpolatedUrl, {
        headers: interpolatedHeaders,
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch remote config: ${response.status} ${response.statusText}`
        );
      }

      const rawConfig = await response.json();

      // Parse and transform using Zod schema
      const config = parseMcpConfig(rawConfig) as RemoteMcpConfiguration;

      // Cache the fetched config
      await this.remoteConfigCache.set(interpolatedUrl, config);

      return config;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch remote config from ${source.url}: ${error.message}`);
      }
      throw new Error(`Failed to fetch remote config from ${source.url}: Unknown error`);
    }
  }

  /**
   * Interpolate environment variables in a string
   * Supports ${VAR_NAME} syntax
   */
  private interpolateEnvVars(value: string): string {
    return value.replace(/\$\{([^}]+)\}/g, (_, varName) => {
      const envValue = process.env[varName];
      if (envValue === undefined) {
        console.warn(`Environment variable ${varName} is not defined, keeping placeholder`);
        return `\${${varName}}`;
      }
      return envValue;
    });
  }

  /**
   * Merge two MCP configurations based on the specified merge strategy
   * @param localConfig Configuration loaded from local file
   * @param remoteConfig Configuration loaded from remote URL
   * @param mergeStrategy Strategy for merging configs
   * @returns Merged configuration
   */
  private mergeConfigurations(
    localConfig: RemoteMcpConfiguration,
    remoteConfig: RemoteMcpConfiguration,
    mergeStrategy: 'local-priority' | 'remote-priority' | 'merge-deep'
  ): RemoteMcpConfiguration {
    switch (mergeStrategy) {
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
        throw new Error(`Unknown merge strategy: ${mergeStrategy}`);
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
