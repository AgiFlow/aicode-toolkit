/**
 * AddDesignPatternTool
 *
 * DESIGN PATTERNS:
 * - Tool pattern with getDefinition() and execute() methods
 * - Service delegation for business logic
 * - JSON Schema validation for inputs
 * - YAML manipulation for architect.yaml updates
 *
 * CODING STANDARDS:
 * - Implement Tool interface from ../types
 * - Use TOOL_NAME constant with kebab-case
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
import type { Tool, ToolDefinition, Feature } from '../types/index.js';
import { TemplatesManagerService } from '@agiflowai/aicode-utils';
import * as fs from 'node:fs/promises';
import * as yaml from 'js-yaml';
import * as path from 'node:path';

interface AddDesignPatternToolInput {
  template_name: string;
  pattern_name: string;
  design_pattern: string;
  includes: string[];
  description: string;
}

export class AddDesignPatternTool implements Tool<AddDesignPatternToolInput> {
  static readonly TOOL_NAME = 'add-design-pattern';

  getDefinition(): ToolDefinition {
    return {
      name: AddDesignPatternTool.TOOL_NAME,
      description:
        "Admin tool to add a new design pattern to a template's architect.yaml file. Creates the file if it doesn't exist.",
      inputSchema: {
        type: 'object',
        properties: {
          template_name: {
            type: 'string',
            description: 'Name of the template (e.g., "nextjs-15", "typescript-mcp-package")',
          },
          pattern_name: {
            type: 'string',
            description: 'Name of the design pattern',
          },
          design_pattern: {
            type: 'string',
            description: 'The design pattern description or category',
          },
          includes: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Array of file patterns that match this design pattern (e.g., ["src/components/**/*.tsx"])',
          },
          description: {
            type: 'string',
            description:
              'Detailed markdown description following the format: Pattern Overview, What TO DO (✅), What NOT TO DO (❌), and Examples with code blocks',
          },
        },
        required: ['template_name', 'pattern_name', 'design_pattern', 'includes', 'description'],
        additionalProperties: false,
      },
    };
  }

  async execute(input: AddDesignPatternToolInput): Promise<CallToolResult> {
    try {
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
      const templatePath = path.join(templatesRoot, input.template_name);

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

      const architectPath = path.join(templatePath, 'architect.yaml');

      // Read existing architect.yaml or create new structure
      let architectConfig: { features?: Feature[] } = { features: [] };

      try {
        const content = await fs.readFile(architectPath, 'utf-8');
        const parsed = yaml.load(content) as any;
        architectConfig = parsed || { features: [] };

        // Ensure features array exists
        if (!architectConfig.features) {
          architectConfig.features = [];
        }
      } catch {
        // File doesn't exist, will create new one
        architectConfig = { features: [] };
      }

      // Check if pattern already exists
      const existingPattern = architectConfig.features?.find(
        (f) => f.name === input.pattern_name || f.architecture === input.pattern_name,
      );

      if (existingPattern) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: `Pattern "${input.pattern_name}" already exists in ${input.template_name}`,
                  existing_pattern: existingPattern,
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }

      // Add new pattern
      const newFeature: Feature = {
        name: input.pattern_name,
        design_pattern: input.design_pattern,
        includes: input.includes,
        description: input.description,
      };

      architectConfig.features?.push(newFeature);

      // Write back to file
      const yamlContent = yaml.dump(architectConfig, {
        indent: 2,
        lineWidth: -1, // Disable line wrapping
        noRefs: true,
      });

      await fs.writeFile(architectPath, yamlContent, 'utf-8');

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: `Added design pattern "${input.pattern_name}" to ${input.template_name}`,
                file: architectPath,
                pattern: newFeature,
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
