/**
 * Services Barrel Exports
 *
 * Re-exports all services from their respective folder modules.
 */

// ArchitectParser Service
export { ArchitectParser } from './ArchitectParser';
export type { ArchitectConfig, Feature } from './ArchitectParser';

// CodeReview Service
export { CodeReviewService } from './CodeReview';
export type { CodeReviewResult, RuleSection, RulesYamlConfig } from './CodeReview';

// PatternMatcher Service
export { PatternMatcher } from './PatternMatcher';
export type { DesignPatternMatch, FileDesignPatternResult } from './PatternMatcher';

// RuleFinder Service
export { RuleFinder } from './RuleFinder';
export type { ProjectConfig } from './RuleFinder';

// TemplateFinder Service
export { TemplateFinder } from './TemplateFinder';
export type { TemplateMapping } from './TemplateFinder';
