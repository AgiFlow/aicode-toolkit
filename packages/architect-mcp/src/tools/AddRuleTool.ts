/**
 * AddRuleTool
 *
 * DESIGN PATTERNS:
 * - Tool pattern with getDefinition() and execute() methods
 * - YAML manipulation for RULES.yaml updates
 * - JSON Schema validation for inputs
 *
 * CODING STANDARDS:
 * - Implement Tool interface from ../types
 * - Use TOOL_NAME constant with snake_case
 * - Return CallToolResult with content array
 * - Handle errors with isError flag
 * - Validate all inputs thoroughly
 *
 * AVOID:
 * - Complex business logic in execute method
 * - Unhandled promise rejections
 * - Missing input validation
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Tool, ToolDefinition } from '../types';
import type { RulesYamlConfig, RuleSection, AddRuleInput } from '../schemas';
import { addRuleInputSchema } from '../schemas';
import { TemplatesManagerService } from '@agiflowai/aicode-utils';
import * as fs from 'node:fs/promises';
import * as yaml from 'js-yaml';
import * as path from 'node:path';
import {
  RULES_FILENAME,
  UTF8_ENCODING,
  GLOBAL_TEMPLATE_REF,
  DEFAULT_RULES_VERSION,
} from '../constants';

export class AddRuleTool implements Tool<AddRuleInput> {
  static readonly TOOL_NAME = 'add_rule';

  /**
   * Returns the tool definition for MCP registration
   * @returns ToolDefinition with name, description, and input schema
   */
  getDefinition(): ToolDefinition {
    return {
      name: AddRuleTool.TOOL_NAME,
      description:
        "Add a new design pattern rule to a template's RULES.yaml or global RULES.yaml. Rules define specific coding standards, must-do/must-not-do items, and code examples.",
      inputSchema: {
        type: 'object',
        properties: {
          template_name: {
            type: 'string',
            description:
              'Name of the template (e.g., "nextjs-15", "typescript-mcp-package"). Omit for global rules.',
          },
          pattern: {
            type: 'string',
            description: 'Pattern identifier (e.g., "src/index.ts", "export-standards")',
          },
          globs: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Array of glob patterns for matching files (e.g., ["src/actions/**/*.ts"]). Takes precedence over pattern for file matching.',
          },
          description: {
            type: 'string',
            description: 'Description of the rule pattern',
          },
          inherits: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Optional array of inherited rule patterns (e.g., ["barrel-exports", "documentation-standards"])',
          },
          must_do: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                rule: { type: 'string' },
                example: { type: 'string' },
                codeExample: { type: 'string' },
              },
              required: ['rule'],
            },
            description: 'Array of must-do rules with optional examples and code examples',
          },
          should_do: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                rule: { type: 'string' },
                example: { type: 'string' },
                codeExample: { type: 'string' },
              },
              required: ['rule'],
            },
            description: 'Array of should-do rules (best practices)',
          },
          must_not_do: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                rule: { type: 'string' },
                example: { type: 'string' },
                codeExample: { type: 'string' },
              },
              required: ['rule'],
            },
            description: 'Array of must-not-do rules (anti-patterns)',
          },
          is_global: {
            type: 'boolean',
            description:
              'If true, adds to global RULES.yaml (templates/RULES.yaml). If false or omitted with template_name, adds to template-specific RULES.yaml',
          },
        },
        required: ['pattern', 'description'],
        additionalProperties: false,
      },
    };
  }

  /**
   * Executes the add rule operation
   * @param input - The input parameters for adding a rule
   * @returns Promise<CallToolResult> with success message or error details
   */
  async execute(input: AddRuleInput): Promise<CallToolResult> {
    // Validate input using Zod schema
    const validationResult = addRuleInputSchema.safeParse(input);
    if (!validationResult.success) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: 'Input validation failed',
                issues: validationResult.error.issues.map((issue) => ({
                  path: issue.path.join('.'),
                  message: issue.message,
                })),
              },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }

    const validatedInput = validationResult.data;

    try {
      // Determine if this is global or template-specific
      const isGlobal = validatedInput.is_global || !validatedInput.template_name;

      // Get templates root
      const templatesRoot = await TemplatesManagerService.findTemplatesPath();
      if (!templatesRoot) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: 'Templates directory not found',
              }),
            },
          ],
          isError: true,
        };
      }

      let rulesPath: string;
      let templateRef: string;

      if (isGlobal) {
        rulesPath = path.join(templatesRoot, RULES_FILENAME);
        templateRef = GLOBAL_TEMPLATE_REF;
      } else {
        const templatePath = path.join(templatesRoot, validatedInput.template_name!);

        // Check if template exists
        try {
          await fs.access(templatePath);
        } catch {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    error: `Template "${validatedInput.template_name}" not found at ${templatePath}`,
                    available_hint: 'Check templates directory for available templates',
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }

        rulesPath = path.join(templatePath, RULES_FILENAME);
        templateRef = validatedInput.template_name!;
      }

      // Read existing RULES.yaml or create new structure
      let rulesConfig: RulesYamlConfig;

      try {
        const content = await fs.readFile(rulesPath, UTF8_ENCODING);
        const parsed = yaml.load(content) as RulesYamlConfig;
        rulesConfig = parsed || this.createDefaultConfig(templateRef, isGlobal);

        // Ensure rules array exists
        if (!rulesConfig.rules) {
          rulesConfig.rules = [];
        }
      } catch {
        // File doesn't exist, create new one
        rulesConfig = this.createDefaultConfig(templateRef, isGlobal);
      }

      // Check if rule pattern already exists
      const existingRule = rulesConfig.rules.find(
        (r) => r.pattern === validatedInput.pattern,
      );

      if (existingRule) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: `Rule pattern "${validatedInput.pattern}" already exists in ${isGlobal ? 'global' : validatedInput.template_name} RULES.yaml`,
                  existing_rule: existingRule,
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }

      // Create new rule section
      const newRule: RuleSection = {
        pattern: validatedInput.pattern,
        description: validatedInput.description,
      };

      if (validatedInput.globs && validatedInput.globs.length > 0) {
        newRule.globs = validatedInput.globs;
      }

      if (validatedInput.inherits && validatedInput.inherits.length > 0) {
        newRule.inherits = validatedInput.inherits;
      }

      if (validatedInput.must_do && validatedInput.must_do.length > 0) {
        newRule.must_do = validatedInput.must_do;
      }

      if (validatedInput.should_do && validatedInput.should_do.length > 0) {
        newRule.should_do = validatedInput.should_do;
      }

      if (validatedInput.must_not_do && validatedInput.must_not_do.length > 0) {
        newRule.must_not_do = validatedInput.must_not_do;
      }

      rulesConfig.rules.push(newRule);

      // Write back to file
      const yamlContent = yaml.dump(rulesConfig, {
        indent: 2,
        lineWidth: -1, // Disable line wrapping
        noRefs: true,
      });

      await fs.writeFile(rulesPath, yamlContent, UTF8_ENCODING);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: `Added rule pattern "${validatedInput.pattern}" to ${isGlobal ? 'global' : validatedInput.template_name} RULES.yaml`,
                file: rulesPath,
                rule: newRule,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: error instanceof Error ? error.message : 'Unknown error',
                template_name: validatedInput.template_name,
                pattern: validatedInput.pattern,
              },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Creates default RULES.yaml configuration structure
   * @param templateRef - Template reference name
   * @param isGlobal - Whether this is a global rules config
   * @returns Default RulesYamlConfig object
   */
  private createDefaultConfig(templateRef: string, isGlobal: boolean): RulesYamlConfig {
    return {
      version: DEFAULT_RULES_VERSION,
      template: templateRef,
      description: isGlobal
        ? 'Shared rules and patterns for all templates'
        : `Rules and patterns for ${templateRef} template`,
      rules: [],
    };
  }
}
