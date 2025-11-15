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
  configFilePath?: string;
  cacheTtlMs?: number;
}

/**
 * Service for fetching and caching MCP server configurations from local file
 */
export class ConfigFetcherService {
  private configFilePath?: string;
  private cacheTtlMs: number;
  private cachedConfig: RemoteMcpConfiguration | null = null;
  private lastFetchTime: number = 0;

  constructor(options: ConfigFetcherOptions) {
    this.configFilePath = options.configFilePath;
    this.cacheTtlMs = options.cacheTtlMs || 60000; // Default 1 minute cache

    if (!this.configFilePath) {
      throw new Error('configFilePath must be provided');
    }
  }

  /**
   * Fetch MCP configuration from local file with caching
   * @param forceRefresh - Force reload from source, bypassing cache
   */
  async fetchConfiguration(forceRefresh = false): Promise<RemoteMcpConfiguration> {
    const now = Date.now();

    // Return cached config if still valid and not forcing refresh
    if (!forceRefresh && this.cachedConfig && now - this.lastFetchTime < this.cacheTtlMs) {
      return this.cachedConfig;
    }

    // Load configuration from file
    const config = await this.loadFromFile();

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
