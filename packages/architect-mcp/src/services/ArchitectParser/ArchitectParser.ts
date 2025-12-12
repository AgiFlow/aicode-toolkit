/**
 * ArchitectParser
 *
 * DESIGN PATTERNS:
 * - Service pattern for business logic encapsulation
 * - Single responsibility principle
 * - Caching for performance optimization
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

import * as fs from 'node:fs/promises';
import * as yaml from 'js-yaml';
import * as path from 'node:path';
import type { ArchitectConfig, Feature } from '../../types';
import { TemplatesManagerService } from '@agiflowai/aicode-utils';
import {
  ARCHITECT_FILENAMES,
  ARCHITECT_FILENAME,
  ARCHITECT_FILENAME_HIDDEN,
} from '../../constants';

export class ArchitectParser {
  private configCache: Map<string, ArchitectConfig> = new Map();
  private workspaceRoot: string;

  constructor(workspaceRoot?: string) {
    this.workspaceRoot = workspaceRoot || process.cwd();
  }

  /**
   * Find the architect file in a directory, checking both .architect.yaml and architect.yaml
   * Returns the full path if found, null otherwise
   */
  async findArchitectFile(dirPath: string): Promise<string | null> {
    for (const filename of ARCHITECT_FILENAMES) {
      const filePath = path.join(dirPath, filename);
      try {
        await fs.access(filePath);
        return filePath;
      } catch {
        // File doesn't exist, try next
      }
    }
    return null;
  }

  /**
   * Parse architect.yaml or .architect.yaml from a template directory
   */
  async parseArchitectFile(templatePath: string): Promise<ArchitectConfig | null> {
    let architectPath: string;

    // Check if templatePath is already a full file path
    if (
      templatePath.endsWith(ARCHITECT_FILENAME_HIDDEN) ||
      templatePath.endsWith(ARCHITECT_FILENAME)
    ) {
      architectPath = templatePath;
    } else {
      // Find the architect file in the directory
      const foundPath = await this.findArchitectFile(templatePath);
      if (!foundPath) {
        return null;
      }
      architectPath = foundPath;
    }

    // Check cache first
    if (this.configCache.has(architectPath)) {
      return this.configCache.get(architectPath)!;
    }

    try {
      const content = await fs.readFile(architectPath, 'utf-8');

      // Handle empty file
      if (!content || content.trim() === '') {
        const emptyConfig: ArchitectConfig = {};
        this.configCache.set(architectPath, emptyConfig);
        return emptyConfig;
      }

      let config: any;
      try {
        config = yaml.load(content);
      } catch (yamlError) {
        throw new Error(`Failed to parse architect file: ${yamlError}`);
      }

      // Return the parsed config as-is (could be any valid YAML structure)
      const validatedConfig: ArchitectConfig = config || {};

      // Cache the result
      this.configCache.set(architectPath, validatedConfig);

      return validatedConfig;
    } catch (error) {
      // Re-throw errors with a consistent message
      if (error instanceof Error && error.message.includes('Failed to parse architect file')) {
        throw error;
      }
      throw new Error(`Failed to parse architect file: ${error}`);
    }
  }

  /**
   * Parse the global architect.yaml or .architect.yaml
   */
  async parseGlobalArchitectFile(globalPath?: string): Promise<ArchitectConfig | null> {
    // Default to the architect file in the templates directory
    let resolvedPath: string | null;
    if (globalPath) {
      resolvedPath = globalPath;
    } else {
      const templatesRoot = await TemplatesManagerService.findTemplatesPath(this.workspaceRoot);
      if (!templatesRoot) {
        // No templates directory found, return null
        return null;
      }
      resolvedPath = await this.findArchitectFile(templatesRoot);
      if (!resolvedPath) {
        return null;
      }
    }
    // Check cache first
    if (this.configCache.has(resolvedPath)) {
      return this.configCache.get(resolvedPath)!;
    }

    try {
      const content = await fs.readFile(resolvedPath, 'utf-8');
      const config = yaml.load(content) as any;

      // Check if this is a standard architect.yaml format with features
      if (config?.features && Array.isArray(config.features)) {
        const globalConfig: ArchitectConfig = config;
        this.configCache.set(resolvedPath, globalConfig);
        return globalConfig;
      }

      // Otherwise, handle the global architect.yaml with different structure
      const features: Feature[] = [];

      if (config?.prompts && Array.isArray(config.prompts)) {
        for (const prompt of config.prompts) {
          if (prompt.examples && Array.isArray(prompt.examples)) {
            for (const example of prompt.examples) {
              if (example.pattern) {
                features.push({
                  name: example.pattern,
                  design_pattern: example.pattern,
                  includes: example.files || [],
                  description: example.description || prompt.description || '',
                });
              }
            }
          }
        }
      }

      const globalConfig: ArchitectConfig = { features };

      // Cache the result
      this.configCache.set(resolvedPath, globalConfig);

      return globalConfig;
    } catch {
      // Global architect.yaml is optional, return null if not found
      return null;
    }
  }

  /**
   * Merge multiple architect configs (template-specific and global)
   */
  mergeConfigs(...configs: (ArchitectConfig | null)[]): ArchitectConfig {
    const mergedFeatures: Feature[] = [];
    const seenNames = new Set<string>();

    for (const config of configs) {
      if (!config || !config.features) continue;

      for (const feature of config.features) {
        // Avoid duplicates based on name or architecture
        const featureName = feature.name || feature.architecture || 'unnamed';
        if (!seenNames.has(featureName)) {
          mergedFeatures.push(feature);
          seenNames.add(featureName);
        }
      }
    }

    return { features: mergedFeatures };
  }

  /**
   * Clear the config cache
   */
  clearCache(): void {
    this.configCache.clear();
  }
}
