/**
 * AddRuleTool
 *
 * DESIGN PATTERNS:
 * - Tool pattern with getDefinition() and execute() methods
 * - Thin orchestration layer delegating to RulesWriter service
 * - Zod schema validation for inputs
 *
 * CODING STANDARDS:
 * - Implement Tool interface from ../types
 * - Use TOOL_NAME constant with snake_case
 * - Return CallToolResult with content array
 * - Handle errors with isError flag
 * - Delegate business logic to services
 *
 * AVOID:
 * - Complex business logic in execute method
 * - Unhandled promise rejections
 * - Missing input validation
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Tool, ToolDefinition } from '../types';
import type { AddRuleInput } from '../schemas';
import { addRuleInputSchema } from '../schemas';
import { RulesWriter } from '../services';
import { RULES_ERROR_MESSAGE } from '../constants';

export class AddRuleTool implements Tool<AddRuleInput> {
  static readonly TOOL_NAME = 'add_rule';

  private rulesWriter: RulesWriter;

  constructor() {
    this.rulesWriter = new RulesWriter();
  }

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
            minLength: 1,
            description: 'Pattern identifier (e.g., "src/index.ts", "export-standards")',
          },
          globs: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Array of glob patterns for matching files. Supports negated patterns with "!" prefix (e.g., ["src/**/*.ts", "!src/**/*.test.ts"]). Takes precedence over pattern for file matching.',
          },
          description: {
            type: 'string',
            minLength: 1,
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
    // Step 1: Validate input using Zod schema
    const validationResult = addRuleInputSchema.safeParse(input);
    if (!validationResult.success) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: RULES_ERROR_MESSAGE.INPUT_VALIDATION_FAILED,
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

    // Step 2: Delegate to RulesWriter service
    try {
      const result = await this.rulesWriter.addRule(validationResult.data);

      // Step 3: Format response
      if (result.success) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: result.message,
                  file: result.file,
                  rule: result.rule,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      // Error response from service
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: result.error,
                errorType: result.errorType,
                ...(result.existingRule && { existing_rule: result.existingRule }),
                ...(result.availableHint && { available_hint: result.availableHint }),
              },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    } catch (error) {
      // Handle unexpected errors from service
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: error instanceof Error ? error.message : String(error),
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
}
