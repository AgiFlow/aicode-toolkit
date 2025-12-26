/**
 * RulesConfig Schema
 *
 * DESIGN PATTERNS:
 * - Zod schema for runtime validation with TypeScript inference
 * - Single source of truth for data structure and types
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
 * RuleItem schema - defines a single rule with optional examples
 */
export const ruleItemSchema = z.object({
  /** Rule text describing what to do or avoid */
  rule: z.string().min(1, 'Rule text is required'),
  /** Plain text example */
  example: z.string().optional(),
  /** Code example showing the rule in practice */
  codeExample: z.string().optional(),
});

/**
 * RuleSection schema - defines a section of rules for a specific pattern
 */
export const ruleSectionSchema = z.object({
  /** Pattern identifier - used for inheritance lookups and fallback file matching */
  pattern: z.string().min(1, 'Pattern is required'),

  /** Array of glob patterns for file matching. Takes precedence over pattern when provided */
  globs: z.array(z.string()).optional(),

  /** Description of this rule section */
  description: z.string().min(1, 'Description is required'),

  /** Patterns to inherit rules from */
  inherits: z.array(z.string()).optional(),

  /** Required rules that must be followed */
  must_do: z.array(ruleItemSchema).optional(),

  /** Recommended rules (best practices) */
  should_do: z.array(ruleItemSchema).optional(),

  /** Anti-patterns that must be avoided */
  must_not_do: z.array(ruleItemSchema).optional(),
});

/**
 * RulesYamlConfig schema - root configuration for RULES.yaml
 */
export const rulesYamlConfigSchema = z.object({
  /** Schema version */
  version: z.string().default('1.0'),
  /** Template name this rules config belongs to */
  template: z.string().min(1, 'Template name is required'),
  /** Description of this rules configuration */
  description: z.string().min(1, 'Description is required'),
  /** Reference to source template */
  source_template_ref: z.string().optional(),
  /** Array of rule sections */
  rules: z.array(ruleSectionSchema).default([]),
  /** External documentation references */
  documentation_refs: z.array(z.string()).optional(),
  /** Integration notes */
  integration_notes: z.array(z.string()).optional(),
});

/**
 * AddRuleInput schema - input validation for add_rule tool
 */
export const addRuleInputSchema = z.object({
  /** Template name (omit for global rules) */
  template_name: z.string().optional(),
  /** Pattern identifier */
  pattern: z.string().min(1, 'Pattern is required'),
  /** Array of glob patterns for file matching */
  globs: z.array(z.string()).optional(),
  /** Description of the rule */
  description: z.string().min(1, 'Description is required'),
  /** Patterns to inherit from */
  inherits: z.array(z.string()).optional(),
  /** Must-do rules */
  must_do: z.array(ruleItemSchema).optional(),
  /** Should-do rules */
  should_do: z.array(ruleItemSchema).optional(),
  /** Must-not-do rules */
  must_not_do: z.array(ruleItemSchema).optional(),
  /** Whether to add to global RULES.yaml */
  is_global: z.boolean().optional(),
});
