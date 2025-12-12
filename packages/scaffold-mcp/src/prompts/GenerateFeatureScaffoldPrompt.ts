import { z } from 'zod';
import generateFeatureScaffoldTemplate from '../instructions/prompts/generate-feature-scaffold.md?raw';
import { TemplateService } from '../services/TemplateService';
import type { PromptDefinition, PromptMessage } from './types';

/**
 * Schema for GenerateFeatureScaffoldPrompt constructor options
 */
export const generateFeatureScaffoldPromptOptionsSchema = z.object({
  isMonolith: z.boolean().default(false).describe('Whether the project is a monolith'),
  promptAsSkill: z.boolean().default(false).describe('Render prompt with skill front matter'),
});

export type GenerateFeatureScaffoldPromptOptions = z.input<typeof generateFeatureScaffoldPromptOptionsSchema>;
type GenerateFeatureScaffoldPromptParsedOptions = z.output<typeof generateFeatureScaffoldPromptOptionsSchema>;

/**
 * Prompt for generating feature scaffolds
 */
export class GenerateFeatureScaffoldPrompt {
  static readonly PROMPT_NAME = 'generate-feature-scaffold';
  private templateService = new TemplateService();
  private options: GenerateFeatureScaffoldPromptParsedOptions;

  constructor(options: GenerateFeatureScaffoldPromptOptions = {}) {
    try {
      this.options = generateFeatureScaffoldPromptOptionsSchema.parse(options);
    } catch (error) {
      throw new Error(
        `Invalid GenerateFeatureScaffoldPrompt options: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get the prompt definition for MCP
   */
  getDefinition(): PromptDefinition {
    return {
      name: GenerateFeatureScaffoldPrompt.PROMPT_NAME,
      description: 'Generate a new feature scaffold configuration',
      arguments: [
        {
          name: 'request',
          description: 'Describe the feature scaffold you want to create',
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

    const text = this.templateService.renderString(generateFeatureScaffoldTemplate, {
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
