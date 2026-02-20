import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TemplateService } from '../../src/services';
import { SyncTemplatePatternsPrompt, type PromptArgument } from '../../src/prompts';

interface TextContent {
  type: 'text';
  text: string;
}

function isTextContent(content: unknown): content is TextContent {
  return (
    typeof content === 'object' &&
    content !== null &&
    'type' in content &&
    content.type === 'text' &&
    'text' in content &&
    typeof content.text === 'string'
  );
}

describe('SyncTemplatePatternsPrompt', (): void => {
  let prompt: SyncTemplatePatternsPrompt;

  beforeEach((): void => {
    prompt = new SyncTemplatePatternsPrompt();
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  describe('getDefinition', (): void => {
    it('should return correct prompt name', (): void => {
      const definition = prompt.getDefinition();
      expect(definition.name).toBe(SyncTemplatePatternsPrompt.PROMPT_NAME);
    });

    it('should return a description', (): void => {
      const definition = prompt.getDefinition();
      expect(definition.description).toBeTruthy();
    });

    it('should have optional request, templateName and filePath arguments', (): void => {
      const definition = prompt.getDefinition();
      expect(definition.arguments).toHaveLength(3);
      expect(definition.arguments?.every((arg: PromptArgument): boolean => arg.required === false)).toBe(true);
      const names = definition.arguments?.map((arg: PromptArgument): string => arg.name) ?? [];
      expect(names).toEqual(['request', 'templateName', 'filePath']);
    });
  });

  describe('execute', (): void => {
    it('should return a messages array with a user message', async (): Promise<void> => {
      const result = await prompt.execute({});
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[0].content.type).toBe('text');
    });

    it('should return text content when executed without arguments', async (): Promise<void> => {
      const result = await prompt.execute({});
      const content = result.messages[0].content;
      expect(isTextContent(content)).toBe(true);
      if (isTextContent(content)) {
        expect(content.text).toBeTruthy();
      }
    });

    it('should return user message when executed with all optional arguments', async (): Promise<void> => {
      const result = await prompt.execute({
        request: 'update components',
        templateName: 'nextjs-15',
        filePath: 'src/tools/MyTool.ts',
      });
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');
    });

    it('should throw when template rendering fails', async (): Promise<void> => {
      vi.spyOn(TemplateService.prototype, 'renderString').mockImplementation((): never => {
        throw new Error('render error');
      });
      await expect(prompt.execute({})).rejects.toThrow('Failed to execute SyncTemplatePatternsPrompt');
    });
  });

  describe('constructor options', (): void => {
    it('should accept valid options', (): void => {
      expect((): SyncTemplatePatternsPrompt => new SyncTemplatePatternsPrompt({ isMonolith: true })).not.toThrow();
      expect((): SyncTemplatePatternsPrompt => new SyncTemplatePatternsPrompt({ promptAsSkill: true })).not.toThrow();
    });

    it('should throw on invalid options', (): void => {
      // JSON.parse returns `any`, allowing runtime-invalid data without type assertions
      const invalidOptions: { isMonolith: boolean } = JSON.parse('{"isMonolith":"bad"}');
      expect((): SyncTemplatePatternsPrompt => new SyncTemplatePatternsPrompt(invalidOptions)).toThrow();
    });
  });
});
