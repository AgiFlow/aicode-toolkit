/**
 * RemoteConfigCacheService
 *
 * DESIGN PATTERNS:
 * - Service pattern for cache management
 * - Single responsibility principle
 * - File-based caching with TTL support
 *
 * CODING STANDARDS:
 * - Use async/await for asynchronous operations
 * - Handle file system errors gracefully
 * - Keep cache organized by URL hash
 * - Implement automatic cache expiration
 *
 * AVOID:
 * - Storing sensitive data in cache (headers with tokens)
 * - Unbounded cache growth
 * - Missing error handling for file operations
 */

import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { RemoteMcpConfiguration } from '../types';

interface CacheEntry {
  data: RemoteMcpConfiguration;
  timestamp: number;
  expiresAt: number;
  url: string;
}

/**
 * Service for caching remote MCP configurations
 */
export class RemoteConfigCacheService {
  private cacheDir: string;
  private cacheTTL: number; // Time to live in milliseconds
  private readEnabled: boolean; // Whether to read from cache
  private writeEnabled: boolean; // Whether to write to cache

  constructor(options?: {
    ttl?: number;
    readEnabled?: boolean;
    writeEnabled?: boolean;
  }) {
    this.cacheDir = join(tmpdir(), 'one-mcp-cache', 'remote-configs');
    this.cacheTTL = options?.ttl || 60 * 60 * 1000; // Default: 1 hour
    this.readEnabled = options?.readEnabled !== undefined ? options.readEnabled : true;
    this.writeEnabled = options?.writeEnabled !== undefined ? options.writeEnabled : true;
  }

  /**
   * Generate a hash key from remote config URL
   * Only uses URL for hashing to avoid caching credentials in the key
   */
  private generateCacheKey(url: string): string {
    // Generate SHA-256 hash of the URL
    return createHash('sha256').update(url).digest('hex');
  }

  /**
   * Get the cache file path for a given cache key
   */
  private getCacheFilePath(cacheKey: string): string {
    return join(this.cacheDir, `${cacheKey}.json`);
  }

  /**
   * Initialize cache directory
   */
  private async ensureCacheDir(): Promise<void> {
    if (!existsSync(this.cacheDir)) {
      await mkdir(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Get cached data for a remote config URL
   */
  async get(url: string): Promise<RemoteMcpConfiguration | null> {
    if (!this.readEnabled) {
      return null;
    }

    try {
      await this.ensureCacheDir();

      const cacheKey = this.generateCacheKey(url);
      const cacheFilePath = this.getCacheFilePath(cacheKey);

      if (!existsSync(cacheFilePath)) {
        return null;
      }

      const cacheContent = await readFile(cacheFilePath, 'utf-8');
      const cacheEntry: CacheEntry = JSON.parse(cacheContent);

      // Check if cache has expired
      const now = Date.now();
      if (now > cacheEntry.expiresAt) {
        // Cache expired, delete it
        await unlink(cacheFilePath).catch(() => {
          // Ignore errors
        });
        return null;
      }

      const expiresInSeconds = Math.round((cacheEntry.expiresAt - now) / 1000);
      console.error(
        `Remote config cache hit for ${url} (expires in ${expiresInSeconds}s)`
      );
      return cacheEntry.data;
    } catch (error) {
      console.error(`Failed to read remote config cache for ${url}:`, error);
      return null;
    }
  }

  /**
   * Set cached data for a remote config URL
   */
  async set(url: string, data: RemoteMcpConfiguration): Promise<void> {
    if (!this.writeEnabled) {
      return;
    }

    try {
      await this.ensureCacheDir();

      const cacheKey = this.generateCacheKey(url);
      const cacheFilePath = this.getCacheFilePath(cacheKey);

      const now = Date.now();
      const cacheEntry: CacheEntry = {
        data,
        timestamp: now,
        expiresAt: now + this.cacheTTL,
        url, // Store URL for debugging/transparency
      };

      await writeFile(cacheFilePath, JSON.stringify(cacheEntry, null, 2), 'utf-8');
      console.error(
        `Cached remote config for ${url} (TTL: ${Math.round(this.cacheTTL / 1000)}s)`
      );
    } catch (error) {
      console.error(`Failed to write remote config cache for ${url}:`, error);
    }
  }

  /**
   * Clear cache for a specific URL
   */
  async clear(url: string): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(url);
      const cacheFilePath = this.getCacheFilePath(cacheKey);

      if (existsSync(cacheFilePath)) {
        await unlink(cacheFilePath);
        console.error(`Cleared remote config cache for ${url}`);
      }
    } catch (error) {
      console.error(`Failed to clear remote config cache for ${url}:`, error);
    }
  }

  /**
   * Clear all cached remote configs
   */
  async clearAll(): Promise<void> {
    try {
      if (!existsSync(this.cacheDir)) {
        return;
      }

      const files = await readdir(this.cacheDir);
      const deletePromises = files
        .filter((file) => file.endsWith('.json'))
        .map((file) => unlink(join(this.cacheDir, file)).catch(() => {}));

      await Promise.all(deletePromises);
      console.error(`Cleared all remote config cache entries (${files.length} files)`);
    } catch (error) {
      console.error('Failed to clear all remote config cache:', error);
    }
  }

  /**
   * Clean up expired cache entries
   */
  async cleanExpired(): Promise<void> {
    try {
      if (!existsSync(this.cacheDir)) {
        return;
      }

      const now = Date.now();
      const files = await readdir(this.cacheDir);
      let expiredCount = 0;

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = join(this.cacheDir, file);
        try {
          const content = await readFile(filePath, 'utf-8');
          const entry: CacheEntry = JSON.parse(content);

          if (now > entry.expiresAt) {
            await unlink(filePath);
            expiredCount++;
          }
        } catch (error) {
          // If we can't read or parse the file, delete it
          await unlink(filePath).catch(() => {});
          expiredCount++;
        }
      }

      if (expiredCount > 0) {
        console.error(`Cleaned up ${expiredCount} expired remote config cache entries`);
      }
    } catch (error) {
      console.error('Failed to clean expired remote config cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ totalEntries: number; totalSize: number }> {
    try {
      if (!existsSync(this.cacheDir)) {
        return { totalEntries: 0, totalSize: 0 };
      }

      const files = await readdir(this.cacheDir);
      const jsonFiles = files.filter((file) => file.endsWith('.json'));

      let totalSize = 0;
      for (const file of jsonFiles) {
        const filePath = join(this.cacheDir, file);
        try {
          const content = await readFile(filePath, 'utf-8');
          totalSize += Buffer.byteLength(content, 'utf-8');
        } catch {
          // Ignore errors for individual files
        }
      }

      return {
        totalEntries: jsonFiles.length,
        totalSize,
      };
    } catch (error) {
      console.error('Failed to get remote config cache stats:', error);
      return { totalEntries: 0, totalSize: 0 };
    }
  }

  /**
   * Check if read from cache is enabled
   */
  isReadEnabled(): boolean {
    return this.readEnabled;
  }

  /**
   * Check if write to cache is enabled
   */
  isWriteEnabled(): boolean {
    return this.writeEnabled;
  }

  /**
   * Set read enabled state
   */
  setReadEnabled(enabled: boolean): void {
    this.readEnabled = enabled;
  }

  /**
   * Set write enabled state
   */
  setWriteEnabled(enabled: boolean): void {
    this.writeEnabled = enabled;
  }
}
