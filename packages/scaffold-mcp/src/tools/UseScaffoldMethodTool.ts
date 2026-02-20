import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { generateStableId } from '@agiflowai/aicode-utils';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { FileSystemService } from '../services/FileSystemService';
import { ScaffoldingMethodsService } from '../services/ScaffoldingMethodsService';
import type { ToolDefinition } from './types';

export class UseScaffoldMethodTool {
  static readonly TOOL_NAME = 'use-scaffold-method';
  private static readonly TEMP_LOG_DIR = os.tmpdir();

  private fileSystemService: FileSystemService;
  private scaffoldingMethodsService: ScaffoldingMethodsService;
  private isMonolith: boolean;

  constructor(templatesPath: string, isMonolith: boolean = false) {
    this.fileSystemService = new FileSystemService();
    this.scaffoldingMethodsService = new ScaffoldingMethodsService(
      this.fileSystemService,
      templatesPath,
    );
    this.isMonolith = isMonolith;
  }

  /**
   * Write scaffold execution info to temp log file for hook processing
   */
  private async writePendingScaffoldLog(
    scaffoldId: string,
    projectPath: string,
    featureName: string,
    generatedFiles: string[],
  ): Promise<void> {
    try {
      const logEntry = {
        timestamp: Date.now(),
        scaffoldId,
        projectPath,
        featureName,
        generatedFiles,
        operation: 'scaffold',
      };

      const tempLogFile = path.join(
        UseScaffoldMethodTool.TEMP_LOG_DIR,
        `scaffold-mcp-pending-${scaffoldId}.jsonl`,
      );

      await fs.appendFile(tempLogFile, `${JSON.stringify(logEntry)}\n`, 'utf-8');
    } catch (error) {
      // Fail silently - logging should not break the tool
      console.error('Failed to write pending scaffold log:', error);
    }
  }

  /**
   * Get the tool definition for MCP
   */
  getDefinition(): ToolDefinition {
    // Build properties based on mode
    const properties: Record<string, any> = {
      scaffold_feature_name: {
        type: 'string',
        description:
          'Exact name of the scaffold method to use (from list-scaffolding-methods response)',
      },
      variables: {
        type: 'object',
        description: "Variables object matching the scaffold method's variables_schema exactly",
      },
    };

    // Only add projectPath in monorepo mode
    // In monolith mode, automatically use current working directory
    if (!this.isMonolith) {
      properties.projectPath = {
        type: 'string',
        description:
          'Absolute path to the project directory (for monorepo: containing project.json; for monolith: workspace root with toolkit.yaml)',
      };
    }

    properties.marker = {
      type: 'string',
      description: 'Custom scaffold marker tag injected into generated code files (default: @scaffold-generated)',
    };

    return {
      name: UseScaffoldMethodTool.TOOL_NAME,
      description: `Generates and adds a specific feature to an existing project using a scaffolding method.

This tool will:
- Generate files based on the selected scaffolding method
- Replace template variables with provided values
- Add files to the appropriate locations in the project
- Follow the project's existing patterns and conventions
- Update imports and exports as needed

IMPORTANT:
- Always call \`list-scaffolding-methods\` first to see available methods and their schemas
- Use the exact scaffold method name from the list response
- Provide variables that match the method's variables_schema exactly
- The tool validates all inputs before generating code
`,
      inputSchema: {
        type: 'object',
        properties,
        required: this.isMonolith
          ? ['scaffold_feature_name', 'variables']
          : ['projectPath', 'scaffold_feature_name', 'variables'],
        additionalProperties: false,
      },
    };
  }

  /**
   * Execute the tool
   */
  async execute(args: Record<string, any>): Promise<CallToolResult> {
    try {
      const { projectPath, scaffold_feature_name, variables, marker } = args as {
        projectPath?: string;
        scaffold_feature_name: string;
        variables: Record<string, any>;
        marker?: string;
      };

      // In monolith mode, automatically use current working directory
      // In monorepo mode, projectPath is required by schema
      const resolvedProjectPath = this.isMonolith ? process.cwd() : projectPath!;

      const result = await this.scaffoldingMethodsService.useScaffoldMethod({
        projectPath: resolvedProjectPath,
        scaffold_feature_name,
        variables,
        marker,
      });

      // Generate stable scaffold ID
      const scaffoldId = generateStableId(6);

      // Write scaffold execution to temp log for hook processing
      if (result.createdFiles && result.createdFiles.length > 0) {
        await this.writePendingScaffoldLog(
          scaffoldId,
          resolvedProjectPath,
          scaffold_feature_name,
          result.createdFiles,
        );
      }

      // Append instructions for LLM to review and implement the scaffolded files
      const enhancedMessage = `${result.message}

IMPORTANT - Next Steps:
1. READ the generated files to understand their structure and template placeholders
2. IMPLEMENT the actual business logic according to the feature's purpose (replace TODOs and template variables)
3. REGISTER the feature in the appropriate files (e.g., import and register tools in server/index.ts, export from index.ts)
4. TEST the implementation to ensure it works correctly
5. Only after completing the implementation should you move to other tasks

Do not skip the implementation step - the scaffolded files contain templates that need actual code.`;

      return {
        content: [
          {
            type: 'text',
            text: enhancedMessage,
          },
          {
            type: 'text',
            text: `SCAFFOLD_ID:${scaffoldId}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error using scaffold method: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
}
