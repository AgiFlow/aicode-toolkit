/**
 * Schemas Barrel Export
 *
 * This file exports all Zod schemas for convenient importing.
 * Each schema is organized in its own folder with:
 *   - index.ts (barrel export)
 *   - types.ts (inferred type definitions)
 *   - [SchemaName].ts (Zod schema definition)
 *
 * Add new schema exports here as you create them.
 */

// ArchitectConfig schemas
export {
  featureSchema,
  architectConfigSchema,
  featureInputSchema,
  architectConfigMergeSchema,
} from './ArchitectConfig';

export type { Feature, ArchitectConfig, ArchitectConfigMerge } from './ArchitectConfig';

// RulesConfig schemas
export {
  ruleItemSchema,
  ruleSectionSchema,
  rulesYamlConfigSchema,
  addRuleInputSchema,
} from './RulesConfig';

export type {
  RuleItem,
  RuleSection,
  RulesYamlConfig,
  AddRuleInput,
  RulesYamlConfigParseResult,
} from './RulesConfig';
