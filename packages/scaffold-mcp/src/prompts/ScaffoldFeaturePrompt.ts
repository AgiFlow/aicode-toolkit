import { z } from 'zod';
import scaffoldFeatureTemplate from '../instructions/prompts/scaffold-feature.md?raw';
import { TemplateService } from '../services/TemplateService';
import type { PromptDefinition, PromptMessage } from './types';

/**
 * Schema for ScaffoldFeaturePrompt constructor options
 */
export const scaffoldFeaturePromptOptionsSchema = z.object({
  isMonolith: z.boolean().default(false).describe('Whether the project is a monolith'),
  promptAsSkill: z.boolean().default(false).describe('Render prompt with skill front matter'),
});

export type ScaffoldFeaturePromptOptions = z.input<typeof scaffoldFeaturePromptOptionsSchema>;
type ScaffoldFeaturePromptParsedOptions = z.output<typeof scaffoldFeaturePromptOptionsSchema>;

/**
 * Prompt for scaffolding a new feature in an existing project
 */
export class ScaffoldFeaturePrompt {
  static readonly PROMPT_NAME = 'scaffold-feature';
  private templateService = new TemplateService();
  private options: ScaffoldFeaturePromptParsedOptions;

  constructor(options: ScaffoldFeaturePromptOptions = {}) {
    try {
      this.options = scaffoldFeaturePromptOptionsSchema.parse(options);
    } catch (error) {
      throw new Error(
        `Invalid ScaffoldFeaturePrompt options: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get the prompt definition for MCP
   */
  getDefinition(): PromptDefinition {
    return {
      name: ScaffoldFeaturePrompt.PROMPT_NAME,
      description: 'Scaffold a new feature (page, component, service, etc.) in an existing project',
      arguments: [
        {
          name: 'request',
          description: 'Describe the feature you want to add (optional)',
          required: false,
        },
        {
          name: 'projectPath',
          description: 'Path to the project (e.g., "apps/my-app") - optional if can be inferred',
          required: false,
        },
      ],
    };
  }

  /**
   * Get the prompt messages
   */
  getMessages(args?: { request?: string; projectPath?: string }): PromptMessage[] {
    const request = args?.request || '';
    const projectPath = args?.projectPath || '';

    const text = this.templateService.renderString(scaffoldFeatureTemplate, {
      request,
      projectPath,
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
