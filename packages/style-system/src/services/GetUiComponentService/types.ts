/**
 * GetUiComponentService Types
 *
 * Type definitions for the GetUiComponentService service.
 */

/**
 * Configuration options for GetUiComponentService.
 *
 * All options are optional. When not provided, values from
 * DEFAULT_GET_UI_COMPONENT_CONFIG are used as fallbacks.
 */
export interface GetUiComponentServiceConfig {
  /** Default story name to render if not specified @default 'Playground' */
  defaultStoryName?: string;
  /** Default dark mode setting @default true */
  defaultDarkMode?: boolean;
  /** Default viewport width @default 1280 */
  defaultWidth?: number;
  /** Default viewport height @default 800 */
  defaultHeight?: number;
}

/**
 * Default configuration values.
 */
export const DEFAULT_GET_UI_COMPONENT_CONFIG: Required<GetUiComponentServiceConfig> = {
  defaultStoryName: 'Playground',
  defaultDarkMode: true,
  defaultWidth: 1280,
  defaultHeight: 800,
};

/**
 * Input parameters for getting a UI component preview.
 *
 * @example
 * ```typescript
 * const input: GetUiComponentInput = {
 *   componentName: 'Button',
 *   appPath: './apps/my-app',
 *   storyName: 'Primary',
 *   darkMode: true,
 * };
 * ```
 */
export interface GetUiComponentInput {
  /** The name of the component to capture (e.g., "Button", "Card") */
  componentName: string;
  /** App path (relative or absolute) to load design system configuration from */
  appPath: string;
  /** The story name to render (e.g., "Playground", "Default") */
  storyName?: string;
  /** Whether to render the component in dark mode */
  darkMode?: boolean;
  /** CSS selector to target specific element for screenshot */
  selector?: string;
}

/**
 * Result returned by GetUiComponentService.getComponent().
 */
export interface GetUiComponentResult {
  /** Path to the rendered image file */
  imagePath: string;
  /** Image format */
  format: string;
  /** Dimension info */
  dimensions: string;
  /** Path to the story file */
  storyFilePath: string;
  /** Content of the story file */
  storyFileContent: string;
  /** Component title from stories index */
  componentTitle: string;
  /** Available stories for this component */
  availableStories: string[];
  /** The story that was actually rendered */
  renderedStory: string;
}
