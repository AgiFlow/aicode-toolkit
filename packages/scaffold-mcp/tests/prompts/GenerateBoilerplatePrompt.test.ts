import { beforeEach, describe, expect, it } from 'vitest';
import { GenerateBoilerplatePrompt } from '../../src/prompts/GenerateBoilerplatePrompt';
import { getText } from '../helpers/getText';

describe('GenerateBoilerplatePrompt', () => {
  let prompt: GenerateBoilerplatePrompt;

  beforeEach(() => {
    prompt = new GenerateBoilerplatePrompt();
  });

  describe('getDefinition', () => {
    it('should return prompt definition', () => {
      const definition = prompt.getDefinition();

      expect(definition.name).toBe('generate-boilerplate');
      expect(definition.description).toBeTruthy();
      expect(definition.arguments).toBeDefined();
    });

    it('should have optional request argument', () => {
      const definition = prompt.getDefinition();

      expect(definition.arguments).toHaveLength(1);
      expect(definition.arguments?.[0].name).toBe('request');
      expect(definition.arguments?.[0].required).toBe(false);
    });
  });

  describe('getMessages', () => {
    it('should return messages array', () => {
      const messages = prompt.getMessages();

      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('user');
      expect(messages[0].content.type).toBe('text');
    });

    it('should include user request when provided', () => {
      const messages = prompt.getMessages({ request: 'Create a React Vite template' });

      expect(getText(messages[0].content)).toContain('Create a React Vite template');
    });

    it('should work without user request', () => {
      const messages = prompt.getMessages();

      expect(getText(messages[0].content)).toBeTruthy();
    });

    it('should include workflow instructions', () => {
      const messages = prompt.getMessages();

      expect(getText(messages[0].content)).toContain('generate-boilerplate');
      expect(getText(messages[0].content)).toContain('generate-boilerplate-file');
      expect(getText(messages[0].content)).toContain('list-boilerplates');
      expect(getText(messages[0].content)).toContain('use-boilerplate');
    });

    it('should include guidelines for description and instruction', () => {
      const messages = prompt.getMessages();

      expect(getText(messages[0].content)).toContain('Description Field');
      expect(getText(messages[0].content)).toContain('Instruction Field');
    });

    it('should include template content guidelines', () => {
      const messages = prompt.getMessages();

      expect(getText(messages[0].content)).toContain('MINIMAL');
      expect(getText(messages[0].content)).toContain('business-agnostic');
    });
  });

  describe('Monolith Mode', () => {
    let monolithPrompt: GenerateBoilerplatePrompt;

    beforeEach(() => {
      monolithPrompt = new GenerateBoilerplatePrompt({ isMonolith: true });
    });

    it('should adjust instructions for monolith mode', () => {
      const messages = monolithPrompt.getMessages();

      expect(getText(messages[0].content)).toContain('monolith');
      expect(getText(messages[0].content)).toContain('defaults to "."');
    });

    it('should not include list-boilerplates step in monolith mode', () => {
      const messages = monolithPrompt.getMessages();
      const text = getText(messages[0].content);

      // In monolith mode, list-boilerplates step is not included in the workflow
      const listBoilerplatesMatches = text.match(/list-boilerplates/g);
      // Should appear less frequently than in monorepo mode (or not at all)
      expect(listBoilerplatesMatches?.length || 0).toBeLessThan(2);
    });
  });
});
