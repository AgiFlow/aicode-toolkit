import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { ProjectConfigResolver } from '@agiflowai/aicode-utils';
import listScaffoldingMethodsDescription from '../instructions/tools/list-scaffolding-methods/description.md?raw';
import { FileSystemService } from '../services/FileSystemService';
import { ScaffoldingMethodsService } from '../services/ScaffoldingMethodsService';
import { TemplateService } from '../services/TemplateService';
import type { ToolDefinition } from './types';

export class ListScaffoldingMethodsTool {
  static readonly TOOL_NAME = 'list-scaffolding-methods';

  private fileSystemService: FileSystemService;
  private scaffoldingMethodsService: ScaffoldingMethodsService;
  private templateService: TemplateService;
  private isMonolith: boolean;

  constructor(templatesPath: string, isMonolith: boolean = false) {
    this.fileSystemService = new FileSystemService();
    this.scaffoldingMethodsService = new ScaffoldingMethodsService(
      this.fileSystemService,
      templatesPath,
    );
    this.templateService = new TemplateService();
    this.isMonolith = isMonolith;
  }

  /**
   * Get the tool definition for MCP
   */
  getDefinition(): ToolDefinition {
    const description = this.templateService.renderString(listScaffoldingMethodsDescription, {
      isMonolith: this.isMonolith,
    });

    // Build properties based on mode
    const properties: Record<string, any> = {
      cursor: {
        type: 'string',
        description:
          'Optional pagination cursor to fetch the next page of results. Omit to fetch the first page.',
      },
    };

    // Only add parameters in monorepo mode
    // In monolith mode, automatically use current directory and read template from toolkit.yaml
    if (!this.isMonolith) {
      properties.projectPath = {
        type: 'string',
        description:
          'Absolute path to the project directory (for monorepo: containing project.json; for monolith: workspace root with toolkit.yaml). Either projectPath or templateName is required.',
      };
      properties.templateName = {
        type: 'string',
        description:
          'Name of the template to list scaffolding methods for (e.g., "nextjs-15", "typescript-mcp-package"). Either projectPath or templateName is required.',
      };
    }

    return {
      name: ListScaffoldingMethodsTool.TOOL_NAME,
      description: description.trim(),
      inputSchema: {
        type: 'object',
        properties,
        additionalProperties: false,
      },
    };
  }

  /**
   * Execute the tool
   */
  async execute(args: Record<string, any>): Promise<CallToolResult> {
    try {
      const { projectPath, templateName, cursor } = args as {
        projectPath?: string;
        templateName?: string;
        cursor?: string;
      };

      let result;

      // In monolith mode, read template name from toolkit.yaml or project.json
      if (this.isMonolith) {
        try {
          const config = await ProjectConfigResolver.resolveProjectConfig(process.cwd());
          const resolvedTemplateName = config.sourceTemplate;
          result = await this.scaffoldingMethodsService.listScaffoldingMethodsByTemplate(
            resolvedTemplateName,
            cursor,
          );
        } catch (error) {
          throw new Error(
            `Failed to read template name from configuration: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      } else {
        // Monorepo mode: validate that at least one parameter is provided
        if (!projectPath && !templateName) {
          throw new Error('Either projectPath or templateName must be provided');
        }

        // If both are provided, prioritize projectPath
        if (projectPath) {
          result = await this.scaffoldingMethodsService.listScaffoldingMethods(projectPath, cursor);
        } else {
          result = await this.scaffoldingMethodsService.listScaffoldingMethodsByTemplate(
            templateName!,
            cursor,
          );
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error listing scaffolding methods: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
}
