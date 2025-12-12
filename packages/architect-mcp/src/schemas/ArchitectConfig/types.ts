/**
 * ArchitectConfig Types
 *
 * Inferred types from Zod schemas for full type safety.
 * These types are automatically derived from the schema definitions,
 * ensuring runtime validation and compile-time types stay in sync.
 */

import type { z } from 'zod';
import type {
  featureSchema,
  architectConfigSchema,
  architectConfigMergeSchema,
} from './ArchitectConfig';

/**
 * Feature type inferred from schema
 */
export type Feature = z.infer<typeof featureSchema>;

/**
 * ArchitectConfig type inferred from schema
 */
export type ArchitectConfig = z.infer<typeof architectConfigSchema>;

/**
 * ArchitectConfig for merging (optional features)
 */
export type ArchitectConfigMerge = z.infer<typeof architectConfigMergeSchema>;
