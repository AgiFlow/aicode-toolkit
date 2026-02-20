import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import useBoilerplateDescription from '../instructions/tools/use-boilerplate/description.md?raw';
import { BoilerplateService } from '../services/BoilerplateService';
import { TemplateService } from '../services/TemplateService';
import type { UseBoilerplateRequest } from '../types/boilerplateTypes';
import type { ToolDefinition } from './types';

export class UseBoilerplateTool {
  static readonly TOOL_NAME = 'use-boilerplate';

  private boilerplateService: BoilerplateService;
  private templateService: TemplateService;
  private isMonolith: boolean;

  constructor(templatesPath: string, isMonolith: boolean = false) {
    this.boilerplateService = new BoilerplateService(templatesPath);
    this.templateService = new TemplateService();
    this.isMonolith = isMonolith;
  }

  /**
   * Get the tool definition for MCP
   */
  getDefinition(): ToolDefinition {
    const description = this.templateService.renderString(useBoilerplateDescription, {
      isMonolith: this.isMonolith,
    });

    // Build properties based on mode
    const properties: Record<string, any> = {
      variables: {
        type: 'object',
        description: "Variables object matching the boilerplate's variables_schema exactly",
      },
    };

    // Only add boilerplateName and targetFolderOverride in monorepo mode
    if (!this.isMonolith) {
      properties.boilerplateName = {
        type: 'string',
        description: 'Exact name of the boilerplate to use (from list-boilerplates response)',
      };
      properties.targetFolderOverride = {
        type: 'string',
        description:
          'Optional override for target folder. If not provided, uses boilerplate targetFolder (monorepo) or workspace root (monolith)',
      };
    }

    properties.marker = {
      type: 'string',
      description: 'Custom scaffold marker tag injected into generated code files (default: @scaffold-generated)',
    };

    return {
      name: UseBoilerplateTool.TOOL_NAME,
      description: description.trim(),
      inputSchema: {
        type: 'object',
        properties,
        required: this.isMonolith ? ['variables'] : ['boilerplateName', 'variables'],
        additionalProperties: false,
      },
    };
  }

  /**
   * Execute the tool
   */
  async execute(args: Record<string, any>): Promise<CallToolResult> {
    try {
      const { boilerplateName, variables, targetFolderOverride, marker } = args as {
        boilerplateName?: string;
        variables: Record<string, any>;
        targetFolderOverride?: string;
        marker?: string;
      };

      // Create the request object
      // In monolith mode, boilerplateName is read from toolkit.yaml by BoilerplateService
      // monolith parameter is auto-detected by BoilerplateService
      const request: UseBoilerplateRequest = {
        boilerplateName,
        variables,
        targetFolderOverride,
        monolith: this.isMonolith,
        marker,
      };

      // Execute the boilerplate service
      const result = await this.boilerplateService.useBoilerplate(request);

      // Append instructions for LLM to review and implement the scaffolded files
      const enhancedMessage = `${result.message}

IMPORTANT - Next Steps:
1. READ the generated project files to understand their structure
2. Review the boilerplate configuration and understand what was created
3. If the project requires additional features, use list-scaffolding-methods to see available options
4. Install dependencies (pnpm install) before testing or building
5. Follow the project's README for setup instructions

The boilerplate provides a starting point - you may need to add features or customize the generated code based on the project requirements.`;

      return {
        content: [
          {
            type: 'text',
            text: enhancedMessage,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error using boilerplate: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
}
