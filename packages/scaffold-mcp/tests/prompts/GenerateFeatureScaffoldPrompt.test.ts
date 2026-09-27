import { beforeEach, describe, expect, it } from 'vitest';
import { GenerateFeatureScaffoldPrompt } from '../../src/prompts/GenerateFeatureScaffoldPrompt';
import { getText } from '../helpers/getText';

describe('GenerateFeatureScaffoldPrompt', () => {
  let prompt: GenerateFeatureScaffoldPrompt;

  beforeEach(() => {
    prompt = new GenerateFeatureScaffoldPrompt();
  });

  describe('getDefinition', () => {
    it('should return prompt definition', () => {
      const definition = prompt.getDefinition();

      expect(definition.name).toBe('generate-feature-scaffold');
      expect(definition.description).toContain('feature scaffold');
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
      const messages = prompt.getMessages({ request: 'Create a Next.js page scaffold' });

      expect(getText(messages[0].content)).toContain('Create a Next.js page scaffold');
    });

    it('should work without user request', () => {
      const messages = prompt.getMessages();

      expect(getText(messages[0].content)).toBeTruthy();
    });

    it('should include workflow instructions', () => {
      const messages = prompt.getMessages();

      expect(getText(messages[0].content)).toContain('generate-feature-scaffold');
      expect(getText(messages[0].content)).toContain('generate-boilerplate-file');
      expect(getText(messages[0].content)).toContain('list-scaffolding-methods');
      expect(getText(messages[0].content)).toContain('use-scaffold-method');
    });

    it('should mention feature naming convention', () => {
      const messages = prompt.getMessages();

      expect(getText(messages[0].content)).toContain('scaffold-');
    });

    it('should include conditional includes syntax', () => {
      const messages = prompt.getMessages();

      expect(getText(messages[0].content)).toContain('?withLayout=true');
    });

    it('should include template content guidelines', () => {
      const messages = prompt.getMessages();

      expect(getText(messages[0].content)).toContain('MINIMAL');
      expect(getText(messages[0].content)).toContain('business-agnostic');
    });
  });

  describe('Monolith Mode', () => {
    let monolithPrompt: GenerateFeatureScaffoldPrompt;

    beforeEach(() => {
      monolithPrompt = new GenerateFeatureScaffoldPrompt({ isMonolith: true });
    });

    it('should adjust instructions for monolith mode', () => {
      const messages = monolithPrompt.getMessages();

      expect(getText(messages[0].content)).toContain('auto-detected');
      expect(getText(messages[0].content)).toContain('.toolkit/settings.yaml');
    });

    it('should mention template name auto-detection', () => {
      const messages = monolithPrompt.getMessages();
      const text = getText(messages[0].content);

      expect(text).toContain('Template name will be auto-detected');
    });
  });
});
