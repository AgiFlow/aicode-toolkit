/**
 * SkillService
 *
 * DESIGN PATTERNS:
 * - Service pattern for business logic encapsulation
 * - Single responsibility principle
 * - Lazy loading pattern for skill discovery
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

import { readFile, readdir, stat, access } from 'node:fs/promises';
import { join, dirname, isAbsolute } from 'node:path';
import type { Skill, SkillMetadata } from '../types';
import { parseFrontMatter } from '../utils';

/**
 * Error thrown when skill loading fails
 */
export class SkillLoadError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'SkillLoadError';
  }
}

/**
 * Check if a path exists asynchronously
 * @param path - Path to check
 * @returns true if path exists, false otherwise
 * @throws Error for unexpected filesystem errors (permission denied, etc.)
 */
async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    // ENOENT means path doesn't exist - this is expected
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return false;
    }
    // For other errors (permission denied, etc.), rethrow with context
    throw new Error(
      `Failed to check path existence for "${path}": ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Service for loading and managing skills from configured skill directories.
 *
 * Skills are markdown files with YAML frontmatter that can be invoked via
 * the skill__ prefix in describe_tools and use_tool.
 *
 * Skills are only enabled when explicitly configured via the `skills.paths` array
 * in the MCP config.
 *
 * @example
 * // Config with skills enabled:
 * // skills:
 * //   paths:
 * //     - ".claude/skills"
 * //     - "/absolute/path/to/skills"
 *
 * const skillService = new SkillService('/project/root', ['.claude/skills']);
 * const skills = await skillService.getSkills();
 */
export class SkillService {
  private cwd: string;
  private skillPaths: string[];
  private cachedSkills: Skill[] | null = null;
  private skillsByName: Map<string, Skill> | null = null;

  /**
   * Creates a new SkillService instance
   * @param cwd - Current working directory for resolving relative paths
   * @param skillPaths - Array of paths to skills directories
   */
  constructor(cwd: string, skillPaths: string[]) {
    this.cwd = cwd;
    this.skillPaths = skillPaths;
  }

  /**
   * Get all available skills from configured directories.
   * Results are cached after first load.
   *
   * Skills from earlier entries in the config take precedence over
   * skills with the same name from later entries.
   *
   * @returns Array of loaded skills
   * @throws SkillLoadError if a critical error occurs during loading
   */
  async getSkills(): Promise<Skill[]> {
    if (this.cachedSkills !== null) {
      return this.cachedSkills;
    }

    const skills: Skill[] = [];
    const loadedSkillNames = new Set<string>();

    // Load skills from each configured path
    for (const skillPath of this.skillPaths) {
      // Resolve path - if relative, resolve against cwd
      const skillsDir = isAbsolute(skillPath)
        ? skillPath
        : join(this.cwd, skillPath);

      const dirSkills = await this.loadSkillsFromDirectory(skillsDir, 'project');

      // Add skills that don't conflict with already loaded skills
      for (const skill of dirSkills) {
        if (!loadedSkillNames.has(skill.name)) {
          skills.push(skill);
          loadedSkillNames.add(skill.name);
        }
      }
    }

    this.cachedSkills = skills;
    this.skillsByName = new Map(skills.map((skill) => [skill.name, skill]));
    return skills;
  }

  /**
   * Get a specific skill by name with O(1) lookup from cache.
   * @param name - The skill name (without skill__ prefix)
   * @returns The skill if found, undefined otherwise
   */
  async getSkill(name: string): Promise<Skill | undefined> {
    // Ensure cache is populated
    if (this.skillsByName === null) {
      await this.getSkills();
    }
    return this.skillsByName?.get(name);
  }

  /**
   * Clears the cached skills to force a fresh reload on the next getSkills() or getSkill() call.
   * Use this when skill files have been modified on disk.
   */
  clearCache(): void {
    this.cachedSkills = null;
    this.skillsByName = null;
  }

  /**
   * Load skills from a directory.
   * Supports both flat structure (SKILL.md) and nested structure (name/SKILL.md).
   *
   * @param dirPath - Path to the skills directory
   * @param location - Whether this is a 'project' or 'user' skill directory
   * @returns Array of successfully loaded skills (skips invalid skills)
   * @throws SkillLoadError if there's a critical I/O error
   *
   * @example
   * // Load skills from project directory
   * const skills = await this.loadSkillsFromDirectory('/path/to/.claude/skills', 'project');
   * // Returns: [{ name: 'pdf', description: '...', location: 'project', ... }]
   */
  private async loadSkillsFromDirectory(
    dirPath: string,
    location: 'project' | 'user'
  ): Promise<Skill[]> {
    const skills: Skill[] = [];

    try {
      if (!(await pathExists(dirPath))) {
        return skills;
      }
    } catch (error) {
      // Permission or other filesystem errors when checking directory existence
      throw new SkillLoadError(
        `Cannot access skills directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
        dirPath,
        error instanceof Error ? error : undefined
      );
    }

    let entries: string[];
    try {
      entries = await readdir(dirPath);
    } catch (error) {
      throw new SkillLoadError(
        `Failed to read skills directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
        dirPath,
        error instanceof Error ? error : undefined
      );
    }

    for (const entry of entries) {
      const entryPath = join(dirPath, entry);

      let entryStat;
      try {
        entryStat = await stat(entryPath);
      } catch (error) {
        // Skip entries we can't stat (permission issues, etc.)
        console.warn(`Skipping entry ${entryPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        continue;
      }

      if (entryStat.isDirectory()) {
        // Check for SKILL.md in subdirectory
        const skillFilePath = join(entryPath, 'SKILL.md');
        try {
          if (await pathExists(skillFilePath)) {
            const skill = await this.loadSkillFile(skillFilePath, location);
            if (skill) {
              skills.push(skill);
            }
          }
        } catch (error) {
          // Skip skills that fail to load
          console.warn(`Skipping skill at ${skillFilePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          continue;
        }
      } else if (entry === 'SKILL.md') {
        // Root level SKILL.md
        try {
          const skill = await this.loadSkillFile(entryPath, location);
          if (skill) {
            skills.push(skill);
          }
        } catch (error) {
          // Skip skills that fail to load
          console.warn(`Skipping skill at ${entryPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          continue;
        }
      }
    }

    return skills;
  }

  /**
   * Load a single skill file and parse its frontmatter.
   * Supports multi-line YAML values using literal (|) and folded (>) block scalars.
   *
   * @param filePath - Path to the SKILL.md file
   * @param location - Whether this is a 'project' or 'user' skill
   * @returns The loaded skill, or null if the file is invalid (missing required frontmatter)
   * @throws SkillLoadError if there's an I/O error reading the file
   *
   * @example
   * // Load a skill from a file
   * const skill = await this.loadSkillFile('/path/to/pdf/SKILL.md', 'project');
   * // Returns: { name: 'pdf', description: 'PDF skill', location: 'project', content: '...', basePath: '/path/to/pdf' }
   * // Returns null if frontmatter is missing name or description
   */
  private async loadSkillFile(
    filePath: string,
    location: 'project' | 'user'
  ): Promise<Skill | null> {
    let fileContent: string;
    try {
      fileContent = await readFile(filePath, 'utf-8');
    } catch (error) {
      throw new SkillLoadError(
        `Failed to read skill file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        filePath,
        error instanceof Error ? error : undefined
      );
    }

    // Use shared front-matter parser (supports multi-line YAML values)
    const { frontMatter, content } = parseFrontMatter(fileContent);

    if (!frontMatter || !frontMatter.name || !frontMatter.description) {
      // Return null for invalid skills - this is expected for malformed files
      // The caller can decide how to handle this (skip or report)
      return null;
    }

    return {
      name: frontMatter.name,
      description: frontMatter.description,
      location,
      content,
      basePath: dirname(filePath),
    };
  }
}
