/**
 * ComponentRendererService Types
 *
 * Type definitions for component rendering service.
 */

import type { BaseBundlerService } from '../BundlerService';
import type { ComponentInfo } from '../StoriesIndexService';

/**
 * Factory function type for creating bundler service instances.
 * Allows users to provide custom bundler implementations.
 */
export type BundlerFactory = () => BaseBundlerService;

/**
 * Options for rendering a component
 */
export interface RenderOptions {
  /** The story variant name to render (e.g., 'Primary', 'Secondary') */
  storyName?: string;
  /** Component props/arguments to pass to the story */
  args?: Record<string, unknown>;
  /** Whether to render in dark mode theme */
  darkMode?: boolean;
  /** Viewport width in pixels */
  width?: number;
  /** Viewport height in pixels */
  height?: number;
}

/**
 * Result of component rendering
 */
export interface RenderResult {
  /** Path to the rendered image file */
  imagePath: string;
  /** Generated HTML content */
  html: string;
  /** Component metadata */
  componentInfo: ComponentInfo;
}

/**
 * Configuration for ComponentRendererService
 */
export interface ComponentRendererServiceConfig {
  /** Enable verbose logging */
  verbose?: boolean;
  /** Custom bundler factory for creating bundler service instances */
  bundlerFactory?: BundlerFactory;
}

/**
 * Result type for ComponentRendererService
 */
export interface ComponentRendererServiceResult {
  success: boolean;
  data?: unknown;
  error?: string;
}
