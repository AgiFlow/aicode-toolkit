/**
 * GetComponentVisualTool
 *
 * DESIGN PATTERNS:
 * - Tool pattern with getDefinition() and execute() methods
 * - Service delegation for business logic
 * - JSON Schema validation for inputs
 *
 * CODING STANDARDS:
 * - Implement Tool interface from ../types
 * - Use TOOL_NAME constant with snake_case (e.g., 'get_component_visual')
 * - Return CallToolResult with content array
 * - Handle errors with isError flag
 * - Delegate complex logic to services
 *
 * AVOID:
 * - Complex business logic in execute method
 * - Unhandled promise rejections
 * - Missing input validation
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { GetUiComponentService } from '../services';
import type { GetUiComponentInput, GetUiComponentResult } from '../services';
import type { Tool, ToolDefinition } from '../types';

/**
 * Template for visual review instructions returned with component screenshots.
 * Guides the LLM to verify visual correctness of the rendered component.
 * @param imagePath - Path to the component screenshot image
 * @returns Formatted markdown string with visual review instructions
 */
const REVIEW_INSTRUCTIONS_TEMPLATE = (imagePath: string): string => `
## Visual Review Instructions

Please review the component screenshot and story code to verify visual correctness:

1. **Read the screenshot** at: ${imagePath}
2. **Compare with the story code** to ensure the rendered output matches expectations
3. **Check for visual issues**:
   - Are all variants rendering correctly?
   - Are colors, spacing, and typography as expected?
   - Are interactive states (hover, disabled, loading) properly styled?
   - Is the layout and alignment correct?

If you notice any visual discrepancies between the code and the rendered output, please report them.
`;

export class GetComponentVisualTool implements Tool<GetUiComponentInput> {
  static readonly TOOL_NAME = 'get_component_visual';

  private service: GetUiComponentService;

  /**
   * Creates a new GetComponentVisualTool instance.
   * @param service - Optional service instance for dependency injection (useful for testing)
   */
  constructor(service?: GetUiComponentService) {
    this.service = service ?? new GetUiComponentService();
  }

  /**
   * Returns the tool definition including name, description, and input schema.
   * @returns Tool definition with JSON Schema for input validation
   */
  getDefinition(): ToolDefinition {
    return {
      name: GetComponentVisualTool.TOOL_NAME,
      description:
        'Get a image preview of a UI component with app-specific design system configuration. Useful when work on the frontend design to review the UI quickly without running the full app.',
      inputSchema: {
        type: 'object',
        properties: {
          componentName: {
            type: 'string',
            minLength: 1,
            description: 'The name of the component to capture (e.g., "Button", "Card", etc.)',
          },
          appPath: {
            type: 'string',
            minLength: 1,
            description:
              'The app path (relative or absolute) to load design system configuration from (e.g., "apps/agiflow-app"). The design system config is read from {appPath}/project.json',
          },
          storyName: {
            type: 'string',
            minLength: 1,
            description: 'The story name to render (e.g., "Playground", "Default"). Defaults to "Playground".',
          },
          darkMode: {
            type: 'boolean',
            description: 'Whether to render the component in dark mode. Defaults to true.',
          },
          selector: {
            type: 'string',
            minLength: 1,
            description:
              'CSS selector to target specific element for screenshot. When provided, screenshot will auto-resize to element dimensions. Defaults to "#root".',
          },
        },
        required: ['componentName', 'appPath'],
        additionalProperties: false,
      },
    };
  }

  /**
   * Executes the tool to get a UI component preview.
   * @param input - The input parameters for getting the component
   * @returns Promise resolving to CallToolResult with component info or error
   */
  async execute(input: GetUiComponentInput): Promise<CallToolResult> {
    try {
      const result: GetUiComponentResult = await this.service.getComponent(input);
      const reviewInstructions = REVIEW_INSTRUCTIONS_TEMPLATE(result.imagePath);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
          {
            type: 'text',
            text: reviewInstructions,
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
