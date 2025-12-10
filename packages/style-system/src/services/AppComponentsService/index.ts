/**
 * AppComponentsService - Barrel Export
 *
 * Re-exports all public API from this service module.
 */

// Service implementation
export { AppComponentsService } from './AppComponentsService';

// Type definitions
export type {
  AppComponentsServiceConfig,
  AppComponentsServiceResult,
  ComponentBrief,
  ListAppComponentsInput,
  PaginationInfo,
  PaginationState,
} from './types';

// Configuration defaults
export { DEFAULT_APP_COMPONENTS_CONFIG } from './types';
