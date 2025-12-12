/**
 * GetFileDesignPatternTool Tests
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
import { GetFileDesignPatternTool } from '../../src/tools';

// Mock the services used by GetFileDesignPatternTool
vi.mock('../../src/services/TemplateFinder', () => ({
  TemplateFinder: class MockTemplateFinder {
    findTemplateForFile = vi.fn().mockResolvedValue({
      templatePath: '/mock/template',
      projectPath: '/mock/project',
      projectName: 'mock-project',
      sourceTemplate: 'mock-template',
    });
  },
}));

vi.mock('../../src/services/ArchitectParser', () => ({
  ArchitectParser: class MockArchitectParser {
    parseArchitectFile = vi.fn().mockResolvedValue({ features: [] });
    parseGlobalArchitectFile = vi.fn().mockResolvedValue({ features: [] });
    parseProjectArchitectFile = vi.fn().mockResolvedValue({ features: [] });
    mergeConfigs = vi.fn().mockReturnValue({ features: [] });
  },
}));

vi.mock('../../src/services/PatternMatcher', () => ({
  PatternMatcher: class MockPatternMatcher {
    matchFileToPatterns = vi.fn().mockReturnValue({
      file_path: '/mock/file.ts',
      matched_patterns: [],
      recommendations: [],
    });
  },
}));

describe('GetFileDesignPatternTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('metadata', () => {
    it('should have correct tool name', () => {
      const tool = new GetFileDesignPatternTool();
      const definition = tool.getDefinition();

      expect(definition.name).toBe(GetFileDesignPatternTool.TOOL_NAME);
      expect(definition.name).toBe('get-file-design-pattern');
    });

    it('should have description containing design pattern', () => {
      const tool = new GetFileDesignPatternTool();
      const definition = tool.getDefinition();

      expect(definition.description).toContain('design pattern');
    });

    it('should have input schema with file_path property', () => {
      const tool = new GetFileDesignPatternTool();
      const definition = tool.getDefinition();

      expect(definition.inputSchema).toBeDefined();
      expect(definition.inputSchema.properties).toHaveProperty('file_path');
      expect(definition.inputSchema.required).toContain('file_path');
    });
  });

  describe('constructor', () => {
    it('should create instance without options', () => {
      const tool = new GetFileDesignPatternTool();
      expect(tool).toBeInstanceOf(GetFileDesignPatternTool);
    });

    it('should create instance with llmTool option', () => {
      const tool = new GetFileDesignPatternTool({ llmTool: 'codex' });
      expect(tool).toBeInstanceOf(GetFileDesignPatternTool);
    });

    it('should create instance with toolConfig option', () => {
      const tool = new GetFileDesignPatternTool({
        llmTool: 'codex',
        toolConfig: { model: 'test-model' },
      });
      expect(tool).toBeInstanceOf(GetFileDesignPatternTool);
    });

    it('should create instance with both llmTool and toolConfig', () => {
      const tool = new GetFileDesignPatternTool({
        llmTool: 'claude-code',
        toolConfig: { model: 'test-model', timeout: 5000 },
      });
      expect(tool).toBeInstanceOf(GetFileDesignPatternTool);
    });
  });

  describe('execute', () => {
    it('should return result with valid file path', async () => {
      const tool = new GetFileDesignPatternTool();
      const result = await tool.execute({ file_path: '/test/file.ts' });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(result.isError).toBeFalsy();
    });

    it('should return result for non-existent file without throwing', async () => {
      const tool = new GetFileDesignPatternTool();
      const result = await tool.execute({ file_path: '/non/existent/path.ts' });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
    });

    it('should return JSON parseable content', async () => {
      const tool = new GetFileDesignPatternTool();
      const result = await tool.execute({ file_path: '/test/file.ts' });

      const content = result.content[0];
      if (content.type === 'text') {
        expect(() => JSON.parse(content.text)).not.toThrow();
      }
    });

    it('should return file_path in result', async () => {
      const tool = new GetFileDesignPatternTool();
      const result = await tool.execute({ file_path: '/test/file.ts' });

      const content = result.content[0];
      if (content.type === 'text') {
        const data = JSON.parse(content.text);
        // file_path comes from PatternMatcher mock
        expect(data.file_path).toBe('/mock/file.ts');
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty file path', async () => {
      const tool = new GetFileDesignPatternTool();
      const result = await tool.execute({ file_path: '' });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
    });

    it('should handle file path with special characters', async () => {
      const tool = new GetFileDesignPatternTool();
      const result = await tool.execute({ file_path: '/path/with spaces/and-dashes/file.ts' });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
    });

    it('should handle relative file path', async () => {
      const tool = new GetFileDesignPatternTool();
      const result = await tool.execute({ file_path: './relative/path/file.ts' });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
    });

    it('should handle file path with unicode characters', async () => {
      const tool = new GetFileDesignPatternTool();
      const result = await tool.execute({ file_path: '/path/文件/файл.ts' });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
    });
  });
});
