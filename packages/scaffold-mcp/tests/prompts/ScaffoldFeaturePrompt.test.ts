import { beforeEach, describe, expect, it } from 'vitest';
import { ScaffoldFeaturePrompt } from '../../src/prompts/ScaffoldFeaturePrompt';
import { getText } from '../helpers/getText';

describe('ScaffoldFeaturePrompt', () => {
  let prompt: ScaffoldFeaturePrompt;

  beforeEach(() => {
    prompt = new ScaffoldFeaturePrompt();
  });

  describe('getDefinition', () => {
    it('should return prompt definition', () => {
      const definition = prompt.getDefinition();

      expect(definition.name).toBe('scaffold-feature');
      expect(definition.description).toBeTruthy();
      expect(definition.arguments).toBeDefined();
    });

    it('should have optional request and projectPath arguments', () => {
      const definition = prompt.getDefinition();

      expect(definition.arguments).toHaveLength(2);
      expect(definition.arguments?.[0].name).toBe('request');
      expect(definition.arguments?.[0].required).toBe(false);
      expect(definition.arguments?.[1].name).toBe('projectPath');
      expect(definition.arguments?.[1].required).toBe(false);
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
      const messages = prompt.getMessages({ request: 'Add a user profile page' });

      expect(getText(messages[0].content)).toContain('Add a user profile page');
    });

    it('should include project path when provided', () => {
      const messages = prompt.getMessages({ projectPath: 'apps/my-app' });

      expect(getText(messages[0].content)).toContain('apps/my-app');
    });

    it('should work without arguments', () => {
      const messages = prompt.getMessages();

      expect(getText(messages[0].content)).toBeTruthy();
    });

    it('should include workflow instructions', () => {
      const messages = prompt.getMessages();

      expect(getText(messages[0].content)).toContain('list-scaffolding-methods');
      expect(getText(messages[0].content)).toContain('use-scaffold-method');
    });

    it('should include guidelines for variables', () => {
      const messages = prompt.getMessages();

      expect(getText(messages[0].content)).toContain('variables_schema');
      expect(getText(messages[0].content)).toContain('PascalCase');
    });

    it('should mention conditional files', () => {
      const messages = prompt.getMessages();

      expect(getText(messages[0].content)).toContain('?condition=true');
    });

    it('should include example workflow', () => {
      const messages = prompt.getMessages();

      expect(getText(messages[0].content)).toContain('Example');
      expect(getText(messages[0].content)).toContain('scaffold_feature_name');
    });
  });

  describe('Monolith Mode', () => {
    let monolithPrompt: ScaffoldFeaturePrompt;

    beforeEach(() => {
      monolithPrompt = new ScaffoldFeaturePrompt({ isMonolith: true });
    });

    it('should adjust instructions for monolith mode', () => {
      const messages = monolithPrompt.getMessages();

      expect(getText(messages[0].content)).toContain('monolith mode');
      expect(getText(messages[0].content)).toContain('current working directory');
    });

    it('should not require projectPath in examples for monolith mode', () => {
      const messages = monolithPrompt.getMessages();
      const text = getText(messages[0].content);

      // Check that the JSON example doesn't include projectPath
      expect(text).toContain('```json');
      // In monolith mode, example should be empty object
      expect(text).toContain('{}');
    });
  });
});
