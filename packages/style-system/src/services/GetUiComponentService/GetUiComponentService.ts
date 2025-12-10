/**
 * GetUiComponentService
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
import { log } from '@agiflowai/aicode-utils';
import type { DesignSystemConfig } from '../../config';
import { getAppDesignSystemConfig } from '../../config';
import { ComponentRendererService } from '../ComponentRendererService';
import { StoriesIndexService } from '../StoriesIndexService';
import type {
  GetUiComponentInput,
  GetUiComponentResult,
  GetUiComponentServiceConfig,
} from './types';
import { DEFAULT_GET_UI_COMPONENT_CONFIG } from './types';

/**
 * Factory function type for creating StoriesIndexService instances.
 */
export type StoriesIndexFactory = () => StoriesIndexService;

/**
 * Factory function type for creating ComponentRendererService instances.
 */
export type RendererFactory = (config: DesignSystemConfig, appPath: string) => ComponentRendererService;

/**
 * GetUiComponentService handles rendering UI component previews.
 *
 * Locates components in the stories index, renders them with app-specific
 * design system configuration, and returns screenshot results.
 *
 * @example
 * ```typescript
 * const service = new GetUiComponentService();
 * const result = await service.getComponent({
 *   componentName: 'Button',
 *   appPath: 'apps/my-app',
 * });
 * console.log(result.imagePath);
 * ```
 */
export class GetUiComponentService {
  private config: Required<GetUiComponentServiceConfig>;
  private storiesIndexFactory: StoriesIndexFactory;
  private rendererFactory: RendererFactory;

  /**
   * Creates a new GetUiComponentService instance.
   * @param config - Service configuration options
   * @param storiesIndexFactory - Factory for creating StoriesIndexService (for DI/testing)
   * @param rendererFactory - Factory for creating ComponentRendererService (for DI/testing)
   */
  constructor(
    config: GetUiComponentServiceConfig = {},
    storiesIndexFactory: StoriesIndexFactory = () => new StoriesIndexService(),
    rendererFactory: RendererFactory = (c, p) => new ComponentRendererService(c, p),
  ) {
    this.config = { ...DEFAULT_GET_UI_COMPONENT_CONFIG, ...config };
    this.storiesIndexFactory = storiesIndexFactory;
    this.rendererFactory = rendererFactory;
  }

  /**
   * Get a UI component preview image.
   *
   * @param input - Component input parameters
   * @returns Result with image path and component metadata
   * @throws Error if input validation fails, component not found, or rendering fails
   */
  async getComponent(input: GetUiComponentInput): Promise<GetUiComponentResult> {
    // Validate required inputs
    if (!input.componentName || typeof input.componentName !== 'string') {
      throw new Error('componentName is required and must be a non-empty string');
    }
    if (!input.appPath || typeof input.appPath !== 'string') {
      throw new Error('appPath is required and must be a non-empty string');
    }

    // Validate optional inputs before applying defaults.
    // This guards against incorrect types from untyped callers at runtime.
    if (input.storyName !== undefined && typeof input.storyName !== 'string') {
      throw new Error('storyName must be a string');
    }
    if (input.darkMode !== undefined && typeof input.darkMode !== 'boolean') {
      throw new Error('darkMode must be a boolean');
    }
    if (input.selector !== undefined) {
      if (typeof input.selector !== 'string') {
        throw new Error('selector must be a string');
      }
      // Validate selector to prevent CSS injection attacks
      // Only allow safe CSS selector characters
      if (!/^[a-zA-Z0-9_\-#.\[\]=":' ]+$/.test(input.selector)) {
        throw new Error('selector contains invalid characters');
      }
      // Prevent JavaScript execution in selectors
      if (/javascript:|expression\(|url\(/i.test(input.selector)) {
        throw new Error('selector contains potentially malicious content');
      }
    }

    const {
      componentName,
      appPath,
      storyName = this.config.defaultStoryName,
      darkMode = this.config.defaultDarkMode,
    } = input;

    log.info(
      `[GetUiComponentService] Starting for component: ${componentName}, appPath: ${appPath}, storyName: ${storyName}`,
    );

    // Initialize stories index using injected factory
    const storiesIndex = this.storiesIndexFactory();
    try {
      await storiesIndex.initialize();
    } catch (error) {
      throw new Error(
        `Failed to initialize stories index: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Find the component
    const componentInfo = storiesIndex.findComponentByName(componentName);

    if (!componentInfo) {
      throw new Error(
        `Component "${componentName}" not found in stories index. Ensure the component has a .stories.tsx file and has been indexed.`,
      );
    }

    log.info(`[GetUiComponentService] Found component: ${componentInfo.title}`);

    // Validate story exists and get valid story name
    const validStoryName = this.resolveStoryName(storyName, componentInfo.stories);

    // Get app-specific design system configuration
    const designSystemConfig = await getAppDesignSystemConfig(appPath);
    log.info(`[GetUiComponentService] Using theme provider: ${designSystemConfig.themeProvider}`);
    log.info(`[GetUiComponentService] Design system type: ${designSystemConfig.type}`);

    // Render the component with app-specific config using injected factory
    const renderer = this.rendererFactory(designSystemConfig, appPath);

    try {
      const renderResult = await renderer.renderComponent(componentInfo, {
        storyName: validStoryName,
        width: this.config.defaultWidth,
        height: this.config.defaultHeight,
        darkMode,
      });

      log.info(`[GetUiComponentService] Component rendered to: ${renderResult.imagePath}`);

      // Read the story file content
      const storyFileContent = await this.readStoryFile(componentInfo.filePath);

      log.info('[GetUiComponentService] Completed successfully');

      return {
        imagePath: renderResult.imagePath,
        format: 'png',
        dimensions: '900px width, 80% quality',
        storyFilePath: componentInfo.filePath,
        storyFileContent,
        componentTitle: componentInfo.title,
        availableStories: componentInfo.stories,
        renderedStory: validStoryName,
      };
    } finally {
      // Ensure Vite server is always cleaned up
      await renderer.dispose();
    }
  }

  /**
   * Resolve and validate the story name.
   *
   * @param requestedStory - The requested story name
   * @param availableStories - List of available stories for the component
   * @returns Valid story name (requested or fallback)
   */
  private resolveStoryName(requestedStory: string, availableStories: string[]): string {
    if (availableStories.includes(requestedStory)) {
      return requestedStory;
    }

    log.warn(
      `[GetUiComponentService] Story "${requestedStory}" not found, available stories: ${availableStories.join(', ')}`,
    );

    // Fallback to first available story, or 'Default' if no stories exist
    const fallbackStory = availableStories[0] || 'Default';
    log.info(`[GetUiComponentService] Using fallback story: ${fallbackStory}`);

    return fallbackStory;
  }

  /**
   * Read the story file content.
   *
   * @param filePath - Path to the story file
   * @returns File content or error message
   */
  private async readStoryFile(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      log.info(`[GetUiComponentService] Story file read successfully (${content.length} chars)`);
      return content;
    } catch (error) {
      log.warn(
        `[GetUiComponentService] Warning: Could not read story file: ${error instanceof Error ? error.message : String(error)}`,
      );
      return `// Could not read file: ${filePath}\n// Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}
