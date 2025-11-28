/**
 * ProjectConfigResolver
 *
 * DESIGN PATTERNS:
 * - Class-based service pattern for resolving project configuration
 * - Priority-based configuration resolution (project.json > toolkit.yaml > package.json)
 * - Singleton-like static methods for common operations
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
import { ConfigSource, ProjectType } from '../constants/projectType';

// Helper to check if file exists
async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Helper to read JSON file
async function readJson<T = unknown>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as T;
}
import type { NxProjectJson, ProjectConfigResult, ToolkitConfig } from '../types';
import { log } from '../utils/logger';
import { TemplatesManagerService } from './TemplatesManagerService';

/**
 * ProjectConfigResolver
 *
 * Resolves project configuration from multiple sources with priority:
 * 1. project.json (monorepo - Nx/Lerna/Turborepo)
 * 2. toolkit.yaml at workspace root (monolith)
 */
export class ProjectConfigResolver {
  /**
   * Resolve project configuration with priority fallback
   *
   * Priority order:
   * 1. Check for project.json (monorepo case)
   * 2. Check for toolkit.yaml at workspace root (monolith case)
   * 3. Error with helpful message
   *
   * @param projectPath - Absolute path to the project directory
   * @param explicitTemplate - Optional explicit template override
   * @returns Project configuration result
   * @throws Error if no configuration found
   */
  static async resolveProjectConfig(
    projectPath: string,
    explicitTemplate?: string,
  ): Promise<ProjectConfigResult> {
    try {
      const absolutePath = path.resolve(projectPath);

      // If explicit template provided, use it
      if (explicitTemplate) {
        return {
          type: ProjectType.MONOLITH,
          sourceTemplate: explicitTemplate,
          configSource: ConfigSource.TOOLKIT_YAML, // Will be created if doesn't exist
        };
      }

      // 1. Check for project.json (monorepo)
      const projectJsonPath = path.join(absolutePath, 'project.json');
      if (await pathExists(projectJsonPath)) {
        const projectJson = await readJson<NxProjectJson>(projectJsonPath);

        // Validate sourceTemplate is a non-empty string
        if (
          projectJson.sourceTemplate &&
          typeof projectJson.sourceTemplate === 'string' &&
          projectJson.sourceTemplate.trim()
        ) {
          return {
            type: ProjectType.MONOREPO,
            sourceTemplate: projectJson.sourceTemplate.trim(),
            configSource: ConfigSource.PROJECT_JSON,
          };
        }
      }

      // 2. Check for toolkit.yaml at workspace root (monolith)
      // This is optional, so we catch and continue if not found
      try {
        const workspaceRoot = await TemplatesManagerService.getWorkspaceRoot(absolutePath);
        const toolkitConfig = await TemplatesManagerService.readToolkitConfig(workspaceRoot);

        if (toolkitConfig?.projectType === 'monolith' && toolkitConfig.sourceTemplate) {
          return {
            type: ProjectType.MONOLITH,
            sourceTemplate: toolkitConfig.sourceTemplate,
            configSource: ConfigSource.TOOLKIT_YAML,
            workspaceRoot,
          };
        }
      } catch (_error) {
        // toolkit.yaml doesn't exist or couldn't be read - this is expected for some projects
        // Fall through to error message
      }

      // 3. No configuration found - throw helpful error
      throw new Error(ProjectConfigResolver.getHelpfulErrorMessage(absolutePath));
    } catch (error) {
      // If it's already our helpful error message, rethrow it
      if (error instanceof Error && error.message.includes('No project configuration found')) {
        throw error;
      }
      // Otherwise, wrap unexpected errors with context
      throw new Error(
        `Failed to resolve project configuration at ${projectPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get helpful error message when no configuration is found
   */
  private static getHelpfulErrorMessage(projectPath: string): string {
    return `No project configuration found at ${projectPath}.

For monorepo projects:
  - Ensure project.json exists with sourceTemplate field

For monolith projects:
  - Create toolkit.yaml at workspace root:

    projectType: monolith
    sourceTemplate: your-template-name

  - OR use --template flag:
    scaffold-mcp scaffold add <feature> --template <template-name>

Run 'scaffold-mcp scaffold list --help' for more info.`;
  }

  /**
   * Check if project has configuration (without throwing error)
   *
   * @param projectPath - Absolute path to the project directory
   * @returns true if configuration exists, false otherwise
   * @throws Error if there's a filesystem error (not just missing config)
   */
  static async hasConfiguration(projectPath: string): Promise<boolean> {
    try {
      await ProjectConfigResolver.resolveProjectConfig(projectPath);
      return true;
    } catch (error) {
      // If error is about missing configuration, return false
      if (error instanceof Error && error.message.includes('No project configuration found')) {
        return false;
      }
      // Otherwise, it's a real error (filesystem, permissions, etc) - rethrow with context
      throw new Error(
        `Error checking project configuration: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Create toolkit.yaml for monolith projects
   *
   * @param sourceTemplate - The template identifier
   * @param workspaceRoot - Optional workspace root path (defaults to current directory)
   */
  static async createToolkitYaml(sourceTemplate: string, workspaceRoot?: string): Promise<void> {
    try {
      const rootPath =
        workspaceRoot || (await TemplatesManagerService.getWorkspaceRoot(process.cwd()));

      // Get existing toolkit config or create new one
      const existingConfig = await TemplatesManagerService.readToolkitConfig(rootPath);

      const toolkitConfig: ToolkitConfig = {
        version: existingConfig?.version || '1.0',
        templatesPath: existingConfig?.templatesPath || './templates',
        projectType: 'monolith' as const,
        sourceTemplate,
      };

      await TemplatesManagerService.writeToolkitConfig(toolkitConfig, rootPath);
      log.info('Created toolkit.yaml with monolith configuration');
    } catch (error) {
      throw new Error(
        `Failed to create toolkit.yaml: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Create or update project.json for monorepo projects
   *
   * @param projectPath - Absolute path to the project directory
   * @param projectName - Name of the project
   * @param sourceTemplate - The template identifier
   */
  static async createProjectJson(
    projectPath: string,
    projectName: string,
    sourceTemplate: string,
  ): Promise<void> {
    const projectJsonPath = path.join(projectPath, 'project.json');

    try {
      let projectJson: NxProjectJson;

      if (await pathExists(projectJsonPath)) {
        // Read existing project.json
        projectJson = await readJson<NxProjectJson>(projectJsonPath);
      } else {
        // Create minimal project.json
        // Calculate relative path to node_modules for $schema
        const relativePath = path.relative(projectPath, process.cwd());
        const schemaPath = relativePath
          ? `${relativePath}/node_modules/nx/schemas/project-schema.json`
          : 'node_modules/nx/schemas/project-schema.json';

        projectJson = {
          name: projectName,
          $schema: schemaPath,
          sourceRoot: projectPath,
          projectType: 'application',
        };
      }

      // Add/update sourceTemplate field
      projectJson.sourceTemplate = sourceTemplate;

      // Write back to file
      const content = JSON.stringify(projectJson, null, 2);
      await fs.writeFile(projectJsonPath, `${content}\n`);
      log.info(`Created/updated project.json with sourceTemplate: ${sourceTemplate}`);
    } catch (error) {
      throw new Error(
        `Failed to create project.json: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
