/**
 * NewProjectService
 *
 * DESIGN PATTERNS:
 * - Service pattern for business logic encapsulation
 * - Single responsibility principle
 * - No UI interaction (prompts handled by CLI layer)
 *
 * CODING STANDARDS:
 * - Use async/await for asynchronous operations
 * - Throw descriptive errors for error cases
 * - Keep methods focused and well-named
 * - Document complex logic with comments
 *
 * AVOID:
 * - Mixing concerns (keep focused on single domain)
 * - Direct UI interaction (no @inquirer/prompts in services)
 * - Direct tool implementation (services should be tool-agnostic)
 */

import {
  messages,
  ProjectType,
  mkdir,
  remove,
  cloneRepository,
  cloneSubdirectory,
  gitInit,
  parseGitHubUrl,
} from '@agiflowai/aicode-utils';

// Reserved Windows/system names that should not be used
export const RESERVED_PROJECT_NAMES = [
  '.',
  '..',
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9',
];

export class NewProjectService {
  private readonly providedName?: string;
  private readonly providedProjectType?: string;

  constructor(providedName?: string, providedProjectType?: string) {
    this.providedName = providedName;
    this.providedProjectType = providedProjectType;
  }

  /**
   * Validate project name against naming rules
   * @param value - Project name to validate
   * @returns true if valid, error message string if invalid
   */
  validateProjectName(value: string): true | string {
    const trimmed = value.trim();
    if (!trimmed) {
      return 'Project name is required';
    }
    // Must start with a letter or number
    if (!/^[a-zA-Z0-9]/.test(trimmed)) {
      return 'Project name must start with a letter or number';
    }
    // Can only contain alphanumeric, hyphens, and underscores
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(trimmed)) {
      return 'Project name can only contain letters, numbers, hyphens, and underscores';
    }
    // Check against reserved names
    if (RESERVED_PROJECT_NAMES.includes(trimmed.toUpperCase())) {
      return 'Project name uses a reserved name';
    }
    return true;
  }

  /**
   * Validate project type
   * @param projectType - Project type to validate
   * @throws Error if invalid project type
   */
  validateProjectType(projectType: string): void {
    if (projectType !== ProjectType.MONOLITH && projectType !== ProjectType.MONOREPO) {
      throw new Error(
        `Invalid project type '${projectType}'. Must be '${ProjectType.MONOLITH}' or '${ProjectType.MONOREPO}'`,
      );
    }
  }

  /**
   * Get the provided name from constructor
   */
  getProvidedName(): string | undefined {
    return this.providedName;
  }

  /**
   * Get the provided project type from constructor
   */
  getProvidedProjectType(): string | undefined {
    return this.providedProjectType;
  }

  /**
   * Create project directory atomically
   * @param projectPath - Full path where project should be created
   * @param projectName - Name of the project (for error messages)
   */
  async createProjectDirectory(projectPath: string, projectName: string): Promise<void> {
    try {
      await mkdir(projectPath, { recursive: false });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        throw new Error(
          `Directory '${projectName}' already exists. Please choose a different name.`,
        );
      }
      throw error;
    }
  }

  /**
   * Clone an existing Git repository
   * @param repoUrl - Repository URL to clone
   * @param projectPath - Destination path for the cloned repository
   */
  async cloneExistingRepository(repoUrl: string, projectPath: string): Promise<void> {
    try {
      // Parse URL to check if it's a subdirectory
      const parsed = parseGitHubUrl(repoUrl.trim());

      if (parsed.isSubdirectory && parsed.branch && parsed.subdirectory) {
        // Clone subdirectory
        await cloneSubdirectory(parsed.repoUrl, parsed.branch, parsed.subdirectory, projectPath);
      } else {
        // Clone entire repository
        await cloneRepository(parsed.repoUrl, projectPath);
      }
    } catch (error) {
      // Clean up on error
      await remove(projectPath);
      throw new Error(`Failed to clone repository: ${(error as Error).message}`);
    }
  }

  /**
   * Initialize a new Git repository
   * @param projectPath - Path where git repository should be initialized
   */
  async initializeGitRepository(projectPath: string): Promise<void> {
    try {
      await gitInit(projectPath);
    } catch (error) {
      messages.warning(`Failed to initialize Git: ${(error as Error).message}`);
    }
  }

  /**
   * Validate repository URL format
   * @param value - Repository URL to validate
   * @returns true if valid, error message string if invalid
   */
  validateRepositoryUrl(value: string): true | string {
    if (!value.trim()) {
      return 'Repository URL is required';
    }
    // Basic URL validation for git URLs
    if (!value.match(/^(https?:\/\/|git@)/)) {
      return 'Please enter a valid Git repository URL';
    }
    return true;
  }
}
