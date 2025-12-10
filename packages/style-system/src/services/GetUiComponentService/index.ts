/**
 * GetUiComponentService - Barrel Export
 *
 * Re-exports all public API from this service module.
 */

// Service implementation and factory types
export { GetUiComponentService } from './GetUiComponentService';
export type { RendererFactory, StoriesIndexFactory } from './GetUiComponentService';

// Type definitions
export type {
  GetUiComponentInput,
  GetUiComponentResult,
  GetUiComponentServiceConfig,
} from './types';

// Configuration defaults
export { DEFAULT_GET_UI_COMPONENT_CONFIG } from './types';
