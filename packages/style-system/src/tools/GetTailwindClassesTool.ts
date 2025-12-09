/**
 * GetTailwindClassesTool
 *
 * DESIGN PATTERNS:
 * - Tool pattern with getDefinition() and execute() methods
 * - Service delegation for business logic
 * - JSON Schema validation for inputs
 *
 * CODING STANDARDS:
 * - Implement Tool interface from ../types
 * - Use TOOL_NAME constant with snake_case (e.g., 'get_tailwind_classes')
 * - Return CallToolResult with content array
 * - Handle errors with isError flag
 * - Delegate complex logic to services
 *
 * AVOID:
 * - Complex business logic in execute method
 * - Unhandled promise rejections
 * - Missing input validation
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { TemplatesManagerService } from '@agiflowai/aicode-utils';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { getAppDesignSystemConfig } from '../config';
import { TailwindClassesService } from '../services/TailwindClassesService';
import type { Tool, ToolDefinition } from '../types';

interface GetTailwindClassesInput {
  category?: string;
  appPath?: string;
}

export class GetTailwindClassesTool implements Tool<GetTailwindClassesInput> {
  static readonly TOOL_NAME = 'get-tailwind-classes';

  private service = new TailwindClassesService();
  private defaultThemePath: string;

  constructor(defaultThemePath: string = 'packages/frontend/web-theme/src/agimon-theme.css') {
    this.defaultThemePath = defaultThemePath;
  }

  getDefinition(): ToolDefinition {
    return {
      name: GetTailwindClassesTool.TOOL_NAME,
      description:
        'Extract and return all support Tailwind CSS classes supported by the mono repo',
      inputSchema: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: "Optional category filter: 'colors', 'typography', 'spacing', 'effects', 'all' (default)",
          },
          appPath: {
            type: 'string',
            description:
              'Optional app path (relative or absolute) to read theme path from project.json style-system config (e.g., "apps/agiflow-app")',
          },
        },
        additionalProperties: false,
      },
    };
  }

  async execute(input: GetTailwindClassesInput): Promise<CallToolResult> {
    try {
      const category = input.category || 'all';
      const workspaceRoot = TemplatesManagerService.getWorkspaceRootSync();
      let themePath: string;

      // Get theme path from project.json if appPath is provided
      if (input.appPath) {
        const config = await getAppDesignSystemConfig(input.appPath);
        if (config.themePath) {
          themePath = path.resolve(workspaceRoot, config.themePath);
        } else {
          // Use default if not configured in project.json
          themePath = path.resolve(workspaceRoot, this.defaultThemePath);
        }
      } else {
        // Use default theme path
        themePath = path.resolve(workspaceRoot, this.defaultThemePath);
      }

      // Validate theme path exists
      try {
        await fs.access(themePath);
      } catch {
        throw new Error(
          `Theme file not found: ${themePath}. ${input.appPath ? `Check the themePath in ${input.appPath}/project.json or ` : ''}Ensure the file exists.`,
        );
      }

      const result = await this.service.extractClasses(category, themePath);

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
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }
}
