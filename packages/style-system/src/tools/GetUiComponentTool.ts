/**
 * GetUiComponentTool
 *
 * DESIGN PATTERNS:
 * - Tool pattern with getDefinition() and execute() methods
 * - Service delegation for business logic
 * - JSON Schema validation for inputs
 *
 * CODING STANDARDS:
 * - Implement Tool interface from ../types
 * - Use TOOL_NAME constant with snake_case (e.g., 'get_ui_component')
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
import { log } from '@agiflowai/aicode-utils';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { getAppDesignSystemConfig } from '../config';
import { ComponentRendererService } from '../services/ComponentRendererService';
import { StoriesIndexService } from '../services/StoriesIndexService';
import type { Tool, ToolDefinition } from '../types';

interface GetUiComponentInput {
  componentName: string;
  appPath: string;
  storyName?: string;
  darkMode?: boolean;
  selector?: string;
}

export class GetUiComponentTool implements Tool<GetUiComponentInput> {
  static readonly TOOL_NAME = 'get-ui-component';

  getDefinition(): ToolDefinition {
    return {
      name: GetUiComponentTool.TOOL_NAME,
      description:
        'Get a image preview of a UI component with app-specific design system configuration. Useful when work on the frontend design to review the UI quickly without running the full app.',
      inputSchema: {
        type: 'object',
        properties: {
          componentName: {
            type: 'string',
            description: 'The name of the component to capture (e.g., "Button", "Card", etc.)',
          },
          appPath: {
            type: 'string',
            description:
              'The app path (relative or absolute) to load design system configuration from (e.g., "apps/agiflow-app"). The design system config is read from {appPath}/project.json',
          },
          storyName: {
            type: 'string',
            description: 'The story name to render (e.g., "Playground", "Default"). Defaults to "Playground".',
          },
          darkMode: {
            type: 'boolean',
            description: 'Whether to render the component in dark mode. Defaults to true.',
          },
          selector: {
            type: 'string',
            description:
              'CSS selector to target specific element for screenshot. When provided, screenshot will auto-resize to element dimensions. Defaults to "#root".',
          },
        },
        required: ['componentName', 'appPath'],
        additionalProperties: false,
      },
    };
  }

  async execute(input: GetUiComponentInput): Promise<CallToolResult> {
    try {
      const { componentName, appPath, storyName = 'Playground', darkMode = true, selector: _selector } = input;

      log.info(
        `[GetUiComponentTool] Starting for component: ${componentName}, appPath: ${appPath}, storyName: ${storyName}`,
      );

      // Initialize stories index
      const storiesIndex = new StoriesIndexService();
      await storiesIndex.initialize();

      // Find the component
      const componentInfo = storiesIndex.findComponentByName(componentName);

      if (!componentInfo) {
        throw new Error(`Component "${componentName}" not found`);
      }

      log.info(`[GetUiComponentTool] Found component: ${componentInfo.title}`);

      // Validate story exists
      let validStoryName = storyName;
      if (!componentInfo.stories.includes(storyName)) {
        log.warn(
          `[GetUiComponentTool] Story "${storyName}" not found, available stories: ${componentInfo.stories.join(', ')}`,
        );
        // Fallback to first available story
        validStoryName = componentInfo.stories[0] || 'Default';
        log.info(`[GetUiComponentTool] Using fallback story: ${validStoryName}`);
      }

      // Get app-specific design system configuration from app path
      const designSystemConfig = await getAppDesignSystemConfig(appPath);
      log.info(`[GetUiComponentTool] Using theme provider: ${designSystemConfig.themeProvider}`);
      log.info(`[GetUiComponentTool] Design system type: ${designSystemConfig.type}`);

      // Render the component with app-specific config
      const renderer = new ComponentRendererService(designSystemConfig, appPath);

      const renderResult = await renderer.renderComponent(componentInfo, {
        storyName: validStoryName,
        width: 1280,
        height: 800,
        darkMode,
      });

      log.info(`[GetUiComponentTool] Component rendered to: ${renderResult.imagePath}`);

      // Read the story file content
      let storyFileContent = '';
      try {
        storyFileContent = await fs.readFile(componentInfo.filePath, 'utf-8');
        log.info(`[GetUiComponentTool] Story file read successfully (${storyFileContent.length} chars)`);
      } catch (fileError) {
        log.warn(
          `[GetUiComponentTool] Warning: Could not read story file: ${fileError instanceof Error ? fileError.message : String(fileError)}`,
        );
        storyFileContent = `// Could not read file: ${componentInfo.filePath}\n// Error: ${fileError instanceof Error ? fileError.message : String(fileError)}`;
      }

      // Cleanup Vite server
      await renderer.dispose();

      log.info('[GetUiComponentTool] Completed successfully');

      const result = {
        imagePath: renderResult.imagePath,
        format: 'png',
        dimensions: '900px width, 80% quality',
        storyFilePath: componentInfo.filePath,
        storyFileContent,
      };

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
