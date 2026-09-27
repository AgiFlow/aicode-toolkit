/**
 * AddRuleTool Tests
 *
 * TESTING PATTERNS:
 * - Test tool metadata (name, description, schema)
 * - Test successful execution with valid inputs
 * - Test error handling with invalid inputs
 * - Mock services when testing tools
 *
 * CODING STANDARDS:
 * - Use descriptive test names (should...)
 * - Test input validation
 * - Verify ToolResult structure
 * - Check both success and error paths
 * - Mock external dependencies and services
 */

import { describe, it, expect } from 'vitest';
import { AddRuleTool } from '../../src/tools/AddRuleTool';

describe('AddRuleTool', () => {
  const tool = new AddRuleTool();

  it('should have correct metadata', () => {
    const definition = tool.getDefinition();
    expect(definition.name).toBeDefined();
    expect(definition.description).toBe(
      "Add a new design pattern rule to a template's RULES.yaml or global RULES.yaml. Rules define specific coding standards, must-do/must-not-do items, and code examples.",
    );
    expect(definition.inputSchema).toBeDefined();
  });

  it('should execute successfully', async () => {
    const result = await tool.execute({
      pattern: 'test-pattern',
      description: 'Test pattern description',
      is_global: true,
    });

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
  });

  it('should return error when template not found', async () => {
    const result = await tool.execute({
      template_name: 'non-existent-template',
      pattern: 'test-pattern',
      description: 'Test pattern description',
      is_global: false,
    });

    expect(result.isError).toBe(true);
    const content = result.content[0];
    expect(content.type).toBe('text');
    if (content.type !== 'text') throw new Error('Expected text content');
    const response = JSON.parse(content.text);
    expect(response.error).toContain('not found');
  });

  it('should return error when rule pattern already exists', async () => {
    // First add a rule
    await tool.execute({
      pattern: 'duplicate-pattern',
      description: 'Test pattern description',
      is_global: true,
    });

    // Try to add the same pattern again
    const result = await tool.execute({
      pattern: 'duplicate-pattern',
      description: 'Another description',
      is_global: true,
    });

    expect(result.isError).toBe(true);
    const content = result.content[0];
    expect(content.type).toBe('text');
    if (content.type !== 'text') throw new Error('Expected text content');
    const response = JSON.parse(content.text);
    expect(response.error).toContain('already exists');
  });
});
