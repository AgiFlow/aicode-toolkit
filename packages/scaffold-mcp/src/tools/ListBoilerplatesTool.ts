import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import listBoilerplatesDescription from '../instructions/tools/list-boilerplates/description.md?raw';
import { BoilerplateService } from '../services/BoilerplateService';
import { TemplateService } from '../services/TemplateService';
import type { ListBoilerplateResponse } from '../types/boilerplateTypes';
import type { ToolDefinition } from './types';

export class ListBoilerplatesTool {
  static readonly TOOL_NAME = 'list-boilerplates';

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
    const description = this.templateService.renderString(listBoilerplatesDescription, {
      isMonolith: this.isMonolith,
    });

    return {
      name: ListBoilerplatesTool.TOOL_NAME,
      description: description.trim(),
      inputSchema: {
        type: 'object',
        properties: {
          cursor: {
            type: 'string',
            description:
              'Optional pagination cursor to fetch the next page of results. Omit to fetch the first page.',
          },
        },
        additionalProperties: false,
      },
    };
  }

  /**
   * Execute the tool
   */
  async execute(args: Record<string, any> = {}): Promise<CallToolResult> {
    try {
      const { cursor } = args as { cursor?: string };
      const result: ListBoilerplateResponse =
        await this.boilerplateService.listBoilerplates(cursor);

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
            text: `Error listing boilerplates: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
}
