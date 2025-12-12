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
  MAX_ARCHITECT_FILE_SIZE,
} from '../../constants';
import { architectConfigSchema } from '../../schemas';
import { ParseArchitectError, InvalidConfigError } from '../../utils/errors';

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

    // Check if templatePath is already a full file path to an architect file
    if (
      templatePath.endsWith(ARCHITECT_FILENAME_HIDDEN) ||
      templatePath.endsWith(ARCHITECT_FILENAME)
    ) {
      architectPath = templatePath;
    } else {
      // Check if templatePath is an existing file (for arbitrary YAML validation)
      try {
        const stat = await fs.stat(templatePath);
        if (stat.isFile()) {
          architectPath = templatePath;
        } else {
          // It's a directory, find the architect file in it
          const foundPath = await this.findArchitectFile(templatePath);
          if (!foundPath) {
            return null;
          }
          architectPath = foundPath;
        }
      } catch {
        // Path doesn't exist or can't be accessed, try as directory
        const foundPath = await this.findArchitectFile(templatePath);
        if (!foundPath) {
          return null;
        }
        architectPath = foundPath;
      }
    }

    // Check cache first
    if (this.configCache.has(architectPath)) {
      return this.configCache.get(architectPath)!;
    }

    try {
      // Read file as buffer first to check size atomically (prevents TOCTOU race condition)
      const buffer = await fs.readFile(architectPath);

      // Validate file size to prevent DoS
      if (buffer.length > MAX_ARCHITECT_FILE_SIZE) {
        throw new ParseArchitectError(
          `File size (${buffer.length} bytes) exceeds maximum allowed size (${MAX_ARCHITECT_FILE_SIZE} bytes)`,
        );
      }

      const content = buffer.toString('utf-8');

      // Handle empty file
      if (!content || content.trim() === '') {
        const emptyConfig: ArchitectConfig = { features: [] };
        this.configCache.set(architectPath, emptyConfig);
        return emptyConfig;
      }

      let rawConfig: unknown;
      try {
        rawConfig = yaml.load(content);
      } catch (yamlError) {
        throw new ParseArchitectError(String(yamlError));
      }

      // Validate and parse using Zod schema
      const parseResult = architectConfigSchema.safeParse(rawConfig || {});

      if (!parseResult.success) {
        const issues = parseResult.error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message,
          code: issue.code,
        }));
        const errorMessages = issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(', ');
        throw new InvalidConfigError(errorMessages, issues);
      }

      const validatedConfig: ArchitectConfig = parseResult.data;

      // Cache the result
      this.configCache.set(architectPath, validatedConfig);

      return validatedConfig;
    } catch (error) {
      // Re-throw our custom errors
      if (error instanceof ParseArchitectError || error instanceof InvalidConfigError) {
        throw error;
      }
      throw new ParseArchitectError(String(error));
    }
  }

  /**
   * Parse the global architect.yaml or .architect.yaml
   * @param globalPath - Optional path to global architect file
   * @returns Parsed config or null if not found
   */
  async parseGlobalArchitectFile(globalPath?: string): Promise<ArchitectConfig | null> {
    // Default to the architect file in the templates directory
    let resolvedPath: string | null;
    if (globalPath) {
      resolvedPath = globalPath;
    } else {
      const templatesRoot = await TemplatesManagerService.findTemplatesPath(this.workspaceRoot);
      if (!templatesRoot) {
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
      const rawConfig: unknown = yaml.load(content);

      // Try standard architect.yaml format first (with features array)
      const parseResult = architectConfigSchema.safeParse(rawConfig);
      if (parseResult.success && parseResult.data.features.length > 0) {
        this.configCache.set(resolvedPath, parseResult.data);
        return parseResult.data;
      }

      // Legacy format: global architect.yaml with prompts/examples structure
      // This format extracts patterns from a prompts array for backward compatibility
      const features: Feature[] = [];
      if (
        rawConfig &&
        typeof rawConfig === 'object' &&
        'prompts' in rawConfig &&
        Array.isArray((rawConfig as Record<string, unknown>).prompts)
      ) {
        const prompts = (rawConfig as Record<string, unknown>).prompts as unknown[];
        for (const prompt of prompts) {
          if (prompt && typeof prompt === 'object' && 'examples' in prompt) {
            const examples = (prompt as Record<string, unknown>).examples;
            if (Array.isArray(examples)) {
              for (const example of examples) {
                if (example && typeof example === 'object' && 'pattern' in example) {
                  const ex = example as Record<string, unknown>;
                  features.push({
                    name: String(ex.pattern || ''),
                    design_pattern: String(ex.pattern || ''),
                    includes: Array.isArray(ex.files) ? (ex.files as string[]) : [],
                    description: String(
                      ex.description || (prompt as Record<string, unknown>).description || '',
                    ),
                  });
                }
              }
            }
          }
        }
      }

      const globalConfig: ArchitectConfig = { features };
      this.configCache.set(resolvedPath, globalConfig);
      return globalConfig;
    } catch {
      // Global architect.yaml is optional, return null if file read fails
      return null;
    }
  }

  /**
   * Parse architect.yaml or .architect.yaml from a project directory
   * (same directory as project.json)
   */
  async parseProjectArchitectFile(projectPath: string): Promise<ArchitectConfig | null> {
    return this.parseArchitectFile(projectPath);
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
