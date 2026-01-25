import type { JsonSchema } from '@composio/json-schema-to-zod';
import { jsonSchemaToZod } from '@composio/json-schema-to-zod';
import { z } from 'zod';

export type { JsonSchema };

/**
 * Type for object schemas with properties (used for applying defaults)
 */
export interface ObjectSchema {
  type?: string;
  properties?: Record<string, { default?: unknown; [key: string]: unknown }>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface ParseResult {
  success: boolean;
  data: Record<string, any>;
  errors: string[];
}

/**
 * Parses variables against a JSON Schema and applies default values.
 * Uses Zod for parsing which automatically applies defaults from the schema.
 *
 * @param schema - JSON Schema with properties and defaults
 * @param variables - User-provided variables
 * @returns Parsed variables with defaults applied, or errors if validation fails
 */
export function parseVariablesWithDefaults(
  schema: JsonSchema,
  variables: Record<string, any>,
): ParseResult {
  try {
    // Convert JSON schema to Zod schema
    const zodSchema = jsonSchemaToZod(schema);

    // Parse and apply defaults
    const parsed = zodSchema.parse(variables);

    return {
      success: true,
      data: parsed as Record<string, any>,
      errors: [],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map((err) => {
        const path = err.path.length > 0 ? err.path.join('.') : 'root';
        return `${path}: ${err.message}`;
      });
      return {
        success: false,
        data: variables, // Return original variables on error
        errors,
      };
    }
    return {
      success: false,
      data: variables,
      errors: [`Schema parsing error: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

/**
 * Applies schema defaults to variables without strict validation.
 * This is useful when you want to fill in defaults but not fail on extra properties.
 *
 * @param schema - JSON Schema with properties and defaults
 * @param variables - User-provided variables
 * @returns Variables with defaults applied for missing properties
 */
export function applySchemaDefaults(
  schema: ObjectSchema,
  variables: Record<string, any>,
): Record<string, any> {
  const result = { ...variables };

  if (!schema.properties) {
    return result;
  }

  // Apply defaults for missing properties
  for (const [key, propSchema] of Object.entries(schema.properties)) {
    if (result[key] === undefined && propSchema.default !== undefined) {
      result[key] = propSchema.default;
    }
  }

  return result;
}
