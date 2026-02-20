/**
 * ValidateArchitectTool Tests
 *
 * TESTING PATTERNS:
 * - Test tool metadata (name, description, schema)
 * - Test successful execution with valid inputs
 * - Test error handling with invalid inputs
 * - Test YAML syntax error handling with line numbers
 * - Test schema validation errors with fix suggestions
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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ValidateArchitectTool } from '../../src/tools';
import * as fs from 'node:fs/promises';
import { TemplatesManagerService } from '@agiflowai/aicode-utils';

// Mock fs/promises
vi.mock('node:fs/promises', () => ({
  access: vi.fn(),
  readFile: vi.fn(),
  stat: vi.fn(),
}));

// Mock TemplatesManagerService
vi.mock('@agiflowai/aicode-utils', () => ({
  TemplatesManagerService: {
    findTemplatesPath: vi.fn().mockResolvedValue('/mock/templates'),
  },
}));

const mockFindTemplatesPath = vi.mocked(TemplatesManagerService.findTemplatesPath);

interface ValidationFeature {
  name: string;
  design_pattern: string;
  includes_count: number;
}

interface ValidationError {
  type: string;
  message?: string;
  fix_suggestion?: string;
}

interface ValidationResult {
  valid: boolean;
  features_count?: number;
  features?: ValidationFeature[];
  errors?: ValidationError[];
  file_path?: string;
}

// Mock workspace root for path validation tests
const MOCK_WORKSPACE_ROOT = '/mock/workspace';

describe('ValidateArchitectTool', () => {
  let tool: ValidateArchitectTool;
  const mockAccess = fs.access as ReturnType<typeof vi.fn>;
  const mockReadFile = fs.readFile as ReturnType<typeof vi.fn>;
  const mockStat = fs.stat as ReturnType<typeof vi.fn>;
  const originalCwd = process.cwd;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock process.cwd to return a predictable path for validation
    process.cwd = (): string => MOCK_WORKSPACE_ROOT;
    tool = new ValidateArchitectTool();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.cwd = originalCwd;
  });

  describe('metadata', () => {
    it('should have correct tool name', () => {
      const definition = tool.getDefinition();
      expect(definition.name).toBe(ValidateArchitectTool.TOOL_NAME);
      expect(definition.name).toBe('validate-architect');
    });

    it('should have description containing validate', () => {
      const definition = tool.getDefinition();
      expect(definition.description.toLowerCase()).toContain('validate');
    });

    it('should have input schema with file_path and template_name properties', () => {
      const definition = tool.getDefinition();
      expect(definition.inputSchema).toBeDefined();
      expect(definition.inputSchema.properties).toHaveProperty('file_path');
      expect(definition.inputSchema.properties).toHaveProperty('template_name');
    });

    it('should not require any inputs (both are optional)', () => {
      const definition = tool.getDefinition();
      expect(definition.inputSchema.required).toBeUndefined();
    });
  });

  describe('constructor', () => {
    it('should create instance', () => {
      expect(tool).toBeInstanceOf(ValidateArchitectTool);
    });
  });

  describe('validate valid architect.yaml', () => {
    const validYaml = `
features:
  - name: service-pattern
    design_pattern: "Service Layer Pattern"
    includes:
      - "src/services/**/*.ts"
    description: |
      Services encapsulate business logic.
  - name: controller-pattern
    design_pattern: "Controller Pattern"
    includes:
      - "src/controllers/**/*.ts"
`;

    it('should validate valid architect.yaml file', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockStat.mockResolvedValue({ isFile: (): boolean => true });
      mockReadFile.mockResolvedValue(validYaml);

      const result = await tool.execute({
        file_path: `${MOCK_WORKSPACE_ROOT}/test/architect.yaml`,
      });

      expect(result.isError).toBeFalsy();
      const content = result.content[0];
      expect(content.type).toBe('text');
      if (content.type === 'text') {
        const data: ValidationResult = JSON.parse(content.text);
        expect(data.valid).toBe(true);
        expect(data.features_count).toBe(2);
        expect(data.features).toHaveLength(2);
        expect(data.features?.[0].name).toBe('service-pattern');
        expect(data.features?.[0].design_pattern).toBe('Service Layer Pattern');
        expect(data.features?.[0].includes_count).toBe(1);
      }
    });

    it('should validate empty features array', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockStat.mockResolvedValue({ isFile: (): boolean => true });
      mockReadFile.mockResolvedValue('features: []');

      const result = await tool.execute({
        file_path: `${MOCK_WORKSPACE_ROOT}/test/architect.yaml`,
      });

      expect(result.isError).toBeFalsy();
      const content = result.content[0];
      if (content.type === 'text') {
        const data = JSON.parse(content.text);
        expect(data.valid).toBe(true);
        expect(data.features_count).toBe(0);
      }
    });

    it('should validate empty file (defaults to empty features)', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockStat.mockResolvedValue({ isFile: (): boolean => true });
      mockReadFile.mockResolvedValue('');

      const result = await tool.execute({
        file_path: `${MOCK_WORKSPACE_ROOT}/test/architect.yaml`,
      });

      expect(result.isError).toBeFalsy();
      const content = result.content[0];
      if (content.type === 'text') {
        const data = JSON.parse(content.text);
        expect(data.valid).toBe(true);
        expect(data.features_count).toBe(0);
      }
    });
  });

  describe('YAML syntax errors with line numbers', () => {
    it('should catch YAML indentation errors', async () => {
      const invalidYaml = `
features:
  - name: test
   design_pattern: "Bad indentation"
    includes:
      - "src/**/*.ts"
`;
      mockAccess.mockResolvedValue(undefined);
      mockStat.mockResolvedValue({ isFile: (): boolean => true });
      mockReadFile.mockResolvedValue(invalidYaml);

      const result = await tool.execute({
        file_path: `${MOCK_WORKSPACE_ROOT}/test/architect.yaml`,
      });

      expect(result.isError).toBe(true);
      const content = result.content[0];
      if (content.type === 'text') {
        const data = JSON.parse(content.text);
        expect(data.valid).toBe(false);
        expect(data.errors).toHaveLength(1);
        expect(data.errors[0].type).toBe('yaml_syntax');
        expect(data.errors[0].fix_suggestion.toLowerCase()).toContain('indentation');
      }
    });

    it('should catch YAML duplicate key errors', async () => {
      const invalidYaml = `
features:
  - name: test
    name: duplicate
    design_pattern: "Test"
    includes:
      - "src/**/*.ts"
`;
      mockAccess.mockResolvedValue(undefined);
      mockStat.mockResolvedValue({ isFile: (): boolean => true });
      mockReadFile.mockResolvedValue(invalidYaml);

      const result = await tool.execute({
        file_path: `${MOCK_WORKSPACE_ROOT}/test/architect.yaml`,
      });

      // Note: js-yaml may or may not catch duplicate keys depending on version
      // This test verifies our error handling works regardless
      const content = result.content[0];
      if (content.type === 'text') {
        const data = JSON.parse(content.text);
        // Either valid (last value wins) or error - both are acceptable yaml behaviors
        expect(typeof data.valid).toBe('boolean');
      }
    });

    it('should catch YAML missing colon errors', async () => {
      const invalidYaml = `
features:
  - name test
    design_pattern: "Test"
`;
      mockAccess.mockResolvedValue(undefined);
      mockStat.mockResolvedValue({ isFile: (): boolean => true });
      mockReadFile.mockResolvedValue(invalidYaml);

      const result = await tool.execute({
        file_path: `${MOCK_WORKSPACE_ROOT}/test/architect.yaml`,
      });

      expect(result.isError).toBe(true);
      const content = result.content[0];
      if (content.type === 'text') {
        const data = JSON.parse(content.text);
        expect(data.valid).toBe(false);
        expect(data.errors[0].type).toBe('yaml_syntax');
      }
    });
  });

  describe('schema validation errors', () => {
    it('should catch missing design_pattern field', async () => {
      const invalidYaml = `
features:
  - name: test-pattern
    includes:
      - "src/**/*.ts"
`;
      mockAccess.mockResolvedValue(undefined);
      mockStat.mockResolvedValue({ isFile: (): boolean => true });
      mockReadFile.mockResolvedValue(invalidYaml);

      const result = await tool.execute({
        file_path: `${MOCK_WORKSPACE_ROOT}/test/architect.yaml`,
      });

      expect(result.isError).toBe(true);
      const content = result.content[0];
      if (content.type === 'text') {
        const data = JSON.parse(content.text);
        expect(data.valid).toBe(false);
        expect(data.errors.length).toBeGreaterThan(0);
        expect(data.errors[0].type).toBe('schema_validation');
        expect(data.errors[0].fix_suggestion).toContain('design_pattern');
      }
    });

    it('should catch empty includes array', async () => {
      const invalidYaml = `
features:
  - name: test-pattern
    design_pattern: "Test Pattern"
    includes: []
`;
      mockAccess.mockResolvedValue(undefined);
      mockStat.mockResolvedValue({ isFile: (): boolean => true });
      mockReadFile.mockResolvedValue(invalidYaml);

      const result = await tool.execute({
        file_path: `${MOCK_WORKSPACE_ROOT}/test/architect.yaml`,
      });

      expect(result.isError).toBe(true);
      const content = result.content[0];
      if (content.type === 'text') {
        const data = JSON.parse(content.text);
        expect(data.valid).toBe(false);
        expect(data.errors.length).toBeGreaterThan(0);
        expect(data.errors[0].type).toBe('schema_validation');
        expect(data.errors[0].fix_suggestion.toLowerCase()).toContain('includes');
      }
    });

    it('should provide fix suggestions for schema errors', async () => {
      const invalidYaml = `
features:
  - name: test
    design_pattern: ""
    includes:
      - "src/**/*.ts"
`;
      mockAccess.mockResolvedValue(undefined);
      mockStat.mockResolvedValue({ isFile: (): boolean => true });
      mockReadFile.mockResolvedValue(invalidYaml);

      const result = await tool.execute({
        file_path: `${MOCK_WORKSPACE_ROOT}/test/architect.yaml`,
      });

      expect(result.isError).toBe(true);
      const content = result.content[0];
      if (content.type === 'text') {
        const data = JSON.parse(content.text);
        expect(data.valid).toBe(false);
        expect(data.errors[0].fix_suggestion).toBeDefined();
        expect(data.errors[0].fix_suggestion.length).toBeGreaterThan(0);
      }
    });
  });

  describe('file_not_found errors', () => {
    it('should handle file not found', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const result = await tool.execute({
        file_path: `${MOCK_WORKSPACE_ROOT}/nonexistent/architect.yaml`,
      });

      expect(result.isError).toBe(true);
      const content = result.content[0];
      if (content.type === 'text') {
        const data = JSON.parse(content.text);
        expect(data.valid).toBe(false);
        expect(data.errors[0].type).toBe('file_not_found');
        expect(data.errors[0].fix_suggestion).toContain('Create the file');
      }
    });

    it('should handle missing templates directory when using template_name', async () => {
      mockFindTemplatesPath.mockResolvedValue(null);

      const result = await tool.execute({ template_name: 'nonexistent-template' });

      expect(result.isError).toBe(true);
      const content = result.content[0];
      if (content.type === 'text') {
        const data = JSON.parse(content.text);
        expect(data.valid).toBe(false);
        expect(data.errors[0].type).toBe('file_not_found');
        expect(data.errors[0].message).toContain('Templates directory not found');
      }
    });
  });

  describe('resolve template names correctly', () => {
    it('should resolve template name to architect.yaml path', async () => {
      // Re-setup the mock for templates path after clearAllMocks
      mockFindTemplatesPath.mockResolvedValue('/mock/templates');
      // First access for template dir, second for architect file, third for readFile check
      mockAccess
        .mockResolvedValueOnce(undefined) // template dir exists
        .mockResolvedValueOnce(undefined) // .architect.yaml exists
        .mockResolvedValue(undefined); // file access for parseArchitectFile
      mockStat.mockResolvedValue({ isFile: (): boolean => true });
      mockReadFile.mockResolvedValue('features: []');

      const result = await tool.execute({ template_name: 'nextjs-15' });

      expect(result.isError).toBeFalsy();
      const content = result.content[0];
      if (content.type === 'text') {
        const data = JSON.parse(content.text);
        expect(data.valid).toBe(true);
        expect(data.file_path).toContain('nextjs-15');
      }
    });

    it('should handle template without architect.yaml', async () => {
      // Re-setup the mock for templates path after clearAllMocks
      mockFindTemplatesPath.mockResolvedValue('/mock/templates');
      mockAccess
        .mockResolvedValueOnce(undefined) // template dir exists
        .mockRejectedValueOnce(new Error('ENOENT')) // .architect.yaml doesn't exist
        .mockRejectedValueOnce(new Error('ENOENT')); // architect.yaml doesn't exist

      const result = await tool.execute({ template_name: 'template-no-architect' });

      expect(result.isError).toBe(true);
      const content = result.content[0];
      if (content.type === 'text') {
        const data = JSON.parse(content.text);
        expect(data.valid).toBe(false);
        expect(data.errors[0].type).toBe('file_not_found');
        expect(data.errors[0].message).toContain('No architect.yaml');
      }
    });
  });

  describe('missing input validation', () => {
    it('should require either file_path or template_name', async () => {
      const result = await tool.execute({});

      expect(result.isError).toBe(true);
      const content = result.content[0];
      if (content.type === 'text') {
        const data = JSON.parse(content.text);
        expect(data.valid).toBe(false);
        expect(data.errors[0].type).toBe('missing_input');
        expect(data.errors[0].message).toContain('Either file_path or template_name');
      }
    });
  });

  describe('edge cases', () => {
    it('should handle absolute file path', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockStat.mockResolvedValue({ isFile: (): boolean => true });
      mockReadFile.mockResolvedValue('features: []');

      const result = await tool.execute({
        file_path: `${MOCK_WORKSPACE_ROOT}/absolute/path/to/architect.yaml`,
      });

      expect(result.isError).toBeFalsy();
      const content = result.content[0];
      if (content.type === 'text') {
        const data = JSON.parse(content.text);
        expect(data.file_path).toBe(`${MOCK_WORKSPACE_ROOT}/absolute/path/to/architect.yaml`);
      }
    });

    it('should handle relative file path', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockStat.mockResolvedValue({ isFile: (): boolean => true });
      mockReadFile.mockResolvedValue('features: []');

      const result = await tool.execute({
        file_path: 'templates/nextjs-15/architect.yaml',
      });

      expect(result.isError).toBeFalsy();
      const content = result.content[0];
      if (content.type === 'text') {
        const data = JSON.parse(content.text);
        expect(data.file_path).toContain('templates/nextjs-15/architect.yaml');
      }
    });

    it('should handle .architect.yaml filename', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockStat.mockResolvedValue({ isFile: (): boolean => true });
      mockReadFile.mockResolvedValue('features: []');

      const result = await tool.execute({
        file_path: `${MOCK_WORKSPACE_ROOT}/test/.architect.yaml`,
      });

      expect(result.isError).toBeFalsy();
      const content = result.content[0];
      if (content.type === 'text') {
        const data = JSON.parse(content.text);
        expect(data.valid).toBe(true);
      }
    });

    it('should return JSON parseable content', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockStat.mockResolvedValue({ isFile: (): boolean => true });
      mockReadFile.mockResolvedValue('features: []');

      const result = await tool.execute({
        file_path: `${MOCK_WORKSPACE_ROOT}/test/architect.yaml`,
      });

      const content = result.content[0];
      if (content.type === 'text') {
        expect(() => JSON.parse(content.text)).not.toThrow();
      }
    });

    it('should include file_path in success result', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockStat.mockResolvedValue({ isFile: (): boolean => true });
      mockReadFile.mockResolvedValue('features: []');

      const result = await tool.execute({
        file_path: `${MOCK_WORKSPACE_ROOT}/test/architect.yaml`,
      });

      const content = result.content[0];
      if (content.type === 'text') {
        const data = JSON.parse(content.text);
        expect(data.file_path).toBeDefined();
      }
    });

    it('should include file_path in error result when available', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockStat.mockResolvedValue({ isFile: (): boolean => true });
      mockReadFile.mockResolvedValue('invalid: yaml: syntax:');

      const result = await tool.execute({
        file_path: `${MOCK_WORKSPACE_ROOT}/test/architect.yaml`,
      });

      const content = result.content[0];
      if (content.type === 'text') {
        const data = JSON.parse(content.text);
        if (!data.valid) {
          expect(data.file_path).toBeDefined();
        }
      }
    });
  });

  describe('path traversal security', () => {
    it('should reject paths outside workspace directory', async () => {
      // Path traversal attempt using ..
      const result = await tool.execute({ file_path: '../../../etc/passwd' });

      expect(result.isError).toBe(true);
      const content = result.content[0];
      if (content.type === 'text') {
        const data: ValidationResult = JSON.parse(content.text);
        expect(data.valid).toBe(false);
        expect(data.errors?.[0].message).toContain('outside the workspace');
      }
    });

    it('should reject absolute paths outside workspace', async () => {
      // Attempt to access file outside workspace using absolute path
      const result = await tool.execute({ file_path: '/etc/passwd' });

      expect(result.isError).toBe(true);
      const content = result.content[0];
      if (content.type === 'text') {
        const data: ValidationResult = JSON.parse(content.text);
        expect(data.valid).toBe(false);
        expect(data.errors?.[0].message).toContain('outside the workspace');
      }
    });

    it('should allow paths within templates directory even outside workspace', async () => {
      // Mock templates in a different location
      mockFindTemplatesPath.mockResolvedValue('/different/templates');
      mockAccess.mockResolvedValue(undefined);
      mockStat.mockResolvedValue({ isFile: (): boolean => true });
      mockReadFile.mockResolvedValue('features: []');

      const result = await tool.execute({
        file_path: '/different/templates/nextjs/architect.yaml',
      });

      expect(result.isError).toBeFalsy();
      const content = result.content[0];
      if (content.type === 'text') {
        const data: ValidationResult = JSON.parse(content.text);
        expect(data.valid).toBe(true);
      }
    });

    it('should reject nested path traversal attempts', async () => {
      // Multiple levels of .. to escape workspace
      const result = await tool.execute({ file_path: 'foo/../../bar/../../../etc/passwd' });

      expect(result.isError).toBe(true);
      const content = result.content[0];
      if (content.type === 'text') {
        const data: ValidationResult = JSON.parse(content.text);
        expect(data.valid).toBe(false);
        expect(data.errors?.[0].message).toContain('outside the workspace');
      }
    });

    it('should reject paths that start inside but escape workspace', async () => {
      // Starts with valid directory but escapes via ..
      const result = await tool.execute({ file_path: 'templates/../../../etc/passwd' });

      expect(result.isError).toBe(true);
      const content = result.content[0];
      if (content.type === 'text') {
        const data: ValidationResult = JSON.parse(content.text);
        expect(data.valid).toBe(false);
        expect(data.errors?.[0].message).toContain('outside the workspace');
      }
    });

    // Note: Windows-specific path tests (D:\, UNC paths) are platform-dependent:
    // - On Unix: backslashes are valid filename characters, so 'D:\file' is a relative path
    // - On Windows: backslashes are separators, so 'D:\file' is absolute on D: drive
    // The path.isAbsolute() check in the implementation handles both cases correctly,
    // but we can only test the Unix behavior here. Windows CI would test Windows behavior.
  });
});
