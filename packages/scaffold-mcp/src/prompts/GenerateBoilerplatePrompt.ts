import { z } from 'zod';
import generateBoilerplateTemplate from '../instructions/prompts/generate-boilerplate.md?raw';
import { TemplateService } from '../services/TemplateService';
import type { PromptDefinition, PromptMessage } from './types';

/**
 * Schema for GenerateBoilerplatePrompt constructor options
 */
export const generateBoilerplatePromptOptionsSchema = z.object({
  isMonolith: z.boolean().default(false).describe('Whether the project is a monolith'),
  promptAsSkill: z.boolean().default(false).describe('Render prompt with skill front matter'),
});

export type GenerateBoilerplatePromptOptions = z.input<
  typeof generateBoilerplatePromptOptionsSchema
>;
type GenerateBoilerplatePromptParsedOptions = z.output<
  typeof generateBoilerplatePromptOptionsSchema
>;

/**
 * Prompt for generating boilerplates
 */
export class GenerateBoilerplatePrompt {
  static readonly PROMPT_NAME = 'generate-boilerplate';
  private templateService = new TemplateService();
  private options: GenerateBoilerplatePromptParsedOptions;

  constructor(options: GenerateBoilerplatePromptOptions = {}) {
    try {
      this.options = generateBoilerplatePromptOptionsSchema.parse(options);
    } catch (error) {
      throw new Error(
        `Invalid GenerateBoilerplatePrompt options: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get the prompt definition for MCP
   */
  getDefinition(): PromptDefinition {
    return {
      name: GenerateBoilerplatePrompt.PROMPT_NAME,
      description: 'Generate a new boilerplate template configuration',
      arguments: [
        {
          name: 'request',
          description: 'Describe the boilerplate template you want to create',
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

    const text = this.templateService.renderString(generateBoilerplateTemplate, {
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
