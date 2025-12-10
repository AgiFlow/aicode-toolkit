/**
 * StoriesIndexService
 *
 * DESIGN PATTERNS:
 * - Service pattern for business logic encapsulation
 * - Single responsibility principle
 * - Caching with file content hashing
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

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { log, TemplatesManagerService } from '@agiflowai/aicode-utils';
import { loadCsf } from '@storybook/csf-tools';
import { glob } from 'glob';
import type { ComponentInfo, StoryMeta } from './types';

/**
 * StoriesIndexService handles indexing and querying Storybook story files.
 *
 * Provides methods for scanning story files, extracting metadata using AST parsing,
 * and querying components by tags, title, or name.
 *
 * @example
 * ```typescript
 * const service = new StoriesIndexService();
 * await service.initialize();
 * const components = service.getAllComponents();
 * const button = service.findComponentByName('Button');
 * ```
 */
export class StoriesIndexService {
  private componentIndex: Map<string, ComponentInfo> = new Map();
  private monorepoRoot: string;
  private initialized = false;

  /**
   * Creates a new StoriesIndexService instance
   */
  constructor() {
    this.monorepoRoot = TemplatesManagerService.getWorkspaceRootSync();
  }

  /**
   * Initialize the index by scanning all .stories files
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    log.info('[StoriesIndexService] Initializing story index...');

    // Find all .stories.tsx and .stories.ts files
    const storyFiles = await glob('**/*.stories.{ts,tsx}', {
      cwd: this.monorepoRoot,
      ignore: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/build/**'],
      absolute: true,
    });

    log.info(`[StoriesIndexService] Found ${storyFiles.length} story files`);

    // Process each story file
    for (const filePath of storyFiles) {
      try {
        await this.indexStoryFile(filePath);
      } catch (error) {
        log.error(`[StoriesIndexService] Error indexing ${filePath}:`, error);
      }
    }

    this.initialized = true;
    log.info(`[StoriesIndexService] Indexed ${this.componentIndex.size} components`);
  }

  /**
   * Index a single story file using @storybook/csf-tools.
   *
   * Uses the official Storybook CSF parser which handles all CSF formats
   * including TypeScript satisfies/as expressions.
   */
  private async indexStoryFile(filePath: string): Promise<void> {
    // Read file content for hashing and parsing
    const content = await fs.readFile(filePath, 'utf-8');
    const fileHash = this.hashContent(content);

    // Parse the story file using @storybook/csf-tools
    const csf = loadCsf(content, {
      fileName: filePath,
      makeTitle: (title) => title,
    });

    // Parse the CSF to extract meta and stories
    await csf.parse();

    // Validate meta exists with title
    if (!csf.meta?.title) {
      log.warn(`[StoriesIndexService] No valid meta title in ${filePath}`);
      return;
    }

    // Extract story names from the parsed stories (filter out undefined)
    const stories = csf.stories.map((story) => story.name).filter((name): name is string => !!name);

    // Extract tags (ensure it's an array of strings)
    const tags: string[] = Array.isArray(csf.meta.tags) ? csf.meta.tags.filter((t): t is string => typeof t === 'string') : [];

    // Extract description from file header JSDoc or meta.parameters.docs.description
    const description = this.extractDescription(content, csf.meta as unknown as Record<string, unknown>);

    // Build StoryMeta from csf.meta
    const meta: StoryMeta = {
      title: csf.meta.title,
      tags,
    };

    // Create component info
    const componentInfo: ComponentInfo = {
      title: meta.title,
      filePath,
      fileHash,
      tags,
      stories,
      meta,
      description,
    };

    // Index by title
    this.componentIndex.set(meta.title, componentInfo);
  }

  /**
   * Extract component description from file header JSDoc or meta.parameters.docs.description.
   *
   * Priority:
   * 1. meta.parameters.docs.description.component (Storybook standard)
   * 2. File header JSDoc comment (first block comment in file)
   *
   * @param content - Raw file content
   * @param meta - Parsed meta object from csf-tools
   * @returns Description string or undefined
   */
  private extractDescription(
    content: string,
    meta: Record<string, unknown>,
  ): string | undefined {
    // Priority 1: Check meta.parameters.docs.description.component
    const parameters = meta?.parameters as Record<string, unknown> | undefined;
    const docs = parameters?.docs as Record<string, unknown> | undefined;
    const descriptionObj = docs?.description as Record<string, unknown> | undefined;
    const docsDescription = descriptionObj?.component;
    if (typeof docsDescription === 'string' && docsDescription.trim()) {
      return docsDescription.trim();
    }

    // Priority 2: Extract file header JSDoc comment
    // Look for the first block comment at the start of the file (after optional whitespace)
    const jsDocMatch = content.match(/^\s*\/\*\*\s*([\s\S]*?)\s*\*\//);
    if (jsDocMatch?.[1]) {
      // Clean up JSDoc formatting: remove leading asterisks and normalize whitespace
      const description = jsDocMatch[1]
        .split('\n')
        .map((line) => line.replace(/^\s*\*\s?/, '').trim())
        .filter((line) => !line.startsWith('@')) // Remove JSDoc tags
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (description) {
        return description;
      }
    }

    return undefined;
  }

  /**
   * Hash file content for cache invalidation
   */
  private hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get all components filtered by tags
   * @param tags - Optional array of tags to filter by
   * @returns Array of matching components
   */
  getComponentsByTags(tags?: string[]): ComponentInfo[] {
    const components = Array.from(this.componentIndex.values());

    if (!tags || tags.length === 0) {
      return components;
    }

    return components.filter((component) => tags.some((tag) => component.tags.includes(tag)));
  }

  /**
   * Get component by title
   * @param title - Exact title to match (e.g., "Components/Button")
   * @returns Component info or undefined
   */
  getComponentByTitle(title: string): ComponentInfo | undefined {
    return this.componentIndex.get(title);
  }

  /**
   * Find component by partial name match
   * @param name - Partial name to search for
   * @returns First matching component or undefined
   */
  findComponentByName(name: string): ComponentInfo | undefined {
    const lowerName = name.toLowerCase();

    // First try exact match on the component name (last part of title)
    for (const component of this.componentIndex.values()) {
      const componentName = component.title.split('/').pop() || component.title;
      if (componentName.toLowerCase() === lowerName) {
        return component;
      }
    }

    // Then try partial match
    for (const component of this.componentIndex.values()) {
      const componentName = component.title.split('/').pop() || component.title;
      if (componentName.toLowerCase().includes(lowerName)) {
        return component;
      }
    }

    return undefined;
  }

  /**
   * Refresh a specific file if it has changed
   * @param filePath - Absolute path to story file
   * @returns True if file was updated, false if unchanged
   */
  async refreshFile(filePath: string): Promise<boolean> {
    const content = await fs.readFile(filePath, 'utf-8');
    const newHash = this.hashContent(content);

    // Find existing component with this file path
    const existingComponent = Array.from(this.componentIndex.values()).find((c) => c.filePath === filePath);

    if (existingComponent && existingComponent.fileHash === newHash) {
      // No changes
      return false;
    }

    // Re-index the file
    await this.indexStoryFile(filePath);
    return true;
  }

  /**
   * Get all indexed components
   * @returns Array of all component info objects
   */
  getAllComponents(): ComponentInfo[] {
    return Array.from(this.componentIndex.values());
  }

  /**
   * Clear the index (useful for testing)
   */
  clear(): void {
    this.componentIndex.clear();
    this.initialized = false;
  }

  /**
   * Get all unique tags from indexed components
   * @returns Sorted array of unique tag names
   */
  getAllTags(): string[] {
    const tagSet = new Set<string>();

    for (const component of this.componentIndex.values()) {
      for (const tag of component.tags) {
        tagSet.add(tag);
      }
    }

    return Array.from(tagSet).sort();
  }
}
