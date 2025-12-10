/**
 * Services Barrel Export
 *
 * This file exports all services for convenient importing.
 * Add new service exports here as you create them.
 */

// AppComponentsService
export { AppComponentsService, DEFAULT_APP_COMPONENTS_CONFIG } from './AppComponentsService';
export type {
  AppComponentsServiceConfig,
  AppComponentsServiceResult,
  ListAppComponentsInput,
  PaginationInfo,
  PaginationState,
} from './AppComponentsService';

// BundlerService
export {
  BaseBundlerService,
  bundlerRegistry,
  createDefaultBundlerService,
  DEFAULT_BUNDLER_CONFIG,
  getBundlerService,
  getBundlerServiceFromConfig,
  registerBundlerService,
  resetBundlerServiceCache,
  ViteReactBundlerService,
} from './BundlerService';
export type {
  BuildOptions,
  BundlerServiceConfig,
  BundlerServiceFactory,
  DevServerResult,
  PrerenderResult,
  RenderOptions as BundlerRenderOptions,
  ServeComponentResult,
} from './BundlerService';

// ComponentRendererService
export { ComponentRendererService } from './ComponentRendererService';
export type {
  BundlerFactory,
  ComponentRendererServiceConfig,
  ComponentRendererServiceResult,
  RenderOptions,
  RenderResult,
} from './ComponentRendererService';

// StoriesIndexService
export { StoriesIndexService } from './StoriesIndexService';
export type { ComponentInfo, StoriesIndexServiceConfig, StoriesIndexServiceResult, StoryMeta } from './StoriesIndexService';

// ThemeService
export { ThemeService } from './ThemeService';
export type { AvailableThemesResult, ThemeInfo, ThemeServiceConfig, ThemeServiceResult } from './ThemeService';

// CSS Classes services
export {
  BaseCSSClassesService,
  CSSClassesServiceFactory,
  DEFAULT_STYLE_SYSTEM_CONFIG,
  TailwindCSSClassesService,
} from './CssClasses';
export type { CSSClassCategory, CSSClassesResult, CSSClassValue, StyleSystemConfig } from './CssClasses';

// GetUiComponentService
export { DEFAULT_GET_UI_COMPONENT_CONFIG, GetUiComponentService } from './GetUiComponentService';
export type {
  GetUiComponentInput,
  GetUiComponentResult,
  GetUiComponentServiceConfig,
  RendererFactory,
  StoriesIndexFactory,
} from './GetUiComponentService';
