/**
 * AppComponentsService
 *
 * DESIGN PATTERNS:
 * - Service pattern for business logic encapsulation
 * - Single responsibility principle
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

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { log, TemplatesManagerService } from '@agiflowai/aicode-utils';
import { glob } from 'glob';
import { StoriesIndexService } from '../StoriesIndexService';
import type {
  AppComponentsServiceConfig,
  AppComponentsServiceResult,
  ComponentBrief,
  ListAppComponentsInput,
  PaginationState,
} from './types';
import { DEFAULT_APP_COMPONENTS_CONFIG } from './types';

/**
 * AppComponentsService handles listing app-specific and package components.
 *
 * Detects components by file path (within app directory) and resolves
 * workspace dependencies to find package components.
 *
 * @example
 * ```typescript
 * const service = new AppComponentsService();
 * const result = await service.listComponents({ appPath: 'apps/my-app' });
 * // Returns: { app: 'my-app', appComponents: ['Button'], packageComponents: {...}, pagination: {...} }
 * ```
 */
export class AppComponentsService {
  private config: Required<AppComponentsServiceConfig>;

  /**
   * Creates a new AppComponentsService instance.
   * @param config - Service configuration options
   */
  constructor(config: AppComponentsServiceConfig = {}) {
    this.config = { ...DEFAULT_APP_COMPONENTS_CONFIG, ...config };
  }

  /**
   * List app-specific and package components for a given application.
   * @param input - Object containing appPath and optional cursor for pagination
   * @returns Promise resolving to paginated component list
   * @throws Error if input validation fails, app path does not exist, or stories index fails to initialize
   */
  async listComponents(input: ListAppComponentsInput): Promise<AppComponentsServiceResult> {
    // Validate required inputs
    if (!input.appPath || typeof input.appPath !== 'string') {
      throw new Error('appPath is required and must be a non-empty string');
    }

    // Validate optional inputs before applying defaults.
    // This guards against incorrect types from untyped callers at runtime.
    if (input.cursor !== undefined && typeof input.cursor !== 'string') {
      throw new Error('cursor must be a string');
    }

    const { appPath, cursor } = input;

    // Decode cursor to get pagination offset (offset starts at 0 for first page)
    const { offset } = cursor ? this.decodeCursor(cursor) : { offset: 0 };

    const monorepoRoot = TemplatesManagerService.getWorkspaceRootSync();

    // Resolve app path (could be relative or absolute)
    const resolvedAppPath = path.isAbsolute(appPath) ? appPath : path.join(monorepoRoot, appPath);

    // Validate app path exists
    try {
      await fs.access(resolvedAppPath);
    } catch {
      throw new Error(`App path does not exist: ${resolvedAppPath}`);
    }

    // Get app name and workspace dependencies
    const appName = await this.getAppName(resolvedAppPath);
    const workspaceDependencies = await this.getWorkspaceDependencies(resolvedAppPath);

    log.info(
      `[AppComponentsService] Found ${workspaceDependencies.length} workspace dependencies for ${appName}`,
    );

    // Build package name → directory path map
    const packageMap = await this.buildPackageMap(monorepoRoot);

    // Initialize stories index and get all components
    const storiesIndex = new StoriesIndexService();
    await storiesIndex.initialize();
    const allComponents = storiesIndex.getAllComponents();

    // Categorize components into app-specific and package components
    const { appComponentsArray, packageComponents, totalPackageComponents } =
      this.categorizeComponents(allComponents, resolvedAppPath, workspaceDependencies, packageMap);

    const totalComponents = appComponentsArray.length + totalPackageComponents;

    // Apply pagination to component lists
    const { paginatedAppComponents, paginatedPackageComponents, totalReturned } =
      this.paginateComponents(appComponentsArray, packageComponents, offset);

    // hasMore is true when there are more components beyond current page
    const hasMore = offset + totalReturned < totalComponents;

    const result: AppComponentsServiceResult = {
      app: appName,
      appComponents: paginatedAppComponents,
      packageComponents: paginatedPackageComponents,
      pagination: {
        offset,
        pageSize: this.config.pageSize,
        totalComponents,
        hasMore,
      },
    };

    // Add nextCursor if there are more results
    if (hasMore) {
      result.nextCursor = this.encodeCursor(offset + totalReturned);
    }

    log.info(
      `[AppComponentsService] Page ${Math.floor(offset / this.config.pageSize) + 1}: ` +
        `Returned ${totalReturned} of ${totalComponents} total components (hasMore: ${hasMore})`,
    );

    return result;
  }

  /**
   * Get app name from project.json.
   * @param resolvedAppPath - Absolute path to the app directory
   * @returns App name from project.json or directory basename as fallback
   */
  private async getAppName(resolvedAppPath: string): Promise<string> {
    const projectJsonPath = path.join(resolvedAppPath, 'project.json');
    let appName = path.basename(resolvedAppPath);

    try {
      const projectJson = JSON.parse(await fs.readFile(projectJsonPath, 'utf-8'));
      appName = projectJson.name || appName;
    } catch (error) {
      log.warn(
        `[AppComponentsService] Could not read project.json for ${resolvedAppPath}:`,
        error,
      );
    }

    return appName;
  }

  /**
   * Get workspace dependencies from package.json.
   * @param resolvedAppPath - Absolute path to the app directory
   * @returns Array of workspace dependency package names
   */
  private async getWorkspaceDependencies(resolvedAppPath: string): Promise<string[]> {
    const packageJsonPath = path.join(resolvedAppPath, 'package.json');

    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

      // Find workspace dependencies (dependencies with "workspace:*" version)
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      return Object.entries(allDeps)
        .filter(([_name, version]) => typeof version === 'string' && version.startsWith('workspace:'))
        .map(([name]) => name);
    } catch (error) {
      log.warn(
        `[AppComponentsService] Could not read package.json for ${resolvedAppPath}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Find all package.json files in the monorepo and build a map of package name → directory path.
   * @param monorepoRoot - The root directory of the monorepo
   * @returns Promise resolving to a Map where keys are package names and values are directory paths
   * @throws Error if scanning for package.json files fails
   */
  private async buildPackageMap(monorepoRoot: string): Promise<Map<string, string>> {
    const packageMap = new Map<string, string>();

    // Find all package.json files
    let packageJsonFiles: string[];
    try {
      packageJsonFiles = await glob('**/package.json', {
        cwd: monorepoRoot,
        ignore: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/build/**'],
        absolute: true,
      });
    } catch (error) {
      throw new Error(
        `Failed to scan for package.json files in ${monorepoRoot}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    for (const pkgJsonPath of packageJsonFiles) {
      try {
        const content = await fs.readFile(pkgJsonPath, 'utf-8');
        const pkgJson = JSON.parse(content);

        if (pkgJson.name) {
          const pkgDir = path.dirname(pkgJsonPath);
          packageMap.set(pkgJson.name, pkgDir);
        }
      } catch (error) {
        log.debug(`[AppComponentsService] Skipping invalid package.json at ${pkgJsonPath}:`, error);
      }
    }

    return packageMap;
  }

  /**
   * Categorize components into app-specific and package components.
   * App components are detected by file path (within app directory).
   * Package components are matched to workspace dependencies.
   *
   * @param allComponents - All components from stories index
   * @param resolvedAppPath - Absolute path to the app directory
   * @param workspaceDependencies - List of workspace dependency package names
   * @param packageMap - Map of package name to directory path
   * @returns Categorized components with totals
   */
  private categorizeComponents(
    allComponents: Array<{ filePath: string; title: string; description?: string }>,
    resolvedAppPath: string,
    workspaceDependencies: string[],
    packageMap: Map<string, string>,
  ): {
    appComponentsArray: ComponentBrief[];
    packageComponents: Record<string, ComponentBrief[]>;
    totalPackageComponents: number;
  } {
    // Use Maps keyed by component name to deduplicate while preserving ComponentBrief data
    const appComponentsMap = new Map<string, ComponentBrief>();
    const packageComponentsMap: Record<string, Map<string, ComponentBrief>> = {};

    for (const component of allComponents) {
      const componentName = component.title.split('/').pop() || component.title;
      const componentBrief: ComponentBrief = {
        name: componentName,
        ...(component.description && { description: component.description }),
      };

      // Check if component is app-specific by file path (within app directory)
      const isAppComponent = component.filePath.startsWith(resolvedAppPath);

      if (isAppComponent) {
        appComponentsMap.set(componentName, componentBrief);
      }

      // Check if component belongs to a workspace dependency
      for (const dep of workspaceDependencies) {
        const packageDir = packageMap.get(dep);

        if (packageDir && component.filePath.startsWith(packageDir)) {
          if (!packageComponentsMap[dep]) {
            packageComponentsMap[dep] = new Map();
          }
          packageComponentsMap[dep].set(componentName, componentBrief);
        }
      }
    }

    // Convert Maps to sorted arrays
    const packageComponents: Record<string, ComponentBrief[]> = {};
    for (const [pkg, componentsMap] of Object.entries(packageComponentsMap)) {
      packageComponents[pkg] = Array.from(componentsMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name),
      );
    }

    const appComponentsArray = Array.from(appComponentsMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    const totalPackageComponents = Object.values(packageComponents).reduce(
      (sum, arr) => sum + arr.length,
      0,
    );

    return { appComponentsArray, packageComponents, totalPackageComponents };
  }

  /**
   * Apply pagination to component lists.
   *
   * Pagination strategy:
   * 1. First, fill page with app components starting from offset
   * 2. Then, fill remaining page space with package components in order
   * 3. Track total returned for cursor calculation
   *
   * @param appComponentsArray - Sorted array of app component briefs
   * @param packageComponents - Record of package name to component briefs
   * @param offset - Current pagination offset (0-indexed)
   * @returns Paginated components and total returned count
   */
  private paginateComponents(
    appComponentsArray: ComponentBrief[],
    packageComponents: Record<string, ComponentBrief[]>,
    offset: number,
  ): {
    paginatedAppComponents: ComponentBrief[];
    paginatedPackageComponents: Record<string, ComponentBrief[]>;
    totalReturned: number;
  } {
    const totalPackageComponents = Object.values(packageComponents).reduce(
      (sum, arr) => sum + arr.length,
      0,
    );
    const totalComponents = appComponentsArray.length + totalPackageComponents;

    // Step 1: Slice app components for current page
    const paginatedAppComponents = appComponentsArray.slice(offset, offset + this.config.pageSize);

    // Step 2: Calculate remaining slots for package components
    const remainingSpace = this.config.pageSize - paginatedAppComponents.length;

    // Step 3: Fill remaining slots with package components
    const paginatedPackageComponents: Record<string, ComponentBrief[]> = {};
    let packageComponentsConsumed = 0;

    if (remainingSpace > 0 && offset < totalComponents) {
      // Calculate offset within package components (after app components)
      const packageOffset = Math.max(0, offset - appComponentsArray.length);
      let itemsToTake = remainingSpace;
      let currentOffset = packageOffset;

      // Iterate through packages and slice components to fill remaining page space
      for (const [pkg, components] of Object.entries(packageComponents)) {
        if (itemsToTake <= 0) break;

        if (currentOffset < components.length) {
          const sliced = components.slice(currentOffset, currentOffset + itemsToTake);
          paginatedPackageComponents[pkg] = sliced;
          packageComponentsConsumed += sliced.length;
          itemsToTake -= sliced.length;
          currentOffset = 0; // Reset offset for subsequent packages
        } else {
          // Skip this package's components as they're before current offset
          currentOffset -= components.length;
        }
      }
    }

    const totalReturned = paginatedAppComponents.length + packageComponentsConsumed;

    return { paginatedAppComponents, paginatedPackageComponents, totalReturned };
  }

  /**
   * Encode pagination state into a base64 cursor string.
   * @param offset - The current offset position in the component list
   * @returns Base64-encoded cursor string for the next page
   */
  private encodeCursor(offset: number): string {
    return Buffer.from(JSON.stringify({ offset })).toString('base64');
  }

  /**
   * Decode cursor string into pagination state.
   * @param cursor - Base64-encoded cursor string from previous response
   * @returns Object with offset position; defaults to 0 if cursor is invalid
   */
  private decodeCursor(cursor: string): PaginationState {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded);
      return { offset: parsed.offset || 0 };
    } catch {
      // Invalid or malformed cursor - gracefully reset to beginning
      log.debug('[AppComponentsService] Invalid cursor, resetting to offset 0');
      return { offset: 0 };
    }
  }
}
