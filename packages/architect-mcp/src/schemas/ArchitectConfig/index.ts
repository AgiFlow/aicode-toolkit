/**
 * ArchitectConfig - Barrel Export
 *
 * Re-exports all public API from this schema module.
 */

export {
  featureSchema,
  architectConfigSchema,
  featureInputSchema,
  architectConfigMergeSchema,
} from './ArchitectConfig';

export type { Feature, ArchitectConfig, ArchitectConfigMerge } from './types';
