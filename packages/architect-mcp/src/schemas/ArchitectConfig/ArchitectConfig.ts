/**
 * ArchitectConfig Schema
 *
 * DESIGN PATTERNS:
 * - Zod schema for runtime validation with TypeScript inference
 * - Single source of truth for architect.yaml structure
 * - Composable schema design for extensibility
 *
 * CODING STANDARDS:
 * - Use z.object() for structured data
 * - Use .optional() and .default() for flexible fields
 * - Export schema constant with camelCase + 'Schema' suffix
 * - Keep schemas focused on single domain
 *
 * AVOID:
 * - Duplicating type definitions (use z.infer instead)
 * - Complex transforms that hide validation logic
 * - Circular schema references
 */

import { z } from 'zod';

/**
 * Feature schema - defines a design pattern feature in architect.yaml
 */
export const featureSchema = z.object({
  // Human-readable name for the feature/pattern
  name: z.string().optional(),

  // Architecture type (legacy, prefer 'name')
  architecture: z.string().optional(),

  // Design pattern description
  design_pattern: z.string().min(1, 'design_pattern is required'),

  // Glob patterns for files that should follow this pattern
  includes: z.array(z.string()).min(1, 'At least one include pattern is required'),

  // Detailed description of the pattern and its guidelines
  description: z.string().optional(),
});

/**
 * ArchitectConfig schema - root configuration for architect.yaml
 */
export const architectConfigSchema = z.object({
  // List of design pattern features
  features: z.array(featureSchema).optional().default([]),
});

/**
 * Schema for validating a single feature entry
 */
export const featureInputSchema = featureSchema;

/**
 * Schema for merging multiple configs (allows empty features)
 */
export const architectConfigMergeSchema = architectConfigSchema.extend({
  features: z.array(featureSchema).optional(),
});
