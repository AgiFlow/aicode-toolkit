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
import type {
  Tool,
  ToolDefinition,
  RulesYamlConfig,
  RuleSection,
  RuleItem,
} from '../types/index.js';
import { TemplatesManagerService } from '@agiflowai/aicode-utils';
import * as fs from 'node:fs/promises';
import * as yaml from 'js-yaml';
import * as path from 'node:path';

interface AddRuleToolInput {
  template_name?: string;
  pattern: string;
  description: string;
  inherits?: string[];
  must_do?: RuleItem[];
  should_do?: RuleItem[];
  must_not_do?: RuleItem[];
  is_global?: boolean;
}

export class AddRuleTool implements Tool<AddRuleToolInput> {
  static readonly TOOL_NAME = 'add_rule';

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

  async execute(input: AddRuleToolInput): Promise<CallToolResult> {
    try {
      // Determine if this is global or template-specific
      const isGlobal = input.is_global || !input.template_name;

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
        rulesPath = path.join(templatesRoot, 'RULES.yaml');
        templateRef = 'shared';
      } else {
        const templatePath = path.join(templatesRoot, input.template_name!);

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
                    error: `Template "${input.template_name}" not found at ${templatePath}`,
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

        rulesPath = path.join(templatePath, 'RULES.yaml');
        templateRef = input.template_name!;
      }

      // Read existing RULES.yaml or create new structure
      let rulesConfig: RulesYamlConfig;

      try {
        const content = await fs.readFile(rulesPath, 'utf-8');
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
      const existingRule = rulesConfig.rules.find((r) => r.pattern === input.pattern);

      if (existingRule) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: `Rule pattern "${input.pattern}" already exists in ${isGlobal ? 'global' : input.template_name} RULES.yaml`,
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
        pattern: input.pattern,
        description: input.description,
      };

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

      rulesConfig.rules.push(newRule);

      // Write back to file
      const yamlContent = yaml.dump(rulesConfig, {
        indent: 2,
        lineWidth: -1, // Disable line wrapping
        noRefs: true,
      });

      await fs.writeFile(rulesPath, yamlContent, 'utf-8');

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: `Added rule pattern "${input.pattern}" to ${isGlobal ? 'global' : input.template_name} RULES.yaml`,
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
                template_name: input.template_name,
                pattern: input.pattern,
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

  private createDefaultConfig(templateRef: string, isGlobal: boolean): RulesYamlConfig {
    return {
      version: '1.0',
      template: templateRef,
      description: isGlobal
        ? 'Shared rules and patterns for all templates'
        : `Rules and patterns for ${templateRef} template`,
      rules: [],
    };
  }
}
