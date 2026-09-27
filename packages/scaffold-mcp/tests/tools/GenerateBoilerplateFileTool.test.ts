import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GenerateBoilerplateFileTool } from '../../src/tools/GenerateBoilerplateFileTool';
import { getText } from '../helpers/getText';
import type { BoilerplateGeneratorService } from '../../src/services/BoilerplateGeneratorService';

/** Exposes the tool's private service so tests can spy on it. */
function internals(tool: GenerateBoilerplateFileTool): {
  boilerplateGeneratorService: BoilerplateGeneratorService;
} {
  return tool as unknown as { boilerplateGeneratorService: BoilerplateGeneratorService };
}

describe('GenerateBoilerplateFileTool', () => {
  let tool: GenerateBoilerplateFileTool;
  const templatesPath = '/test/templates';

  beforeEach(() => {
    vi.clearAllMocks();
    tool = new GenerateBoilerplateFileTool(templatesPath);
  });

  describe('getDefinition', () => {
    it('should return tool definition with correct schema', () => {
      const definition = tool.getDefinition();

      expect(definition.name).toBe('generate-boilerplate-file');
      expect(definition.description).toContain('template files');
      expect(definition.inputSchema.required).toContain('templateName');
      expect(definition.inputSchema.required).toContain('filePath');
    });

    it('should have optional content and sourceFile', () => {
      const definition = tool.getDefinition();

      expect(definition.inputSchema.required).not.toContain('content');
      expect(definition.inputSchema.required).not.toContain('sourceFile');
    });

    it('should include header parameter', () => {
      const definition = tool.getDefinition();

      expect(definition.inputSchema.properties.header).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should create template file with content', async () => {
      const args = {
        templateName: 'test-template',
        filePath: 'package.json',
        content: '{"name": "{{ appName }}"}',
      };

      // Spy on the service instance's method
      const spy = vi.spyOn(internals(tool).boilerplateGeneratorService, 'createTemplateFile');
      spy.mockResolvedValue({
        success: true,
        message: 'File created',
        filePath: 'package.json.liquid',
        fullPath: '/test/templates/test-template/package.json.liquid',
      });

      const result = await tool.execute(args);

      expect(result.isError).toBeFalsy();
      const response = JSON.parse(getText(result.content[0]));
      expect(response.success).toBe(true);
      expect(response.filePath).toBe('package.json.liquid');
    });

    it('should create template file from source', async () => {
      const args = {
        templateName: 'test-template',
        filePath: 'src/index.ts',
        sourceFile: '/path/to/source.ts',
      };

      const spy = vi.spyOn(internals(tool).boilerplateGeneratorService, 'createTemplateFile');
      spy.mockResolvedValue({
        success: true,
        message: 'File created',
        filePath: 'src/index.ts.liquid',
      });

      const result = await tool.execute(args);

      expect(result.isError).toBeFalsy();
      const response = JSON.parse(getText(result.content[0]));
      expect(response.sourceFile).toBe('/path/to/source.ts');
    });

    it('should include header in template file', async () => {
      const args = {
        templateName: 'test-template',
        filePath: 'Component.tsx',
        content: 'export default function() {}',
        header: '/**\n * Component Header\n */',
      };

      const spy = vi.spyOn(internals(tool).boilerplateGeneratorService, 'createTemplateFile');
      spy.mockResolvedValue({
        success: true,
        message: 'File created',
      });

      const result = await tool.execute(args);

      expect(result.isError).toBeFalsy();
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ header: args.header }));
    });

    it('should return error when service fails', async () => {
      const args = {
        templateName: 'nonexistent',
        filePath: 'test.ts',
        content: 'test',
      };

      const spy = vi.spyOn(internals(tool).boilerplateGeneratorService, 'createTemplateFile');
      spy.mockResolvedValue({
        success: false,
        message: 'Template directory does not exist',
      });

      const result = await tool.execute(args);

      expect(result.isError).toBeTruthy();
      expect(getText(result.content[0])).toContain('does not exist');
    });

    it('should handle exceptions', async () => {
      const args = {
        templateName: 'test-template',
        filePath: 'test.ts',
        content: 'test',
      };

      const spy = vi.spyOn(internals(tool).boilerplateGeneratorService, 'createTemplateFile');
      spy.mockRejectedValue(new Error('File system error'));

      const result = await tool.execute(args);

      expect(result.isError).toBeTruthy();
      expect(getText(result.content[0])).toContain('File system error');
    });
  });
});
