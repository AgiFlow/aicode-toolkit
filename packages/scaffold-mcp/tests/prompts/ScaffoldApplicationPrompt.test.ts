import { beforeEach, describe, expect, it } from 'vitest';
import { ScaffoldApplicationPrompt } from '../../src/prompts/ScaffoldApplicationPrompt';

describe('ScaffoldApplicationPrompt', () => {
  let prompt: ScaffoldApplicationPrompt;

  beforeEach(() => {
    prompt = new ScaffoldApplicationPrompt();
  });

  describe('getDefinition', () => {
    it('should return prompt definition', () => {
      const definition = prompt.getDefinition();

      expect(definition.name).toBe('scaffold-application');
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
      const messages = prompt.getMessages({ request: 'Create a Next.js dashboard app' });

      expect(messages[0].content.text).toContain('Create a Next.js dashboard app');
    });

    it('should work without user request', () => {
      const messages = prompt.getMessages();

      expect(messages[0].content.text).toBeTruthy();
    });

    it('should include workflow instructions', () => {
      const messages = prompt.getMessages();

      expect(messages[0].content.text).toContain('list-boilerplates');
      expect(messages[0].content.text).toContain('use-boilerplate');
    });

    it('should include guidelines for variables', () => {
      const messages = prompt.getMessages();

      expect(messages[0].content.text).toContain('variables_schema');
      expect(messages[0].content.text).toContain('kebab-case');
    });

    it('should include example workflow', () => {
      const messages = prompt.getMessages();

      expect(messages[0].content.text).toContain('Example');
      expect(messages[0].content.text).toContain('boilerplateName');
    });
  });

  describe('Monolith Mode', () => {
    let monolithPrompt: ScaffoldApplicationPrompt;

    beforeEach(() => {
      monolithPrompt = new ScaffoldApplicationPrompt({ isMonolith: true });
    });

    it('should adjust instructions for monolith mode', () => {
      const messages = monolithPrompt.getMessages();

      expect(messages[0].content.text).toContain('monolith');
      expect(messages[0].content.text).toContain('auto-detected');
    });

    it('should not require boilerplateName in examples for monolith mode', () => {
      const messages = monolithPrompt.getMessages();
      const text = messages[0].content.text;

      // In monolith mode, example should not have boilerplateName at the top level
      // It should only have variables
      const jsonExample = text.match(/```json\s*\{[\s\S]*?\}\s*```/);
      expect(jsonExample).toBeTruthy();

      // Extract the JSON example
      const jsonContent = jsonExample?.[0] || '';

      // Count occurrences of "boilerplateName" in the example
      const boilerplateNameCount = (jsonContent.match(/"boilerplateName"/g) || []).length;
      expect(boilerplateNameCount).toBe(0);
    });

    it('should mention toolkit.yaml in monolith mode', () => {
      const messages = monolithPrompt.getMessages();

      expect(messages[0].content.text).toContain('toolkit.yaml');
    });
  });
});
