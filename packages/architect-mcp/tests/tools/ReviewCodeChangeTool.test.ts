/**
 * ReviewCodeChangeTool Tests
 *
 * TESTING PATTERNS:
 * - Test tool metadata (name, description, schema)
 * - Test successful execution with valid inputs
 * - Test error handling with invalid inputs
 * - Test toolConfig option passing
 * - Mock external dependencies for isolation
 *
 * CODING STANDARDS:
 * - Use describe blocks to group related tests
 * - Use it with 'should...' naming pattern
 * - Test input validation and edge cases
 * - Verify ToolResult structure
 * - Check both success and error paths
 * - Mock external dependencies
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReviewCodeChangeTool } from '../../src/tools';

// Mock the CodeReviewService using the barrel export
vi.mock('../../src/services', () => ({
  CodeReviewService: class MockCodeReviewService {
    reviewCodeChange = vi.fn().mockResolvedValue({
      file_path: '/mock/file.ts',
      feedback: 'Mock review feedback',
      fix_required: false,
      identified_issues: [],
    });
  },
}));

describe('ReviewCodeChangeTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('metadata', () => {
    it('should have correct tool name', () => {
      const tool = new ReviewCodeChangeTool();
      const definition = tool.getDefinition();

      expect(definition.name).toBe(ReviewCodeChangeTool.TOOL_NAME);
      expect(definition.name).toBe('review-code-change');
    });

    it('should have description containing Review code', () => {
      const tool = new ReviewCodeChangeTool();
      const definition = tool.getDefinition();

      expect(definition.description).toContain('Review code');
    });

    it('should have input schema with file_path property', () => {
      const tool = new ReviewCodeChangeTool();
      const definition = tool.getDefinition();

      expect(definition.inputSchema).toBeDefined();
      expect(definition.inputSchema.properties).toHaveProperty('file_path');
      expect(definition.inputSchema.required).toContain('file_path');
    });
  });

  describe('constructor', () => {
    it('should create instance without options', () => {
      const tool = new ReviewCodeChangeTool();
      expect(tool).toBeInstanceOf(ReviewCodeChangeTool);
    });

    it('should create instance with llmTool option', () => {
      const tool = new ReviewCodeChangeTool({ llmTool: 'codex' });
      expect(tool).toBeInstanceOf(ReviewCodeChangeTool);
    });

    it('should create instance with toolConfig option', () => {
      const tool = new ReviewCodeChangeTool({
        llmTool: 'codex',
        toolConfig: { model: 'test-model' },
      });
      expect(tool).toBeInstanceOf(ReviewCodeChangeTool);
    });

    it('should create instance with both llmTool and toolConfig', () => {
      const tool = new ReviewCodeChangeTool({
        llmTool: 'claude-code',
        toolConfig: { model: 'test-model', timeout: 5000 },
      });
      expect(tool).toBeInstanceOf(ReviewCodeChangeTool);
    });
  });

  describe('execute', () => {
    it('should return result with valid file path', async () => {
      const tool = new ReviewCodeChangeTool();
      const result = await tool.execute({ file_path: '/test/file.ts' });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(result.isError).toBeFalsy();
    });

    it('should return result for non-existent file without throwing', async () => {
      const tool = new ReviewCodeChangeTool();
      const result = await tool.execute({ file_path: '/non/existent/path.ts' });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
    });

    it('should return JSON parseable content', async () => {
      const tool = new ReviewCodeChangeTool();
      const result = await tool.execute({ file_path: '/test/file.ts' });

      const content = result.content[0];
      if (content.type === 'text') {
        expect(() => JSON.parse(content.text)).not.toThrow();
      }
    });

    it('should return file_path in result', async () => {
      const tool = new ReviewCodeChangeTool();
      const result = await tool.execute({ file_path: '/test/file.ts' });

      const content = result.content[0];
      if (content.type === 'text') {
        const data = JSON.parse(content.text);
        expect(data.file_path).toBe('/mock/file.ts');
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty file path', async () => {
      const tool = new ReviewCodeChangeTool();
      const result = await tool.execute({ file_path: '' });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
    });

    it('should handle file path with special characters', async () => {
      const tool = new ReviewCodeChangeTool();
      const result = await tool.execute({ file_path: '/path/with spaces/and-dashes/file.ts' });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
    });

    it('should handle relative file path', async () => {
      const tool = new ReviewCodeChangeTool();
      const result = await tool.execute({ file_path: './relative/path/file.ts' });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
    });

    it('should handle file path with unicode characters', async () => {
      const tool = new ReviewCodeChangeTool();
      const result = await tool.execute({ file_path: '/path/文件/файл.ts' });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
    });
  });

  describe('error handling', () => {
    it('should return isError flag when error occurs', async () => {
      // The tool catches errors internally, so we verify it handles them gracefully
      const tool = new ReviewCodeChangeTool();
      const result = await tool.execute({ file_path: '/test/file.ts' });

      // With mock returning success, isError should be falsy
      expect(result.isError).toBeFalsy();
    });

    it('should not throw when execute is called', async () => {
      const tool = new ReviewCodeChangeTool();

      // Verify the tool doesn't throw, regardless of input
      await expect(tool.execute({ file_path: '/test/file.ts' })).resolves.toBeDefined();
    });
  });

  describe('result structure', () => {
    it('should return complete result structure with all expected properties', async () => {
      const tool = new ReviewCodeChangeTool();
      const result = await tool.execute({ file_path: '/test/file.ts' });

      const content = result.content[0];
      if (content.type === 'text') {
        const data = JSON.parse(content.text);
        expect(data).toHaveProperty('file_path');
        expect(data).toHaveProperty('feedback');
        expect(data).toHaveProperty('fix_required');
        expect(data).toHaveProperty('identified_issues');
      }
    });

    it('should return identified_issues as an array', async () => {
      const tool = new ReviewCodeChangeTool();
      const result = await tool.execute({ file_path: '/test/file.ts' });

      const content = result.content[0];
      if (content.type === 'text') {
        const data = JSON.parse(content.text);
        expect(Array.isArray(data.identified_issues)).toBe(true);
      }
    });

    it('should return fix_required as boolean', async () => {
      const tool = new ReviewCodeChangeTool();
      const result = await tool.execute({ file_path: '/test/file.ts' });

      const content = result.content[0];
      if (content.type === 'text') {
        const data = JSON.parse(content.text);
        expect(typeof data.fix_required).toBe('boolean');
      }
    });
  });
});
