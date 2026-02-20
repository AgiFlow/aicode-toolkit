/**
 * RulesWriter
 *
 * DESIGN PATTERNS:
 * - Service pattern for business logic encapsulation
 * - Single responsibility principle
 *
 * CODING STANDARDS:
 * - Use async/await for asynchronous operations
 * - Throw descriptive errors for error cases
 * - Keep methods focused and well-named
 * - Document complex logic with comments
 *
 * AVOID:
 * - Mixing concerns (keep focused on single domain)
 * - Direct tool implementation (services should be tool-agnostic)
 */

import { TemplatesManagerService } from '@agiflowai/aicode-utils';
import * as fs from 'node:fs/promises';
import * as yaml from 'js-yaml';
import * as path from 'node:path';
import type { RulesYamlConfig, RuleSection, AddRuleInput } from '../../schemas';
import { rulesYamlConfigSchema } from '../../schemas';
import {
  RULES_FILENAME,
  UTF8_ENCODING,
  GLOBAL_TEMPLATE_REF,
  DEFAULT_RULES_VERSION,
  RULES_ERROR,
  RULES_ERROR_MESSAGE,
  RULES_DESCRIPTION,
  RULES_LABEL,
  YAML_INDENT,
  YAML_NO_LINE_WRAP,
} from '../../constants';
import type { RulesWriterConfig, AddRuleResult } from './types';

/**
 * RulesWriter handles YAML rule file operations for RULES.yaml.
 *
 * @example
 * ```typescript
 * const writer = new RulesWriter();
 * const result = await writer.addRule({
 *   pattern: 'api-handlers',
 *   description: 'API handler standards',
 *   globs: ['src/api/*.ts'],
 *   must_do: [{ rule: 'Use async/await' }],
 * });
 * if (result.success) {
 *   console.log('Added rule to:', result.file);
 * }
 * ```
 */
export class RulesWriter {
  private config: RulesWriterConfig;

  /**
   * Creates a new RulesWriter instance
   * @param config - Service configuration options
   */
  constructor(config: RulesWriterConfig = {}) {
    this.config = config;
  }

  /**
   * Add a new rule to RULES.yaml (template-specific or global)
   * @param input - Validated input for adding a rule
   * @returns Result indicating success or failure with details
   */
  async addRule(input: AddRuleInput): Promise<AddRuleResult> {
    try {
      // Determine if this is global or template-specific
      const isGlobal = input.is_global || !input.template_name;
      const targetLabel = isGlobal ? RULES_LABEL.GLOBAL : input.template_name;

      // Get templates root
      const templatesRoot =
        this.config.templatesRoot || (await TemplatesManagerService.findTemplatesPath());

      if (!templatesRoot) {
        return {
          success: false,
          errorType: RULES_ERROR.TEMPLATES_NOT_FOUND,
          error: RULES_ERROR_MESSAGE.TEMPLATES_NOT_FOUND,
        };
      }

      // Resolve paths based on global or template-specific
      const pathResult = await this.resolveRulesPath(templatesRoot, isGlobal, input.template_name);

      if (!pathResult.success) {
        return pathResult;
      }

      const { rulesPath, templateRef } = pathResult;

      // Load existing rules or create new config
      const rulesConfig = await this.loadOrCreateConfig(rulesPath, templateRef, isGlobal);

      // Check if rule pattern already exists
      const existingRule = rulesConfig.rules.find((r) => r.pattern === input.pattern);

      if (existingRule) {
        return {
          success: false,
          errorType: RULES_ERROR.RULE_EXISTS,
          error: `Rule pattern "${input.pattern}" already exists in ${targetLabel} RULES.yaml`,
          existingRule,
        };
      }

      // Create and add new rule
      const newRule = this.createRuleSection(input);
      rulesConfig.rules.push(newRule);

      // Write back to file
      await this.writeRulesConfig(rulesPath, rulesConfig);

      return {
        success: true,
        message: `Added rule pattern "${input.pattern}" to ${targetLabel} RULES.yaml`,
        file: rulesPath,
        rule: newRule,
      };
    } catch (error) {
      return {
        success: false,
        errorType: RULES_ERROR.WRITE_FAILED,
        error: error instanceof Error ? error.message : RULES_ERROR_MESSAGE.WRITE_FAILED,
        templateName: input.template_name,
        pattern: input.pattern,
      };
    }
  }

  /**
   * Resolve the path to RULES.yaml based on global or template-specific.
   *
   * @example
   * // Global rules path
   * const result = await this.resolveRulesPath('/templates', true);
   * // Returns: { success: true, rulesPath: '/templates/RULES.yaml', templateRef: 'shared' }
   *
   * @example
   * // Template-specific rules path
   * const result = await this.resolveRulesPath('/templates', false, 'nextjs-15');
   * // Returns: { success: true, rulesPath: '/templates/nextjs-15/RULES.yaml', templateRef: 'nextjs-15' }
   */
  private async resolveRulesPath(
    templatesRoot: string,
    isGlobal: boolean,
    templateName?: string,
  ): Promise<
    | { success: true; rulesPath: string; templateRef: string }
    | { success: false; errorType: string; error: string; availableHint?: string }
  > {
    if (isGlobal) {
      return {
        success: true,
        rulesPath: path.join(templatesRoot, RULES_FILENAME),
        templateRef: GLOBAL_TEMPLATE_REF,
      };
    }

    // Runtime check to satisfy TypeScript - templateName should be defined when isGlobal=false
    if (!templateName) {
      return {
        success: false,
        errorType: RULES_ERROR.TEMPLATE_NOT_FOUND,
        error: RULES_ERROR_MESSAGE.TEMPLATE_NAME_REQUIRED,
        availableHint: RULES_ERROR_MESSAGE.AVAILABLE_HINT,
      };
    }

    const templatePath = path.join(templatesRoot, templateName);

    // Check if template exists
    try {
      await fs.access(templatePath);
    } catch {
      return {
        success: false,
        errorType: RULES_ERROR.TEMPLATE_NOT_FOUND,
        error: `Template "${templateName}" not found at ${templatePath}`,
        availableHint: RULES_ERROR_MESSAGE.AVAILABLE_HINT,
      };
    }

    return {
      success: true,
      rulesPath: path.join(templatePath, RULES_FILENAME),
      templateRef: templateName,
    };
  }

  /**
   * Load existing RULES.yaml or create default config.
   *
   * Design decision: silently recover from parse/read errors by creating fresh config.
   * This enables creating new RULES.yaml files for templates that don't have one yet
   * and auto-recovery from corrupted files. Invalid YAML formats are replaced with
   * a valid default config rather than throwing an error.
   *
   * @param rulesPath - Absolute path to the RULES.yaml file
   * @param templateRef - Template reference name for default config
   * @param isGlobal - Whether this is a global rules config
   * @returns Existing config if valid, otherwise a new default config
   */
  private async loadOrCreateConfig(
    rulesPath: string,
    templateRef: string,
    isGlobal: boolean,
  ): Promise<RulesYamlConfig> {
    try {
      const content = await fs.readFile(rulesPath, UTF8_ENCODING);
      const parsed = yaml.load(content);

      // Validate parsed YAML against schema
      const validated = rulesYamlConfigSchema.safeParse(parsed);
      if (validated.success) {
        return validated.data;
      }

      // Invalid format - silently create default config for recovery
      return this.createDefaultConfig(templateRef, isGlobal);
    } catch {
      // File doesn't exist or read error - create new config
      return this.createDefaultConfig(templateRef, isGlobal);
    }
  }

  /**
   * Create a RuleSection from input.
   * Only includes optional fields (globs, inherits, must_do, etc.) when they have values.
   *
   * @param input - Validated input containing rule definition
   * @returns RuleSection with pattern, description, and any optional fields
   *
   * @example
   * // Input with globs and must_do
   * createRuleSection({
   *   pattern: 'api-handlers',
   *   description: 'API standards',
   *   globs: ['src/api/*.ts'],
   *   must_do: [{ rule: 'Use async/await' }]
   * });
   * // Returns: { pattern: 'api-handlers', description: 'API standards', globs: [...], must_do: [...] }
   */
  private createRuleSection(input: AddRuleInput): RuleSection {
    const newRule: RuleSection = {
      pattern: input.pattern,
      description: input.description,
    };

    if (input.globs && input.globs.length > 0) {
      newRule.globs = input.globs;
    }

    if (input.inherits && input.inherits.length > 0) {
      newRule.inherits = input.inherits;
    }

    if (input.must_do && input.must_do.length > 0) {
      newRule.must_do = input.must_do;
    }

    if (input.should_do && input.should_do.length > 0) {
      newRule.should_do = input.should_do;
    }

    if (input.must_not_do && input.must_not_do.length > 0) {
      newRule.must_not_do = input.must_not_do;
    }

    return newRule;
  }

  /**
   * Write rules config to YAML file
   */
  private async writeRulesConfig(rulesPath: string, rulesConfig: RulesYamlConfig): Promise<void> {
    const yamlContent = yaml.dump(rulesConfig, {
      indent: YAML_INDENT,
      lineWidth: YAML_NO_LINE_WRAP,
      noRefs: true,
    });

    await fs.writeFile(rulesPath, yamlContent, UTF8_ENCODING);
  }

  /**
   * Creates default RULES.yaml configuration structure
   */
  private createDefaultConfig(templateRef: string, isGlobal: boolean): RulesYamlConfig {
    return {
      version: DEFAULT_RULES_VERSION,
      template: templateRef,
      description: isGlobal
        ? RULES_DESCRIPTION.GLOBAL
        : `${RULES_DESCRIPTION.TEMPLATE_PREFIX} ${templateRef} template`,
      rules: [],
    };
  }
}
