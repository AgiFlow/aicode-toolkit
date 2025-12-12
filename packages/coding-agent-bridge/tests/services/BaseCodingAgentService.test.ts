/**
 * BaseCodingAgentService Tests
 *
 * TESTING PATTERNS:
 * - Test shared functionality in base class
 * - Test toolConfig argument building through concrete implementation
 * - Note: Testing protected methods via subclass is acceptable for abstract base classes
 *   as we need to verify the contract that subclasses depend on
 *
 * CODING STANDARDS:
 * - Use describe blocks to group related tests
 * - Use test for individual test cases
 * - Test both success and error cases
 * - Use test.each for parameterized tests
 * - Test edge cases and boundary conditions
 */

import { describe, test, expect } from 'vitest';
import { BaseCodingAgentService } from '../../src/services/BaseCodingAgentService';
import type {
  LlmInvocationParams,
  LlmInvocationResponse,
  McpSettings,
  PromptConfig,
} from '../../src/types';

/**
 * Concrete implementation for testing abstract class
 * Note: Exposing protected methods is necessary for testing abstract base class contracts
 * that subclasses depend on.
 */
class TestCodingAgentService extends BaseCodingAgentService {
  async isEnabled(): Promise<boolean> {
    return true;
  }

  async updateMcpSettings(_settings: McpSettings): Promise<void> {
    // No-op for testing
  }

  async updatePrompt(_config: PromptConfig): Promise<void> {
    // No-op for testing
  }

  async invokeAsLlm(_params: LlmInvocationParams): Promise<LlmInvocationResponse> {
    return {
      content: 'test response',
      model: 'test-model',
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }

  // Expose protected method for testing base class contract
  public testBuildToolConfigArgs(): string[] {
    return this.buildToolConfigArgs();
  }

  // Expose toolConfig for testing initialization
  public getToolConfig(): Record<string, unknown> {
    return this.toolConfig;
  }
}

describe('BaseCodingAgentService', () => {
  describe('constructor', () => {
    test('initializes with empty toolConfig when no options provided', () => {
      const service = new TestCodingAgentService();
      expect(service.getToolConfig()).toEqual({});
    });

    test('initializes with provided toolConfig', () => {
      const toolConfig = { model: 'test-model', timeout: 5000 };
      const service = new TestCodingAgentService({ toolConfig });
      expect(service.getToolConfig()).toEqual(toolConfig);
    });
  });

  describe('buildToolConfigArgs', () => {
    test('returns empty array when toolConfig is empty', () => {
      const service = new TestCodingAgentService();
      expect(service.testBuildToolConfigArgs()).toEqual([]);
    });

    // Parameterized tests for simple key-value conversions
    test.each([
      [{ model: 'test-model' }, ['--model', 'test-model']],
      [{ timeout: 5000 }, ['--timeout', '5000']],
      [{ verbose: true }, ['--verbose', 'true']],
      [{ quiet: false }, ['--quiet', 'false']],
    ])('converts %o to CLI args %o', (toolConfig, expected) => {
      const service = new TestCodingAgentService({ toolConfig });
      expect(service.testBuildToolConfigArgs()).toEqual(expected);
    });

    // Parameterized tests for camelCase to kebab-case conversion
    test.each([
      ['maxTokens', '--max-tokens'],
      ['reasoningLevel', '--reasoning-level'],
      ['outputFormat', '--output-format'],
      ['apiKey', '--api-key'],
    ])('converts camelCase key "%s" to kebab-case flag "%s"', (key, expectedFlag) => {
      const service = new TestCodingAgentService({
        toolConfig: { [key]: 'value' },
      });
      const args = service.testBuildToolConfigArgs();
      expect(args[0]).toBe(expectedFlag);
    });

    test('converts multiple key-values to CLI args', () => {
      const service = new TestCodingAgentService({
        toolConfig: { model: 'test-model', timeout: 5000 },
      });
      const args = service.testBuildToolConfigArgs();
      expect(args).toHaveLength(4);
      expect(args).toContain('--model');
      expect(args).toContain('test-model');
      expect(args).toContain('--timeout');
      expect(args).toContain('5000');
    });

    // Parameterized tests for null/undefined handling
    test.each([
      [{ model: 'test', timeout: undefined }, ['--model', 'test']],
      [{ model: 'test', timeout: null }, ['--model', 'test']],
    ])('skips null/undefined values in %o', (toolConfig, expected) => {
      const service = new TestCodingAgentService({ toolConfig });
      expect(service.testBuildToolConfigArgs()).toEqual(expected);
    });

    // Edge cases
    test('handles empty string values', () => {
      const service = new TestCodingAgentService({
        toolConfig: { model: '' },
      });
      const args = service.testBuildToolConfigArgs();
      expect(args).toEqual(['--model', '']);
    });

    test('handles special characters in values', () => {
      const specialValue = 'test-value_with.special/chars';
      const service = new TestCodingAgentService({
        toolConfig: { path: specialValue },
      });
      const args = service.testBuildToolConfigArgs();
      expect(args).toContain('--path');
      expect(args).toContain(specialValue);
    });

    test('handles zero as a valid value', () => {
      const service = new TestCodingAgentService({
        toolConfig: { count: 0 },
      });
      const args = service.testBuildToolConfigArgs();
      expect(args).toEqual(['--count', '0']);
    });

    test('handles negative numbers', () => {
      const service = new TestCodingAgentService({
        toolConfig: { offset: -100 },
      });
      const args = service.testBuildToolConfigArgs();
      expect(args).toEqual(['--offset', '-100']);
    });

    test('converts nested objects to string representation', () => {
      const service = new TestCodingAgentService({
        toolConfig: { nested: { key: 'value' } },
      });
      const args = service.testBuildToolConfigArgs();
      expect(args).toContain('--nested');
      expect(args).toContain('[object Object]');
    });

    test('converts arrays to string representation', () => {
      const service = new TestCodingAgentService({
        toolConfig: { items: ['a', 'b', 'c'] },
      });
      const args = service.testBuildToolConfigArgs();
      expect(args).toContain('--items');
      expect(args).toContain('a,b,c');
    });
  });
});
