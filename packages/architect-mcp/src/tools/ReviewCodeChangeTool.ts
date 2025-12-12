/**
 * ReviewCodeChangeTool
 *
 * DESIGN PATTERNS:
 * - Tool pattern with getDefinition() and execute() methods
 * - Service delegation for business logic
 * - JSON Schema validation for inputs
 *
 * CODING STANDARDS:
 * - Implement Tool interface from ../types
 * - Use TOOL_NAME constant with snake_case (e.g., 'file_read')
 * - Return CallToolResult with content array
 * - Handle errors with isError flag
 * - Delegate complex logic to services
 *
 * AVOID:
 * - Complex business logic in execute method
 * - Unhandled promise rejections
 * - Missing input validation
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Tool, ToolDefinition } from '../types';
import { CodeReviewService } from '../services/CodeReviewService';
import type { LlmToolId } from '@agiflowai/coding-agent-bridge';

interface ReviewCodeChangeToolInput {
  file_path: string;
}

interface ReviewCodeChangeToolOptions {
  llmTool?: LlmToolId;
  toolConfig?: Record<string, unknown>;
}

export class ReviewCodeChangeTool implements Tool<ReviewCodeChangeToolInput> {
  static readonly TOOL_NAME = 'review-code-change';

  private codeReviewService: CodeReviewService;

  constructor(options?: ReviewCodeChangeToolOptions) {
    this.codeReviewService = new CodeReviewService({
      llmTool: options?.llmTool,
      toolConfig: options?.toolConfig,
    });
  }

  getDefinition(): ToolDefinition {
    return {
      name: ReviewCodeChangeTool.TOOL_NAME,
      description:
        'Review code changes against template-specific RULES.yaml and provide feedback with severity rating',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'The file path to review for code quality and rule compliance',
          },
        },
        required: ['file_path'],
        additionalProperties: false,
      },
    };
  }

  async execute(input: ReviewCodeChangeToolInput): Promise<CallToolResult> {
    try {
      const reviewResult = await this.codeReviewService.reviewCodeChange(input.file_path);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(reviewResult, null, 2),
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
                file_path: input.file_path,
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
