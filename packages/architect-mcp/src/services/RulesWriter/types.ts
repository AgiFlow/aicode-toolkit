/**
 * RulesWriter Types
 *
 * Type definitions for the RulesWriter service.
 */

import type { RuleSection, AddRuleInput } from '../../schemas';
import type { RULES_ERROR } from '../../constants';

/**
 * Configuration options for RulesWriter
 */
export interface RulesWriterConfig {
  /**
   * Custom templates root path (defaults to auto-discovered)
   */
  templatesRoot?: string;
}

/**
 * Result from adding a rule successfully
 */
export interface AddRuleSuccess {
  success: true;
  message: string;
  file: string;
  rule: RuleSection;
}

/**
 * Error types for rule operations
 *
 * @example
 * // Check error type
 * if (result.errorType === RULES_ERROR.RULE_EXISTS) {
 *   console.log('Rule already exists:', result.existingRule);
 * }
 */
export type AddRuleErrorType = (typeof RULES_ERROR)[keyof typeof RULES_ERROR];

/**
 * Error result from adding a rule
 *
 * @example
 * // Handle error result
 * const result = await rulesWriter.addRule(input);
 * if (!result.success) {
 *   console.error(result.error, result.errorType);
 * }
 */
export interface AddRuleError {
  success: false;
  errorType: AddRuleErrorType;
  error: string;
  templateName?: string;
  pattern?: string;
  existingRule?: RuleSection;
  availableHint?: string;
}

/**
 * Union type for add rule result
 *
 * @example
 * // Type-safe result handling
 * const result: AddRuleResult = await rulesWriter.addRule(input);
 * if (result.success) {
 *   console.log('Added rule:', result.rule.pattern);
 * } else {
 *   console.error('Failed:', result.error);
 * }
 */
export type AddRuleResult = AddRuleSuccess | AddRuleError;

/**
 * Re-export AddRuleInput for convenience
 */
export type { AddRuleInput };
