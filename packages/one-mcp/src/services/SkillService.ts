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

import { readFile, readdir, stat, access, watch } from 'node:fs/promises';
import { join, dirname, isAbsolute } from 'node:path';
import type { Skill } from '../types';
import { parseFrontMatter } from '../utils';

/**
 * Error thrown when skill loading fails
 */
export class SkillLoadError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly cause?: Error,
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
      `Failed to check path existence for "${path}": ${error instanceof Error ? error.message : 'Unknown error'}`,
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
  /** Active file watchers for skill directories */
  private watchers: AbortController[] = [];
  /** Callback invoked when cache is invalidated due to file changes */
  private onCacheInvalidated?: () => void;

  /**
   * Creates a new SkillService instance
   * @param cwd - Current working directory for resolving relative paths
   * @param skillPaths - Array of paths to skills directories
   * @param options - Optional configuration
   * @param options.onCacheInvalidated - Callback invoked when cache is invalidated due to file changes
   */
  constructor(cwd: string, skillPaths: string[], options?: { onCacheInvalidated?: () => void }) {
    this.cwd = cwd;
    this.skillPaths = skillPaths;
    this.onCacheInvalidated = options?.onCacheInvalidated;
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

    // Load skills from all configured paths in parallel
    const allDirSkills = await Promise.all(
      this.skillPaths.map(async (skillPath) => {
        const skillsDir = isAbsolute(skillPath) ? skillPath : join(this.cwd, skillPath);
        return this.loadSkillsFromDirectory(skillsDir, 'project');
      }),
    );

    // Merge results while preserving precedence (earlier paths take priority)
    for (const dirSkills of allDirSkills) {
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
   * Starts watching skill directories for changes to SKILL.md files.
   * When changes are detected, the cache is automatically invalidated.
   *
   * Uses Node.js fs.watch with recursive option for efficient directory monitoring.
   * Only invalidates cache when SKILL.md files are modified.
   *
   * @example
   * const skillService = new SkillService(cwd, skillPaths, {
   *   onCacheInvalidated: () => console.log('Skills cache invalidated')
   * });
   * await skillService.startWatching();
   */
  async startWatching(): Promise<void> {
    // Stop any existing watchers first
    this.stopWatching();

    // Check all directories exist in parallel
    const existenceChecks = await Promise.all(
      this.skillPaths.map(async (skillPath) => {
        const skillsDir = isAbsolute(skillPath) ? skillPath : join(this.cwd, skillPath);
        return { skillsDir, exists: await pathExists(skillsDir) };
      }),
    );

    // Start watchers for existing directories
    for (const { skillsDir, exists } of existenceChecks) {
      if (!exists) continue;

      const abortController = new AbortController();
      this.watchers.push(abortController);

      // Start watching in background (don't await)
      this.watchDirectory(skillsDir, abortController.signal).catch((error) => {
        // Only log if not aborted
        if (error?.name !== 'AbortError') {
          console.error(
            `[skill-watcher] Error watching ${skillsDir}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      });
    }
  }

  /**
   * Stops all active file watchers.
   * Should be called when the service is being disposed.
   */
  stopWatching(): void {
    for (const controller of this.watchers) {
      controller.abort();
    }
    this.watchers = [];
  }

  /**
   * Watches a directory for changes to SKILL.md files.
   * @param dirPath - Directory path to watch
   * @param signal - AbortSignal to stop watching
   */
  private async watchDirectory(dirPath: string, signal: AbortSignal): Promise<void> {
    const watcher = watch(dirPath, { recursive: true, signal });

    for await (const event of watcher) {
      // Only invalidate cache when SKILL.md files change
      if (event.filename?.endsWith('SKILL.md')) {
        this.clearCache();
        this.onCacheInvalidated?.();
      }
    }
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
    location: 'project' | 'user',
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
        error instanceof Error ? error : undefined,
      );
    }

    let entries: string[];
    try {
      entries = await readdir(dirPath);
    } catch (error) {
      throw new SkillLoadError(
        `Failed to read skills directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
        dirPath,
        error instanceof Error ? error : undefined,
      );
    }

    // Stat all entries in parallel
    const entryStats = await Promise.all(
      entries.map(async (entry) => {
        const entryPath = join(dirPath, entry);
        try {
          return { entry, entryPath, stat: await stat(entryPath), error: null };
        } catch (error) {
          console.warn(
            `Skipping entry ${entryPath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
          return { entry, entryPath, stat: null, error };
        }
      }),
    );

    // Identify skill files to load in parallel
    const skillFilesToLoad: { filePath: string; isRootLevel: boolean }[] = [];

    for (const { entry, entryPath, stat: entryStat } of entryStats) {
      if (!entryStat) continue;

      if (entryStat.isDirectory()) {
        const skillFilePath = join(entryPath, 'SKILL.md');
        skillFilesToLoad.push({ filePath: skillFilePath, isRootLevel: false });
      } else if (entry === 'SKILL.md') {
        skillFilesToLoad.push({ filePath: entryPath, isRootLevel: true });
      }
    }

    // Load all skill files in parallel
    const loadResults = await Promise.all(
      skillFilesToLoad.map(async ({ filePath, isRootLevel }) => {
        try {
          // For subdirectory skills, check if file exists first
          if (!isRootLevel && !(await pathExists(filePath))) {
            return null;
          }
          return await this.loadSkillFile(filePath, location);
        } catch (error) {
          console.warn(
            `Skipping skill at ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
          return null;
        }
      }),
    );

    // Collect successful results
    for (const skill of loadResults) {
      if (skill) {
        skills.push(skill);
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
    location: 'project' | 'user',
  ): Promise<Skill | null> {
    let fileContent: string;
    try {
      fileContent = await readFile(filePath, 'utf-8');
    } catch (error) {
      throw new SkillLoadError(
        `Failed to read skill file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        filePath,
        error instanceof Error ? error : undefined,
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
