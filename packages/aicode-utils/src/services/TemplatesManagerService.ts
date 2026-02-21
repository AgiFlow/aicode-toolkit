/**
 * TemplatesManagerService
 *
 * DESIGN PATTERNS:
 * - Class-based service pattern for encapsulating business logic
 * - Static methods for utility-like functionality
 * - File system traversal for workspace detection
 * - Configuration-driven template path resolution
 *
 * CODING STANDARDS:
 * - Service class names use PascalCase with 'Service' suffix
 * - Method names use camelCase with descriptive verbs
 * - Return types should be explicit (never use implicit any)
 * - Use async/await for asynchronous operations
 * - Handle errors with try-catch and throw descriptive Error objects
 * - Document public methods with JSDoc comments
 *
 * AVOID:
 * - Side effects in constructors (keep them lightweight)
 * - Mixing concerns (keep services focused on single domain)
 * - Direct coupling to other services (use dependency injection)
 * - Exposing internal implementation details
 */

import path from 'node:path';
import * as fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { pathExists, pathExistsSync } from '../utils/fsHelpers';
import type { ToolkitConfig } from '../types';

// biome-ignore lint/complexity/noStaticOnlyClass: architectural pattern
export class TemplatesManagerService {
  private static SCAFFOLD_CONFIG_FILE = 'scaffold.yaml';
  private static TEMPLATES_FOLDER = 'templates';
  private static TOOLKIT_FOLDER = '.toolkit';
  private static SETTINGS_FILE = 'settings.yaml';
  private static SETTINGS_LOCAL_FILE = 'settings.local.yaml';
  private static TOOLKIT_CONFIG_FILE = 'toolkit.yaml'; // kept for backward-compat fallback

  private static mergeToolkitConfigs(base: ToolkitConfig, local: ToolkitConfig): ToolkitConfig {
    return { ...base, ...local };
  }

  /**
   * Find the templates directory by searching upwards from the starting path.
   *
   * Algorithm:
   * 1. Start from the provided path (default: current working directory)
   * 2. Search upwards to find the workspace root (where .git exists or filesystem root)
   * 3. Read toolkit config (checks .toolkit/settings.yaml, then toolkit.yaml)
   *    - If config has templatesPath, use it
   *    - If no config, default to 'templates' folder in workspace root
   * 4. Verify the templates directory exists
   *
   * @param startPath - The path to start searching from (defaults to process.cwd())
   * @returns The absolute path to the templates directory, or null if not found
   */
  static async findTemplatesPath(startPath: string = process.cwd()): Promise<string | null> {
    const workspaceRoot = await TemplatesManagerService.findWorkspaceRoot(startPath);
    const config = await TemplatesManagerService.readToolkitConfig(startPath);

    if (config?.templatesPath) {
      const templatesPath = path.isAbsolute(config.templatesPath)
        ? config.templatesPath
        : path.join(workspaceRoot, config.templatesPath);

      if (await pathExists(templatesPath)) {
        return templatesPath;
      }
      // Return null instead of throwing - let caller handle missing path
      return null;
    }

    // Default to templates folder in workspace root
    const templatesPath = path.join(workspaceRoot, TemplatesManagerService.TEMPLATES_FOLDER);

    if (await pathExists(templatesPath)) {
      return templatesPath;
    }

    // Return null instead of throwing - let caller handle missing path
    return null;
  }

  /**
   * Find the workspace root by searching upwards for .git folder
   */
  private static async findWorkspaceRoot(startPath: string): Promise<string> {
    let currentPath = path.resolve(startPath);
    const rootPath = path.parse(currentPath).root;

    while (true) {
      // Check if .git folder exists (repository root)
      const gitPath = path.join(currentPath, '.git');
      if (await pathExists(gitPath)) {
        return currentPath;
      }

      // Check if we've reached the filesystem root
      if (currentPath === rootPath) {
        // No .git found, return current working directory as workspace root
        return process.cwd();
      }

      // Move up to parent directory
      currentPath = path.dirname(currentPath);
    }
  }

  /**
   * Get the templates path synchronously.
   * Use this when you need immediate access and are sure templates exist.
   *
   * @param startPath - The path to start searching from (defaults to process.cwd())
   * @returns The absolute path to the templates directory, or null if not found
   */
  static findTemplatesPathSync(startPath: string = process.cwd()): string | null {
    const workspaceRoot = TemplatesManagerService.findWorkspaceRootSync(startPath);
    const config = TemplatesManagerService.readToolkitConfigSync(startPath);

    if (config?.templatesPath) {
      const templatesPath = path.isAbsolute(config.templatesPath)
        ? config.templatesPath
        : path.join(workspaceRoot, config.templatesPath);

      if (pathExistsSync(templatesPath)) {
        return templatesPath;
      }
      // Return null instead of throwing - let caller handle missing path
      return null;
    }

    // Default to templates folder in workspace root
    const templatesPath = path.join(workspaceRoot, TemplatesManagerService.TEMPLATES_FOLDER);

    if (pathExistsSync(templatesPath)) {
      return templatesPath;
    }

    // Return null instead of throwing - let caller handle missing path
    return null;
  }

  /**
   * Find the workspace root synchronously by searching upwards for .git folder
   */
  private static findWorkspaceRootSync(startPath: string): string {
    let currentPath = path.resolve(startPath);
    const rootPath = path.parse(currentPath).root;

    while (true) {
      // Check if .git folder exists (repository root)
      const gitPath = path.join(currentPath, '.git');
      if (pathExistsSync(gitPath)) {
        return currentPath;
      }

      // Check if we've reached the filesystem root
      if (currentPath === rootPath) {
        // No .git found, return current working directory as workspace root
        return process.cwd();
      }

      // Move up to parent directory
      currentPath = path.dirname(currentPath);
    }
  }

  /**
   * Check if templates are initialized at the given path
   *
   * @param templatesPath - Path to check for templates
   * @returns true if templates folder exists and is a directory
   */
  static async isInitialized(templatesPath: string): Promise<boolean> {
    if (!(await pathExists(templatesPath))) {
      return false;
    }
    const stat = await fs.stat(templatesPath);
    return stat.isDirectory();
  }

  /**
   * Get the scaffold config file name
   */
  static getConfigFileName(): string {
    return TemplatesManagerService.SCAFFOLD_CONFIG_FILE;
  }

  /**
   * Get the templates folder name
   */
  static getTemplatesFolderName(): string {
    return TemplatesManagerService.TEMPLATES_FOLDER;
  }

  /**
   * Read toolkit configuration from workspace root.
   *
   * Priority order:
   * 1. .toolkit/settings.yaml (new location)
   * 2. Shallow-merge .toolkit/settings.local.yaml over settings.yaml if present
   * 3. Fallback to root toolkit.yaml (deprecated, backward-compat)
   *
   * @param startPath - The path to start searching from (defaults to process.cwd())
   * @returns The toolkit configuration object or null if not found
   */
  static async readToolkitConfig(startPath: string = process.cwd()): Promise<ToolkitConfig | null> {
    const workspaceRoot = await TemplatesManagerService.findWorkspaceRoot(startPath);
    const yaml = await import('js-yaml');

    const toolkitFolder = path.join(workspaceRoot, TemplatesManagerService.TOOLKIT_FOLDER);
    const settingsPath = path.join(toolkitFolder, TemplatesManagerService.SETTINGS_FILE);
    const settingsLocalPath = path.join(toolkitFolder, TemplatesManagerService.SETTINGS_LOCAL_FILE);

    if (await pathExists(settingsPath)) {
      const baseContent = await fs.readFile(settingsPath, 'utf-8');
      const base = yaml.load(baseContent) as ToolkitConfig;

      if (await pathExists(settingsLocalPath)) {
        const localContent = await fs.readFile(settingsLocalPath, 'utf-8');
        const local = yaml.load(localContent) as ToolkitConfig;
        return TemplatesManagerService.mergeToolkitConfigs(base, local);
      }

      return base;
    }

    // Fallback: legacy toolkit.yaml at workspace root
    const legacyConfigPath = path.join(workspaceRoot, TemplatesManagerService.TOOLKIT_CONFIG_FILE);
    if (!(await pathExists(legacyConfigPath))) {
      return null;
    }

    const content = await fs.readFile(legacyConfigPath, 'utf-8');
    return yaml.load(content) as ToolkitConfig;
  }

  /**
   * Read toolkit configuration from workspace root (sync).
   *
   * Priority order:
   * 1. .toolkit/settings.yaml (new location)
   * 2. Shallow-merge .toolkit/settings.local.yaml over settings.yaml if present
   * 3. Fallback to root toolkit.yaml (deprecated, backward-compat)
   *
   * @param startPath - The path to start searching from (defaults to process.cwd())
   * @returns The toolkit configuration object or null if not found
   */
  static readToolkitConfigSync(startPath: string = process.cwd()): ToolkitConfig | null {
    const workspaceRoot = TemplatesManagerService.findWorkspaceRootSync(startPath);
    const yaml = require('js-yaml');

    const toolkitFolder = path.join(workspaceRoot, TemplatesManagerService.TOOLKIT_FOLDER);
    const settingsPath = path.join(toolkitFolder, TemplatesManagerService.SETTINGS_FILE);
    const settingsLocalPath = path.join(toolkitFolder, TemplatesManagerService.SETTINGS_LOCAL_FILE);

    if (pathExistsSync(settingsPath)) {
      const base = yaml.load(readFileSync(settingsPath, 'utf-8')) as ToolkitConfig;

      if (pathExistsSync(settingsLocalPath)) {
        const local = yaml.load(readFileSync(settingsLocalPath, 'utf-8')) as ToolkitConfig;
        return TemplatesManagerService.mergeToolkitConfigs(base, local);
      }

      return base;
    }

    // Fallback: legacy toolkit.yaml at workspace root
    const legacyConfigPath = path.join(workspaceRoot, TemplatesManagerService.TOOLKIT_CONFIG_FILE);
    if (!pathExistsSync(legacyConfigPath)) {
      return null;
    }

    return yaml.load(readFileSync(legacyConfigPath, 'utf-8')) as ToolkitConfig;
  }

  /**
   * Write toolkit configuration to .toolkit/settings.yaml.
   * Creates the .toolkit directory if it does not exist.
   *
   * @param config - The toolkit configuration to write
   * @param startPath - The path to start searching from (defaults to process.cwd())
   */
  static async writeToolkitConfig(
    config: ToolkitConfig,
    startPath: string = process.cwd(),
  ): Promise<void> {
    const workspaceRoot = await TemplatesManagerService.findWorkspaceRoot(startPath);
    const toolkitFolder = path.join(workspaceRoot, TemplatesManagerService.TOOLKIT_FOLDER);
    const settingsPath = path.join(toolkitFolder, TemplatesManagerService.SETTINGS_FILE);

    await fs.mkdir(toolkitFolder, { recursive: true });

    const yaml = await import('js-yaml');
    const content = yaml.dump(config, { indent: 2 });
    await fs.writeFile(settingsPath, content, 'utf-8');
  }

  /**
   * Get the workspace root directory
   *
   * @param startPath - The path to start searching from (defaults to process.cwd())
   * @returns The workspace root directory path
   */
  static async getWorkspaceRoot(startPath: string = process.cwd()): Promise<string> {
    return TemplatesManagerService.findWorkspaceRoot(startPath);
  }

  /**
   * Get the workspace root directory (sync)
   *
   * @param startPath - The path to start searching from (defaults to process.cwd())
   * @returns The workspace root directory path
   */
  static getWorkspaceRootSync(startPath: string = process.cwd()): string {
    return TemplatesManagerService.findWorkspaceRootSync(startPath);
  }
}
