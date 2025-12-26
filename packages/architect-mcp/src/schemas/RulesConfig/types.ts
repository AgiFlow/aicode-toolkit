/**
 * RulesConfig Types
 *
 * Inferred types from Zod schemas for full type safety.
 * These types are automatically derived from the schema definitions,
 * ensuring runtime validation and compile-time types stay in sync.
 */

import type { z } from 'zod';
import type {
  ruleItemSchema,
  ruleSectionSchema,
  rulesYamlConfigSchema,
  addRuleInputSchema,
} from './RulesConfig';

/**
 * RuleItem type - a single rule with optional examples
 */
export type RuleItem = z.infer<typeof ruleItemSchema>;

/**
 * RuleSection type - a section of rules for a specific pattern
 */
export type RuleSection = z.infer<typeof ruleSectionSchema>;

/**
 * RulesYamlConfig type - root configuration for RULES.yaml
 */
export type RulesYamlConfig = z.infer<typeof rulesYamlConfigSchema>;

/**
 * AddRuleInput type - input for add_rule tool
 */
export type AddRuleInput = z.infer<typeof addRuleInputSchema>;

/**
 * Validation result type for safe parsing
 */
export type RulesYamlConfigParseResult = z.SafeParseReturnType<unknown, RulesYamlConfig>;
