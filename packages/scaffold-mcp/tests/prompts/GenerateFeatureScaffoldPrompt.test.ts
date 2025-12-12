import { beforeEach, describe, expect, it } from 'vitest';
import { GenerateFeatureScaffoldPrompt } from '../../src/prompts/GenerateFeatureScaffoldPrompt';

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

      expect(messages[0].content.text).toContain('Create a Next.js page scaffold');
    });

    it('should work without user request', () => {
      const messages = prompt.getMessages();

      expect(messages[0].content.text).toBeTruthy();
    });

    it('should include workflow instructions', () => {
      const messages = prompt.getMessages();

      expect(messages[0].content.text).toContain('generate-feature-scaffold');
      expect(messages[0].content.text).toContain('generate-boilerplate-file');
      expect(messages[0].content.text).toContain('list-scaffolding-methods');
      expect(messages[0].content.text).toContain('use-scaffold-method');
    });

    it('should mention feature naming convention', () => {
      const messages = prompt.getMessages();

      expect(messages[0].content.text).toContain('scaffold-');
    });

    it('should include conditional includes syntax', () => {
      const messages = prompt.getMessages();

      expect(messages[0].content.text).toContain('?withLayout=true');
    });

    it('should include template content guidelines', () => {
      const messages = prompt.getMessages();

      expect(messages[0].content.text).toContain('MINIMAL');
      expect(messages[0].content.text).toContain('business-agnostic');
    });
  });

  describe('Monolith Mode', () => {
    let monolithPrompt: GenerateFeatureScaffoldPrompt;

    beforeEach(() => {
      monolithPrompt = new GenerateFeatureScaffoldPrompt({ isMonolith: true });
    });

    it('should adjust instructions for monolith mode', () => {
      const messages = monolithPrompt.getMessages();

      expect(messages[0].content.text).toContain('auto-detected');
      expect(messages[0].content.text).toContain('toolkit.yaml');
    });

    it('should mention template name auto-detection', () => {
      const messages = monolithPrompt.getMessages();
      const text = messages[0].content.text;

      expect(text).toContain('Template name will be auto-detected');
    });
  });
});
