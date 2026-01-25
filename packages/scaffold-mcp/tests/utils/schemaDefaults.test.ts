import { describe, expect, it } from 'vitest';
import { applySchemaDefaults, parseVariablesWithDefaults } from '../../src/utils/schemaDefaults';

describe('schemaDefaults', () => {
  describe('applySchemaDefaults', () => {
    it('should apply default values for missing properties', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          withFeature: { type: 'boolean', default: false },
          count: { type: 'number', default: 10 },
        },
        required: ['name'],
      };

      const result = applySchemaDefaults(schema, { name: 'test' });

      expect(result).toEqual({
        name: 'test',
        withFeature: false,
        count: 10,
      });
    });

    it('should not override provided values with defaults', () => {
      const schema = {
        type: 'object',
        properties: {
          withFeature: { type: 'boolean', default: false },
        },
      };

      const result = applySchemaDefaults(schema, { withFeature: true });

      expect(result.withFeature).toBe(true);
    });

    it('should handle empty variables', () => {
      const schema = {
        type: 'object',
        properties: {
          withFeature: { type: 'boolean', default: false },
          withStorybook: { type: 'boolean', default: true },
        },
      };

      const result = applySchemaDefaults(schema, {});

      expect(result).toEqual({
        withFeature: false,
        withStorybook: true,
      });
    });

    it('should handle schema without properties', () => {
      const schema = { type: 'object' };

      const result = applySchemaDefaults(schema, { foo: 'bar' });

      expect(result).toEqual({ foo: 'bar' });
    });

    it('should preserve extra properties not in schema', () => {
      const schema = {
        type: 'object',
        properties: {
          withFeature: { type: 'boolean', default: false },
        },
      };

      const result = applySchemaDefaults(schema, { extra: 'value', withFeature: true });

      expect(result).toEqual({
        extra: 'value',
        withFeature: true,
      });
    });
  });

  describe('parseVariablesWithDefaults', () => {
    it('should parse and apply defaults using Zod', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          withFeature: { type: 'boolean', default: false },
        },
        required: ['name'],
        additionalProperties: false,
      };

      const result = parseVariablesWithDefaults(schema, { name: 'test' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        name: 'test',
        withFeature: false,
      });
    });

    it('should return errors for missing required properties', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
        additionalProperties: false,
      };

      const result = parseVariablesWithDefaults(schema, {});

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should apply boolean defaults correctly', () => {
      const schema = {
        type: 'object',
        properties: {
          componentName: { type: 'string' },
          withSmartComponent: { type: 'boolean', default: false },
          withStorybook: { type: 'boolean', default: true },
        },
        required: ['componentName'],
        additionalProperties: false,
      };

      const result = parseVariablesWithDefaults(schema, { componentName: 'Button' });

      expect(result.success).toBe(true);
      expect(result.data.withSmartComponent).toBe(false);
      expect(result.data.withStorybook).toBe(true);
    });
  });
});
