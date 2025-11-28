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

export class TemplatesManagerService {
  private static SCAFFOLD_CONFIG_FILE = 'scaffold.yaml';
  private static TEMPLATES_FOLDER = 'templates';
  private static TOOLKIT_CONFIG_FILE = 'toolkit.yaml';

  /**
   * Find the templates directory by searching upwards from the starting path.
   *
   * Algorithm:
   * 1. Start from the provided path (default: current working directory)
   * 2. Search upwards to find the workspace root (where .git exists or filesystem root)
   * 3. Check if toolkit.yaml exists at workspace root
   *    - If yes, read templatesPath from toolkit.yaml
   *    - If no, default to 'templates' folder in workspace root
   * 4. Verify the templates directory exists
   *
   * @param startPath - The path to start searching from (defaults to process.cwd())
   * @returns The absolute path to the templates directory
   * @throws Error if templates directory is not found
   */
  static async findTemplatesPath(startPath: string = process.cwd()): Promise<string> {
    // First, find the workspace root
    const workspaceRoot = await TemplatesManagerService.findWorkspaceRoot(startPath);

    // Check if toolkit.yaml exists
    const toolkitConfigPath = path.join(workspaceRoot, TemplatesManagerService.TOOLKIT_CONFIG_FILE);

    if (await pathExists(toolkitConfigPath)) {
      // Read toolkit.yaml to get templatesPath
      const yaml = await import('js-yaml');
      const content = await fs.readFile(toolkitConfigPath, 'utf-8');
      const config = yaml.load(content) as any;

      if (config?.templatesPath) {
        const templatesPath = path.isAbsolute(config.templatesPath)
          ? config.templatesPath
          : path.join(workspaceRoot, config.templatesPath);

        if (await pathExists(templatesPath)) {
          return templatesPath;
        } else {
          throw new Error(
            `Templates path specified in toolkit.yaml does not exist: ${templatesPath}`,
          );
        }
      }
    }

    // Default to templates folder in workspace root
    const templatesPath = path.join(workspaceRoot, TemplatesManagerService.TEMPLATES_FOLDER);

    if (await pathExists(templatesPath)) {
      return templatesPath;
    }

    throw new Error(
      `Templates folder not found at ${templatesPath}.\n` +
        `Either create a 'templates' folder or specify templatesPath in toolkit.yaml`,
    );
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
   * @returns The absolute path to the templates directory
   * @throws Error if templates directory is not found
   */
  static findTemplatesPathSync(startPath: string = process.cwd()): string {
    // First, find the workspace root
    const workspaceRoot = TemplatesManagerService.findWorkspaceRootSync(startPath);

    // Check if toolkit.yaml exists
    const toolkitConfigPath = path.join(workspaceRoot, TemplatesManagerService.TOOLKIT_CONFIG_FILE);

    if (pathExistsSync(toolkitConfigPath)) {
      // Read toolkit.yaml to get templatesPath
      const yaml = require('js-yaml');
      const content = readFileSync(toolkitConfigPath, 'utf-8');
      const config = yaml.load(content) as any;

      if (config?.templatesPath) {
        const templatesPath = path.isAbsolute(config.templatesPath)
          ? config.templatesPath
          : path.join(workspaceRoot, config.templatesPath);

        if (pathExistsSync(templatesPath)) {
          return templatesPath;
        } else {
          throw new Error(
            `Templates path specified in toolkit.yaml does not exist: ${templatesPath}`,
          );
        }
      }
    }

    // Default to templates folder in workspace root
    const templatesPath = path.join(workspaceRoot, TemplatesManagerService.TEMPLATES_FOLDER);

    if (pathExistsSync(templatesPath)) {
      return templatesPath;
    }

    throw new Error(
      `Templates folder not found at ${templatesPath}.\n` +
        `Either create a 'templates' folder or specify templatesPath in toolkit.yaml`,
    );
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
   * Read toolkit.yaml configuration from workspace root
   *
   * @param startPath - The path to start searching from (defaults to process.cwd())
   * @returns The toolkit configuration object or null if not found
   */
  static async readToolkitConfig(startPath: string = process.cwd()): Promise<ToolkitConfig | null> {
    const workspaceRoot = await TemplatesManagerService.findWorkspaceRoot(startPath);
    const toolkitConfigPath = path.join(workspaceRoot, TemplatesManagerService.TOOLKIT_CONFIG_FILE);

    if (!(await pathExists(toolkitConfigPath))) {
      return null;
    }

    const yaml = await import('js-yaml');
    const content = await fs.readFile(toolkitConfigPath, 'utf-8');
    const config = yaml.load(content) as ToolkitConfig;

    return config;
  }

  /**
   * Read toolkit.yaml configuration from workspace root (sync)
   *
   * @param startPath - The path to start searching from (defaults to process.cwd())
   * @returns The toolkit configuration object or null if not found
   */
  static readToolkitConfigSync(startPath: string = process.cwd()): ToolkitConfig | null {
    const workspaceRoot = TemplatesManagerService.findWorkspaceRootSync(startPath);
    const toolkitConfigPath = path.join(workspaceRoot, TemplatesManagerService.TOOLKIT_CONFIG_FILE);

    if (!pathExistsSync(toolkitConfigPath)) {
      return null;
    }

    const yaml = require('js-yaml');
    const content = readFileSync(toolkitConfigPath, 'utf-8');
    const config = yaml.load(content) as ToolkitConfig;

    return config;
  }

  /**
   * Write toolkit.yaml configuration to workspace root
   *
   * @param config - The toolkit configuration to write
   * @param startPath - The path to start searching from (defaults to process.cwd())
   */
  static async writeToolkitConfig(
    config: ToolkitConfig,
    startPath: string = process.cwd(),
  ): Promise<void> {
    const workspaceRoot = await TemplatesManagerService.findWorkspaceRoot(startPath);
    const toolkitConfigPath = path.join(workspaceRoot, TemplatesManagerService.TOOLKIT_CONFIG_FILE);

    const yaml = await import('js-yaml');
    const content = yaml.dump(config, { indent: 2 });
    await fs.writeFile(toolkitConfigPath, content, 'utf-8');
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
