/**
 * ListAppComponentsTool
 *
 * DESIGN PATTERNS:
 * - Tool pattern with getDefinition() and execute() methods
 * - Service delegation for business logic
 * - JSON Schema validation for inputs
 *
 * CODING STANDARDS:
 * - Implement Tool interface from ../types
 * - Use TOOL_NAME constant with snake_case (e.g., 'list_app_components')
 * - Return CallToolResult with content array
 * - Handle errors with isError flag
 * - Delegate complex logic to services
 *
 * AVOID:
 * - Complex business logic in execute method
 * - Unhandled promise rejections
 * - Missing input validation
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { log, TemplatesManagerService } from '@agiflowai/aicode-utils';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { glob } from 'glob';
import { StoriesIndexService } from '../services/StoriesIndexService.js';
import type { Tool, ToolDefinition } from '../types/index.js';

interface ListAppComponentsInput {
  appPath: string;
  cursor?: string;
}

/**
 * Find all package.json files in the monorepo and build a map of package name → directory path
 */
async function buildPackageMap(monorepoRoot: string): Promise<Map<string, string>> {
  const packageMap = new Map<string, string>();

  // Find all package.json files
  const packageJsonFiles = await glob('**/package.json', {
    cwd: monorepoRoot,
    ignore: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/build/**'],
    absolute: true,
  });

  for (const pkgJsonPath of packageJsonFiles) {
    try {
      const content = await fs.readFile(pkgJsonPath, 'utf-8');
      const pkgJson = JSON.parse(content);

      if (pkgJson.name) {
        const pkgDir = path.dirname(pkgJsonPath);
        packageMap.set(pkgJson.name, pkgDir);
      }
    } catch (error) {
      // Skip invalid package.json files
    }
  }

  return packageMap;
}

export class ListAppComponentsTool implements Tool<ListAppComponentsInput> {
  static readonly TOOL_NAME = 'list-app-components';
  static readonly PAGE_SIZE = 50; // Components per page

  /**
   * Encode pagination state into an opaque cursor string
   */
  private encodeCursor(offset: number): string {
    return Buffer.from(JSON.stringify({ offset })).toString('base64');
  }

  /**
   * Decode cursor string into pagination state
   */
  private decodeCursor(cursor: string): { offset: number } {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded);
      return { offset: parsed.offset || 0 };
    } catch {
      // Invalid cursor, start from beginning
      return { offset: 0 };
    }
  }

  getDefinition(): ToolDefinition {
    return {
      name: ListAppComponentsTool.TOOL_NAME,
      description:
        "List app-specific components and package components used by an app. Reads the app's package.json to find workspace dependencies and returns components from both the app and its dependent packages.",
      inputSchema: {
        type: 'object',
        properties: {
          appPath: {
            type: 'string',
            description: 'The app path (relative or absolute) to list components for (e.g., "apps/agiflow-app")',
          },
          cursor: {
            type: 'string',
            description: 'Optional pagination cursor to fetch the next page of results. Omit to fetch the first page.',
          },
        },
        required: ['appPath'],
        additionalProperties: false,
      },
    };
  }

  async execute(input: ListAppComponentsInput): Promise<CallToolResult> {
    try {
      const { appPath, cursor } = input;

      // Decode cursor to get pagination offset
      const { offset } = cursor ? this.decodeCursor(cursor) : { offset: 0 };

      const monorepoRoot = TemplatesManagerService.getWorkspaceRootSync();

      // Resolve app path (could be relative or absolute)
      const resolvedAppPath = path.isAbsolute(appPath) ? appPath : path.join(monorepoRoot, appPath);

      // Read app's package.json to get workspace dependencies
      const packageJsonPath = path.join(resolvedAppPath, 'package.json');
      const projectJsonPath = path.join(resolvedAppPath, 'project.json');

      let appName = path.basename(resolvedAppPath);
      let workspaceDependencies: string[] = [];

      // Get app name from project.json
      try {
        const projectJson = JSON.parse(await fs.readFile(projectJsonPath, 'utf-8'));
        appName = projectJson.name || appName;
      } catch (error) {
        log.warn(`[ListAppComponentsTool] Could not read project.json for ${appPath}:`, error);
      }

      // Get workspace dependencies from package.json
      try {
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

        // Find workspace dependencies (dependencies with "workspace:*" version)
        const allDeps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };

        workspaceDependencies = Object.entries(allDeps)
          .filter(([_name, version]) => typeof version === 'string' && version.startsWith('workspace:'))
          .map(([name]) => name);

        log.info(
          `[ListAppComponentsTool] Found ${workspaceDependencies.length} workspace dependencies for ${appName}`,
        );
      } catch (error) {
        log.warn(`[ListAppComponentsTool] Could not read package.json for ${appPath}:`, error);
      }

      // Build package name → directory path map
      const packageMap = await buildPackageMap(monorepoRoot);

      const storiesIndex = new StoriesIndexService();
      await storiesIndex.initialize();

      // Get all components
      const allComponents = storiesIndex.getAllComponents();

      // Separate app-specific components and package components
      const appComponentsSet = new Set<string>();
      const packageComponentsMap: Record<string, Set<string>> = {};

      for (const component of allComponents) {
        // Check if component is app-specific (has app tag)
        const hasAppTag = component.tags.includes(appName);

        if (hasAppTag) {
          const componentName = component.title.split('/').pop() || component.title;
          appComponentsSet.add(componentName);
        }

        // Check if component belongs to a workspace dependency
        for (const dep of workspaceDependencies) {
          const packageDir = packageMap.get(dep);

          if (packageDir && component.filePath.startsWith(packageDir)) {
            if (!packageComponentsMap[dep]) {
              packageComponentsMap[dep] = new Set();
            }
            const componentName = component.title.split('/').pop() || component.title;
            packageComponentsMap[dep].add(componentName);
          }
        }
      }

      // Convert Sets to arrays
      const packageComponents: Record<string, string[]> = {};
      for (const [pkg, componentsSet] of Object.entries(packageComponentsMap)) {
        packageComponents[pkg] = Array.from(componentsSet).sort();
      }

      // Prepare full sorted component lists
      const appComponentsArray = Array.from(appComponentsSet).sort();

      // Calculate total count for logging
      const totalPackageComponents = Object.values(packageComponents).reduce((sum, arr) => sum + arr.length, 0);
      const totalComponents = appComponentsArray.length + totalPackageComponents;

      // Apply pagination: slice app components
      const paginatedAppComponents = appComponentsArray.slice(offset, offset + ListAppComponentsTool.PAGE_SIZE);

      // Calculate remaining space for package components
      const remainingSpace = ListAppComponentsTool.PAGE_SIZE - paginatedAppComponents.length;

      // Paginate package components if needed
      const paginatedPackageComponents: Record<string, string[]> = {};
      let packageComponentsConsumed = 0;

      if (remainingSpace > 0 && offset < appComponentsArray.length + totalPackageComponents) {
        // Calculate offset within package components
        const packageOffset = Math.max(0, offset - appComponentsArray.length);
        let itemsToTake = remainingSpace;
        let currentOffset = packageOffset;

        for (const [pkg, components] of Object.entries(packageComponents)) {
          if (itemsToTake <= 0) break;

          if (currentOffset < components.length) {
            const sliced = components.slice(currentOffset, currentOffset + itemsToTake);
            paginatedPackageComponents[pkg] = sliced;
            packageComponentsConsumed += sliced.length;
            itemsToTake -= sliced.length;
            currentOffset = 0; // Reset offset for subsequent packages
          } else {
            currentOffset -= components.length;
          }
        }
      }

      // Determine if there are more results
      const totalReturned = paginatedAppComponents.length + packageComponentsConsumed;
      const hasMore = offset + totalReturned < totalComponents;

      const result: {
        app: string;
        appComponents: string[];
        packageComponents: Record<string, string[]>;
        pagination: {
          offset: number;
          pageSize: number;
          totalComponents: number;
          hasMore: boolean;
        };
        nextCursor?: string;
      } = {
        app: appName,
        appComponents: paginatedAppComponents,
        packageComponents: paginatedPackageComponents,
        pagination: {
          offset,
          pageSize: ListAppComponentsTool.PAGE_SIZE,
          totalComponents,
          hasMore,
        },
      };

      // Add nextCursor if there are more results
      if (hasMore) {
        result.nextCursor = this.encodeCursor(offset + totalReturned);
      }

      log.info(
        `[ListAppComponentsTool] Page ${Math.floor(offset / ListAppComponentsTool.PAGE_SIZE) + 1}: ` +
          `Returned ${totalReturned} of ${totalComponents} total components (hasMore: ${hasMore})`,
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }
}
