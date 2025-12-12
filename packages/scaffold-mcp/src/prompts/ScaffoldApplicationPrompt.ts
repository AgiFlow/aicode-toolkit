import { z } from 'zod';
import scaffoldApplicationTemplate from '../instructions/prompts/scaffold-application.md?raw';
import { TemplateService } from '../services/TemplateService';
import type { PromptDefinition, PromptMessage } from './types';

/**
 * Schema for ScaffoldApplicationPrompt constructor options
 */
export const scaffoldApplicationPromptOptionsSchema = z.object({
  isMonolith: z.boolean().default(false).describe('Whether the project is a monolith'),
  promptAsSkill: z.boolean().default(false).describe('Render prompt with skill front matter'),
});

export type ScaffoldApplicationPromptOptions = z.input<
  typeof scaffoldApplicationPromptOptionsSchema
>;
type ScaffoldApplicationPromptParsedOptions = z.output<
  typeof scaffoldApplicationPromptOptionsSchema
>;

/**
 * Prompt for scaffolding a new application using boilerplate templates
 */
export class ScaffoldApplicationPrompt {
  static readonly PROMPT_NAME = 'scaffold-application';
  private templateService = new TemplateService();
  private options: ScaffoldApplicationPromptParsedOptions;

  constructor(options: ScaffoldApplicationPromptOptions = {}) {
    try {
      this.options = scaffoldApplicationPromptOptionsSchema.parse(options);
    } catch (error) {
      throw new Error(
        `Invalid ScaffoldApplicationPrompt options: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get the prompt definition for MCP
   */
  getDefinition(): PromptDefinition {
    return {
      name: ScaffoldApplicationPrompt.PROMPT_NAME,
      description: 'Scaffold a new application from a boilerplate template',
      arguments: [
        {
          name: 'request',
          description: 'Describe the application you want to create (optional)',
          required: false,
        },
      ],
    };
  }

  /**
   * Get the prompt messages
   */
  getMessages(args?: { request?: string }): PromptMessage[] {
    const request = args?.request || '';

    const text = this.templateService.renderString(scaffoldApplicationTemplate, {
      request,
      isMonolith: this.options.isMonolith,
      promptAsSkill: this.options.promptAsSkill,
    });

    return [
      {
        role: 'user',
        content: {
          type: 'text',
          text,
        },
      },
    ];
  }
}
