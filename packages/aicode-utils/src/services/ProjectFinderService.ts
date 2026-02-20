/**
 * ProjectFinderService
 *
 * DESIGN PATTERNS:
 * - Class-based service pattern for encapsulating business logic
 * - Caching for performance optimization
 * - File system traversal for project detection
 *
 * CODING STANDARDS:
 * - Service class names use PascalCase with 'Service' suffix
 * - Method names use camelCase with descriptive verbs
 * - Return types should be explicit
 * - Use async/await for asynchronous operations
 * - Handle errors with try-catch and throw descriptive Error objects
 *
 * AVOID:
 * - Side effects in constructors
 * - Mixing concerns
 * - Direct coupling to other services
 */

import path from 'node:path';
import * as fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import type { ProjectConfig } from '../types';

export class ProjectFinderService {
  private projectCache: Map<string, ProjectConfig> = new Map();
  private workspaceRoot: string;

  constructor(workspaceRoot?: string) {
    this.workspaceRoot = workspaceRoot || process.cwd();
  }

  /**
   * Find the project containing a given file by walking up the directory tree
   *
   * @param filePath - Absolute path to the file
   * @returns Project configuration or null if not found
   */
  async findProjectForFile(filePath: string): Promise<ProjectConfig | null> {
    // Normalize the file path
    const normalizedPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.workspaceRoot, filePath);

    // Start from the file's directory and walk up
    let currentDir = path.dirname(normalizedPath);

    while (currentDir !== '/' && currentDir.startsWith(this.workspaceRoot)) {
      const projectJsonPath = path.join(currentDir, 'project.json');

      try {
        const project = await this.loadProjectConfig(projectJsonPath);
        if (project) {
          return project;
        }
      } catch {
        // No project.json in this directory, continue searching
      }

      currentDir = path.dirname(currentDir);
    }

    return null;
  }

  /**
   * Find the project containing a given file (synchronous version)
   *
   * @param filePath - Absolute path to the file
   * @returns Project configuration or null if not found
   */
  findProjectForFileSync(filePath: string): ProjectConfig | null {
    // Normalize the file path
    const normalizedPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.workspaceRoot, filePath);

    // Start from the file's directory and walk up
    let currentDir = path.dirname(normalizedPath);

    while (currentDir !== '/' && currentDir.startsWith(this.workspaceRoot)) {
      const projectJsonPath = path.join(currentDir, 'project.json');

      try {
        const project = this.loadProjectConfigSync(projectJsonPath);
        if (project) {
          return project;
        }
      } catch {
        // No project.json in this directory, continue searching
      }

      currentDir = path.dirname(currentDir);
    }

    return null;
  }

  /**
   * Load and parse a project.json file
   */
  private async loadProjectConfig(projectJsonPath: string): Promise<ProjectConfig | null> {
    // Check cache first
    if (this.projectCache.has(projectJsonPath)) {
      // biome-ignore lint/style/noNonNullAssertion: value guaranteed by context
      return this.projectCache.get(projectJsonPath)!;
    }

    try {
      const content = await fs.readFile(projectJsonPath, 'utf-8');
      const config = JSON.parse(content);

      const projectConfig: ProjectConfig = {
        name: config.name || path.basename(path.dirname(projectJsonPath)),
        root: path.dirname(projectJsonPath),
        sourceTemplate: config.sourceTemplate,
        projectType: config.projectType,
      };

      // Cache the result
      this.projectCache.set(projectJsonPath, projectConfig);

      return projectConfig;
    } catch {
      return null;
    }
  }

  /**
   * Load and parse a project.json file (synchronous version)
   */
  private loadProjectConfigSync(projectJsonPath: string): ProjectConfig | null {
    // Check cache first
    if (this.projectCache.has(projectJsonPath)) {
      // biome-ignore lint/style/noNonNullAssertion: value guaranteed by context
      return this.projectCache.get(projectJsonPath)!;
    }

    try {
      const content = readFileSync(projectJsonPath, 'utf-8');
      const config = JSON.parse(content);

      const projectConfig: ProjectConfig = {
        name: config.name || path.basename(path.dirname(projectJsonPath)),
        root: path.dirname(projectJsonPath),
        sourceTemplate: config.sourceTemplate,
        projectType: config.projectType,
      };

      // Cache the result
      this.projectCache.set(projectJsonPath, projectConfig);

      return projectConfig;
    } catch {
      return null;
    }
  }

  /**
   * Get the workspace root
   */
  getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }

  /**
   * Clear the project cache
   */
  clearCache(): void {
    this.projectCache.clear();
  }
}
