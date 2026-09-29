import path from 'node:path';
import type { CallToolResult } from '@modelcontextprotocol/server';
import { ProjectConfigResolver } from '@agiflowai/aicode-utils';
import { BoilerplateGeneratorService } from '../services/BoilerplateGeneratorService';
import type { ToolDefinition } from './types';

/**
 * Tool to generate template files for boilerplates and features
 */
export class GenerateBoilerplateFileTool {
  static readonly TOOL_NAME = 'generate-boilerplate-file';

  private boilerplateGeneratorService: BoilerplateGeneratorService;
  private isMonolith: boolean;

  private readonly workspaceRoot: string;

  constructor(templatesPath: string, isMonolith: boolean = false, workspaceRoot = process.cwd()) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    this.boilerplateGeneratorService = new BoilerplateGeneratorService(templatesPath);
    this.isMonolith = isMonolith;
  }

  /**
   * Get the tool definition for MCP
   */
  getDefinition(): ToolDefinition {
    // Build properties object
    const properties: Record<string, any> = {};

    // In monolith mode, templateName is optional (read from toolkit.yaml)
    // In monorepo mode, templateName is required
    if (!this.isMonolith) {
      properties.templateName = {
        type: 'string',
        description: 'Name of the template folder (must already exist)',
      };
    }

    // Add common properties
    Object.assign(properties, {
      filePath: {
        type: 'string',
        description:
          'Path of the file to create within the template (e.g., "package.json", "src/app/page.tsx")',
      },
      content: {
        type: 'string',
        description: `Content of the template file using Liquid template syntax.

LIQUID SYNTAX:
- Variables: {{ variableName }} - Replaced with actual values
- Conditionals: {% if condition %}...{% endif %} - Conditional rendering
- Else: {% if condition %}...{% else %}...{% endif %}
- Elsif: {% if condition %}...{% elsif other %}...{% endif %}
- Equality: {% if var == 'value' %}...{% endif %}

AVAILABLE FILTERS:
You can transform variables using these filters with the pipe (|) syntax:

Case Conversion:
- {{ name | camelCase }} - Convert to camelCase (myVariableName)
- {{ name | pascalCase }} - Convert to PascalCase (MyVariableName)
- {{ name | titleCase }} - Convert to TitleCase (alias for pascalCase)
- {{ name | kebabCase }} - Convert to kebab-case (my-variable-name)
- {{ name | snakeCase }} - Convert to snake_case (my_variable_name)
- {{ name | upperCase }} - Convert to UPPER_CASE (MY_VARIABLE_NAME)
- {{ name | lower }} or {{ name | downcase }} - Convert to lowercase
- {{ name | upper }} or {{ name | upcase }} - Convert to UPPERCASE

String Manipulation:
- {{ name | strip }} - Remove leading/trailing whitespace
- {{ name | replace: "old", "new" }} - Replace text (e.g., replace: "Tool", "")
- {{ name | pluralize }} - Add plural suffix (simple: book → books, class → classes)
- {{ name | singularize }} - Remove plural suffix (simple: books → book)

Chaining Filters:
- {{ toolName | downcase | replace: "tool", "" | strip }} - Combine multiple filters

Example with variables and conditionals:
{
  "name": "{{ packageName }}",{% if withFeature %}
  "feature": "enabled",{% endif %}
  "dependencies": {
    "core": "1.0.0"{% if withOptional %},
    "optional": "2.0.0"{% endif %}
  }
}

Example with filters:
export class {{ serviceName | pascalCase }} {
  private {{ serviceName | camelCase }}: string;

  constructor() {
    this.{{ serviceName | camelCase }} = "{{ serviceName | kebabCase }}";
  }
}

IMPORTANT - Keep content minimal and business-agnostic:
- Focus on structure and patterns, not specific business logic
- Use placeholder data and generic examples
- Include only essential boilerplate code
- Demonstrate the pattern, not a complete implementation
- Let AI fill in business-specific logic later

Example (good - minimal):
export function {{ functionName }}() {
  // TODO: Implement logic
  return null;
}

Example (bad - too specific):
export function calculateTax(income: number) {
  const federalRate = 0.22;
  const stateRate = 0.05;
  return income * (federalRate + stateRate);
}`,
      },
      sourceFile: {
        type: 'string',
        description: 'Optional: Path to a source file to copy and convert to a template',
      },
      header: {
        type: 'string',
        description: `Optional: Header comment to add at the top of the file to provide AI hints about design patterns, coding standards, and best practices.

Example format for TypeScript/JavaScript files:
/**
 * {{ componentName }} Component
 *
 * DESIGN PATTERNS:
 * - Component pattern description
 * - Architecture decisions
 *
 * CODING STANDARDS:
 * - Naming conventions
 * - Required elements
 *
 * AVOID:
 * - Common pitfalls
 * - Anti-patterns
 */

The header helps AI understand and follow established patterns when working with generated code.`,
      },
    });

    // Build required array based on mode
    const required = ['filePath'];
    if (!this.isMonolith) {
      required.unshift('templateName');
    }

    return {
      name: GenerateBoilerplateFileTool.TOOL_NAME,
      description: `Create or update template files for boilerplates or features in the specified template directory.

This tool:
- Creates template files with .liquid extension for variable substitution
- Supports creating nested directory structures
- Can create files from source files (copying and converting to templates)
- Validates that the template directory exists
- Works for both boilerplate includes and feature scaffold includes

IMPORTANT - Always add header comments:
- For code files (*.ts, *.tsx, *.js, *.jsx), ALWAYS include a header parameter with design patterns, coding standards, and things to avoid
- Headers help AI understand and follow established patterns when working with generated code
- Use the header parameter to document the architectural decisions and best practices

Use this after generate-boilerplate or generate-feature-scaffold to create the actual template files referenced in the includes array.`,
      inputSchema: {
        type: 'object',
        properties,
        required,
        additionalProperties: false,
      },
    };
  }

  /**
   * Execute the tool
   */
  async execute(args: {
    templateName?: string;
    filePath: string;
    content?: string;
    sourceFile?: string;
    header?: string;
  }): Promise<CallToolResult> {
    try {
      let { templateName } = args;

      // In monolith mode, read templateName from toolkit.yaml if not provided
      if (this.isMonolith && !templateName) {
        try {
          const config = await ProjectConfigResolver.resolveProjectConfig(this.workspaceRoot);
          templateName = config.sourceTemplate;
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Failed to read template name from configuration: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          };
        }
      }

      // Validate required parameter
      if (!templateName) {
        return {
          content: [
            {
              type: 'text',
              text: 'Missing required parameter: templateName',
            },
          ],
          isError: true,
        };
      }

      const result = await this.boilerplateGeneratorService.createTemplateFile({
        ...args,
        templateName,
      });

      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: result.message,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: result.message,
                filePath: result.filePath,
                fullPath: result.fullPath,
                sourceFile: args.sourceFile || null,
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
            text: `Error creating template file: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
}
