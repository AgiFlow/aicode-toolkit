import type { CallToolResult } from '@modelcontextprotocol/server';
import { ProjectConfigResolver } from '@agiflowai/aicode-utils';
import { BoilerplateGeneratorService } from '../services/BoilerplateGeneratorService';
import type { ToolDefinition } from './types';

/**
 * Tool to generate a new boilerplate configuration in scaffold.yaml
 */
export class GenerateBoilerplateTool {
  static readonly TOOL_NAME = 'generate-boilerplate';

  private boilerplateGeneratorService: BoilerplateGeneratorService;
  private isMonolith: boolean;

  constructor(templatesPath: string, isMonolith: boolean = false) {
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
        description: 'Name of the template folder (kebab-case, e.g., "my-framework")',
      };
    }

    // Add common properties
    Object.assign(properties, {
      boilerplateName: {
        type: 'string',
        description: 'Name of the boilerplate (kebab-case, e.g., "scaffold-my-app")',
      },
      targetFolder: {
        type: 'string',
        description: 'Target folder where projects will be created (e.g., "apps", "packages")',
      },
      description: {
        type: 'string',
        description: `Detailed description of what this boilerplate creates and its key features.

STRUCTURE (3-5 sentences in multiple paragraphs):
- Paragraph 1: Core technology stack and primary value proposition
- Paragraph 2: Target use cases and ideal project types
- Paragraph 3: Key integrations or special features (if applicable)

Example: "A modern React SPA template powered by Vite for lightning-fast HMR, featuring TanStack Router for type-safe routing and TanStack Query for server state management.
Perfect for building data-driven dashboards, admin panels, and interactive web applications requiring client-side routing and real-time data synchronization.

Includes Agiflow Config Management System integration with systematic environment variable naming (VITE_{CATEGORY}_{SUBCATEGORY}_{PROPERTY}) and auto-generated configuration templates for cloud deployment."`,
      },
      instruction: {
        type: 'string',
        description: `Optional detailed instructions about the generated files, their purposes, and how to work with them.

STRUCTURE (Multi-section guide):

1. **File purposes** section:
   List each major file/directory with its purpose
   Format: "- path/to/file: Description of what this file does"

2. **How to use the scaffolded code** section:
   Step-by-step workflows for common tasks
   Format: Numbered list with specific examples
   - How to add routes/pages
   - How to fetch data
   - How to handle authentication
   - How to configure environment variables

3. **Design patterns to follow** section:
   Key architectural decisions and conventions
   Format: "- Pattern Name: Explanation and when to use it"
   - Routing patterns
   - State management patterns
   - Data fetching patterns
   - Error handling patterns
   - Performance optimization patterns

Example: "[Framework] application template with [key technologies].

File purposes:
- package.json: NPM package configuration with [framework] and dependencies
- src/main.tsx: Application entry point with [setup details]
- src/routes/: Route definitions following [pattern]
[... list all major files ...]

How to use the scaffolded code:
1. Routes: Create new routes by [specific instructions with example]
2. Data Fetching: Use [specific pattern] for [use case]
3. Authentication: Use [specific components/modules] for user management
[... numbered steps for common tasks ...]

Design patterns to follow:
- File-based Routing: Use directory structure in src/routes/ to define URL paths
- Type-safe Routes: Leverage [framework] type inference for params
- State Management: Use [library] for server state, [library] for client state
[... list key patterns with explanations ...]"`,
      },
      variables: {
        type: 'array',
        description: 'Array of variable definitions for the boilerplate',
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
        description: `Array of specific file paths to include in the boilerplate (highly recommended to list explicitly).

Examples:
- ["package.json", "tsconfig.json", "src/index.ts"] - Explicit file list (recommended)
- ["**/*"] - Include all files (not recommended, too broad)

Best practices:
- List each file explicitly for clarity and control
- Use relative paths from the template root
- Include configuration files (package.json, tsconfig.json, etc.)
- Include source files (src/index.ts, src/app/page.tsx, etc.)
- Avoid wildcards unless you have a good reason

See templates/nextjs-15/scaffold.yaml for a good example of explicit file listing.`,
        items: {
          type: 'string',
        },
      },
    });

    // Build required array based on mode
    const required = ['boilerplateName', 'description', 'variables'];
    if (!this.isMonolith) {
      required.unshift('templateName');
      required.push('targetFolder');
    }

    return {
      name: GenerateBoilerplateTool.TOOL_NAME,
      description: `Add a new boilerplate configuration to a template's scaffold.yaml file.

This tool:
- Creates or updates scaffold.yaml in the specified template directory
- Adds a boilerplate entry with proper schema following the nextjs-15 pattern
- Validates the boilerplate name doesn't already exist
- Creates the template directory if it doesn't exist

Use this to add custom boilerplate configurations for frameworks not yet supported or for your specific project needs.`,
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
    boilerplateName: string;
    description: string;
    instruction?: string;
    targetFolder?: string;
    variables: Array<{
      name: string;
      description: string;
      type: string;
      required: boolean;
      default?: any;
    }>;
    includes?: string[];
  }): Promise<CallToolResult> {
    try {
      let { templateName, targetFolder } = args;

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

      // In monolith mode, default targetFolder to "." if not provided
      if (this.isMonolith && !targetFolder) {
        targetFolder = '.';
      }

      // Validate required parameters
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

      if (!targetFolder) {
        return {
          content: [
            {
              type: 'text',
              text: 'Missing required parameter: targetFolder',
            },
          ],
          isError: true,
        };
      }

      const result = await this.boilerplateGeneratorService.generateBoilerplate({
        ...args,
        templateName,
        targetFolder,
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
                  `Test with: scaffold-mcp boilerplate create ${args.boilerplateName} --vars '{"appName":"test"}'`,
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
            text: `Error generating boilerplate: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
}
