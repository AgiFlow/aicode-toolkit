import type { CallToolResult } from '@modelcontextprotocol/server';
import { ProjectConfigResolver } from '@agiflowai/aicode-utils';
import { ScaffoldGeneratorService } from '../services/ScaffoldGeneratorService';
import type { ToolDefinition } from './types';

/**
 * Tool to generate a new feature scaffold configuration in scaffold.yaml
 */
export class GenerateFeatureScaffoldTool {
  static readonly TOOL_NAME = 'generate-feature-scaffold';

  private scaffoldGeneratorService: ScaffoldGeneratorService;
  private isMonolith: boolean;

  constructor(templatesPath: string, isMonolith: boolean = false) {
    this.scaffoldGeneratorService = new ScaffoldGeneratorService(templatesPath);
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
        description: 'Name of the template folder (kebab-case, e.g., "nextjs-15")',
      };
    }

    // Add common properties
    Object.assign(properties, {
      featureName: {
        type: 'string',
        description: 'Name of the feature (kebab-case, e.g., "scaffold-nextjs-page")',
      },
      description: {
        type: 'string',
        description: `Detailed description of what this feature creates and its key capabilities.

STRUCTURE (2-3 sentences):
- Sentence 1: What type of code it generates (component, page, service, etc.)
- Sentence 2: Key features or capabilities included
- Sentence 3: Primary use cases or when to use it

Example: "Generate a new service class for TypeScript libraries following best practices. Creates a service class with interface, implementation, and unit tests. Perfect for creating reusable service modules with dependency injection patterns."`,
      },
      instruction: {
        type: 'string',
        description: `Optional detailed instructions about the generated files, their purposes, and how to work with them.

STRUCTURE (Concise multi-aspect guide):

1. **Pattern explanation**: Describe the architectural pattern used
2. **File organization**: Where files should be placed
3. **Naming conventions**: How to name things (PascalCase, camelCase, etc.)
4. **Usage guidelines**: How to use the generated code
5. **Testing approach**: How to test the feature

Example: "Services follow a class-based pattern with optional interface separation. The service class implements business logic and can be dependency injected. Place services in src/services/ directory. For services with interfaces, define the interface in src/types/interfaces/ for better separation of concerns. Service names should be PascalCase and end with 'Service' suffix. Write comprehensive unit tests for all public methods."`,
      },
      variables: {
        type: 'array',
        description: 'Array of variable definitions for the feature',
        items: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Variable name (camelCase)',
            },
            description: {
              type: 'string',
              description: 'Variable description',
            },
            type: {
              type: 'string',
              enum: ['string', 'number', 'boolean'],
              description: 'Variable type',
            },
            required: {
              type: 'boolean',
              description: 'Whether this variable is required',
            },
            default: {
              description: 'Optional default value for the variable',
            },
          },
          required: ['name', 'description', 'type', 'required'],
        },
      },
      includes: {
        type: 'array',
        description: `Array of specific file paths to include in the feature (highly recommended to list explicitly).

Supports advanced syntax:
- Basic: "src/app/page/page.tsx" - Always included
- Conditional: "src/app/page/layout.tsx?withLayout=true" - Only included when withLayout variable is true
- Multiple conditions: "file.tsx?withLayout=true&withTests=true" - Use & to combine conditions
- Path mapping: "source.tsx->target/path.tsx" - Map source template file to different target path
- Combined: "source.tsx->{{ pagePath }}/page.tsx?withPage=true" - Combine path mapping with variables and conditions

Examples:
- ["src/components/Button.tsx", "src/components/Button.test.tsx"] - Explicit file list (recommended)
- ["src/app/page/page.tsx", "src/app/page/layout.tsx?withLayout=true"] - Conditional include
- ["template.tsx->src/app/{{ pagePath }}/page.tsx"] - Dynamic path with variables

Best practices:
- List each file explicitly for clarity and control
- Use relative paths from the template root
- Use conditional includes with ?variableName=value for optional files
- Use path mapping with -> when source and target paths differ
- Use {{ variableName }} in target paths for dynamic file placement
- Avoid wildcards unless you have a good reason`,
        items: {
          type: 'string',
        },
      },
      patterns: {
        type: 'array',
        description: `Optional array of glob patterns to match existing files that this feature works with.

Used to help identify where this feature can be applied in a project.

Examples:
- ["src/app/**/page.tsx", "src/app/**/layout.tsx"] - Next.js app router files
- ["src/components/**/*.tsx"] - React component files
- ["src/services/**/*.ts"] - Service files

Best practices:
- Use glob patterns that match the file types this feature works with
- Keep patterns specific enough to be meaningful but broad enough to be useful
- Consider both the feature's output and input files`,
        items: {
          type: 'string',
        },
      },
    });

    // Build required array based on mode
    const required = ['featureName', 'description', 'variables'];
    if (!this.isMonolith) {
      required.unshift('templateName');
    }

    return {
      name: GenerateFeatureScaffoldTool.TOOL_NAME,
      description: `Add a new feature scaffold configuration to a template's scaffold.yaml file.

This tool:
- Creates or updates scaffold.yaml in the specified template directory
- Adds a feature entry with proper schema following the nextjs-15 pattern
- Validates the feature name doesn't already exist
- Creates the template directory if it doesn't exist

Use this to add custom feature scaffolds (pages, components, services, etc.) for frameworks not yet supported or for your specific project needs.`,
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
    featureName: string;
    description: string;
    instruction?: string;
    variables: Array<{
      name: string;
      description: string;
      type: string;
      required: boolean;
      default?: any;
    }>;
    includes?: string[];
    patterns?: string[];
  }): Promise<CallToolResult> {
    try {
      let { templateName } = args;

      // In monolith mode, read templateName from toolkit.yaml if not provided
      if (this.isMonolith && !templateName) {
        try {
          const config = await ProjectConfigResolver.resolveProjectConfig(process.cwd());
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

      const result = await this.scaffoldGeneratorService.generateFeatureScaffold({
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
                templatePath: result.templatePath,
                scaffoldYamlPath: result.scaffoldYamlPath,
                nextSteps: [
                  'Use generate-boilerplate-file tool to create template files for the includes array',
                  'Customize the template files with Liquid variable placeholders ({{ variableName }})',
                  'Create the generator file if it uses custom logic (referenced in the generator field)',
                  `Test with: scaffold-mcp feature create ${args.featureName} --vars '{"appName":"test"}'`,
                ],
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
            text: `Error generating feature scaffold: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
}
