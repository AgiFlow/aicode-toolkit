import type { GetPromptResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import syncTemplatePatternsTemplate from '../instructions/prompts/sync-template-patterns.md?raw';
import { TemplateService } from '../services';
import type { Prompt, PromptDefinition } from './types';

export const syncTemplatePatternsPromptOptionsSchema = z.object({
  isMonolith: z.boolean().default(false).describe('Whether the project is a monolith'),
  promptAsSkill: z.boolean().default(false).describe('Render prompt with skill front matter'),
});

export interface SyncTemplatePatternsPromptOptions
  extends z.input<typeof syncTemplatePatternsPromptOptionsSchema> {}

interface SyncTemplatePatternsArgs {
  request?: string;
  templateName?: string;
  filePath?: string;
}

export class SyncTemplatePatternsPrompt implements Prompt {
  static readonly PROMPT_NAME = 'sync-template-patterns';
  private templateService = new TemplateService();
  private options: z.output<typeof syncTemplatePatternsPromptOptionsSchema>;

  constructor(options: SyncTemplatePatternsPromptOptions = {}) {
    try {
      this.options = syncTemplatePatternsPromptOptionsSchema.parse(options);
    } catch (error) {
      throw new Error(
        `Invalid SyncTemplatePatternsPrompt options: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  getDefinition(): PromptDefinition {
    return {
      name: SyncTemplatePatternsPrompt.PROMPT_NAME,
      description:
        'Detect discrepancies between scaffold template files and updated design patterns, then update the templates to match',
      arguments: [
        {
          name: 'request',
          description: 'Describe what changed or what to sync (optional)',
          required: false,
        },
        {
          name: 'templateName',
          description: 'Specific template to scope the sync to (e.g. "nextjs-15")',
          required: false,
        },
        {
          name: 'filePath',
          description: 'File type to focus on (e.g. "src/tools/MyTool.ts")',
          required: false,
        },
      ],
    };
  }

  async execute(args: SyncTemplatePatternsArgs): Promise<GetPromptResult> {
    try {
      const text = this.templateService.renderString(syncTemplatePatternsTemplate, {
        request: args.request ?? '',
        templateName: args.templateName ?? '',
        filePath: args.filePath ?? '',
        isMonolith: this.options.isMonolith,
        promptAsSkill: this.options.promptAsSkill,
      });

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text,
            },
          },
        ],
      };
    } catch (error) {
      throw new Error(
        `Failed to execute SyncTemplatePatternsPrompt: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
