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
import { parse } from '@babel/parser';
// Import @babel/traverse with proper ESM/CJS compatibility
import traverseModule from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import type * as t from '@babel/types';
import { glob } from 'glob';

const traverse = (traverseModule as any).default || traverseModule;

interface StoryMeta {
  title: string;
  component?: any;
  tags?: string[];
  parameters?: Record<string, any>;
  argTypes?: Record<string, any>;
}

function isValidStoryMeta(meta: Partial<StoryMeta> | null): meta is StoryMeta {
  return meta !== null && typeof meta.title === 'string' && meta.title.length > 0;
}

export interface ComponentInfo {
  title: string;
  filePath: string;
  fileHash: string;
  tags: string[];
  stories: string[];
  meta: StoryMeta;
}

export class StoriesIndexService {
  private componentIndex: Map<string, ComponentInfo> = new Map();
  private monorepoRoot: string;
  private initialized = false;

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
   * Index a single story file using static AST parsing
   */
  private async indexStoryFile(filePath: string): Promise<void> {
    // Read file content for hashing and parsing
    const content = await fs.readFile(filePath, 'utf-8');
    const fileHash = this.hashContent(content);

    // Parse the TypeScript/TSX file
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });

    let meta: Partial<StoryMeta> | null = null;
    const stories: string[] = [];

    // Traverse the AST to find exports
    const self = this;
    traverse(ast, {
      ExportDefaultDeclaration(path: NodePath<t.ExportDefaultDeclaration>) {
        // Extract the default export (meta object)
        const declaration = path.node.declaration;

        if (declaration.type === 'ObjectExpression') {
          meta = self.extractMetaFromObjectExpression(declaration);
        } else if (declaration.type === 'Identifier') {
          // Handle: const meta = {...}; export default meta;
          // Find the variable declaration
          const binding = path.scope.getBinding(declaration.name);
          if (binding?.path.node.type === 'VariableDeclarator') {
            const init = binding.path.node.init;
            if (init?.type === 'ObjectExpression') {
              meta = self.extractMetaFromObjectExpression(init);
            }
          }
        }
      },
      ExportNamedDeclaration(path: NodePath<t.ExportNamedDeclaration>) {
        // Extract named exports (stories)
        const declaration = path.node.declaration;

        if (declaration?.type === 'VariableDeclaration') {
          for (const declarator of declaration.declarations) {
            if (declarator.id.type === 'Identifier') {
              stories.push(declarator.id.name);
            }
          }
        } else if (declaration?.type === 'FunctionDeclaration' && declaration.id) {
          stories.push(declaration.id.name);
        }
      },
    });

    // Validate meta using type guard
    if (!isValidStoryMeta(meta)) {
      log.warn(`[StoriesIndexService] No valid default export meta in ${filePath}`);
      return;
    }

    // At this point, meta is guaranteed to be StoryMeta with a title
    const validMeta: StoryMeta = meta;

    // Extract tags from meta
    const tags = validMeta.tags || [];

    // Create component info
    const componentInfo: ComponentInfo = {
      title: validMeta.title,
      filePath,
      fileHash,
      tags,
      stories,
      meta: validMeta,
    };

    // Index by title
    this.componentIndex.set(validMeta.title, componentInfo);
  }

  /**
   * Extract meta object from AST ObjectExpression
   */
  private extractMetaFromObjectExpression(node: t.ObjectExpression): Partial<StoryMeta> {
    const meta: Partial<StoryMeta> = {};

    for (const prop of node.properties) {
      if (prop.type !== 'ObjectProperty') continue;

      const key = prop.key.type === 'Identifier' ? prop.key.name : null;
      if (!key) continue;

      const value = prop.value;

      if (key === 'title' && value.type === 'StringLiteral') {
        meta.title = value.value;
      } else if (key === 'tags' && value.type === 'ArrayExpression') {
        meta.tags = value.elements
          .filter((el): el is t.StringLiteral => el?.type === 'StringLiteral')
          .map((el) => el.value);
      }
    }

    return meta;
  }

  /**
   * Hash file content for cache invalidation
   */
  private hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get all components filtered by tags
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
   */
  getComponentByTitle(title: string): ComponentInfo | undefined {
    return this.componentIndex.get(title);
  }

  /**
   * Find component by partial name match
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
   */
  getAllComponents(): ComponentInfo[] {
    return Array.from(this.componentIndex.values());
  }

  /**
   * Clear the index (for testing)
   */
  clear(): void {
    this.componentIndex.clear();
    this.initialized = false;
  }
}
