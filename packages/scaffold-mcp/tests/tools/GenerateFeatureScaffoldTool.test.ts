import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GenerateFeatureScaffoldTool } from '../../src/tools/GenerateFeatureScaffoldTool';
import { getText } from '../helpers/getText';
import type { ScaffoldGeneratorService } from '../../src/services/ScaffoldGeneratorService';

vi.mock('../../src/services/ScaffoldGeneratorService');

/** Exposes the tool's private service so tests can spy on it. */
function internals(tool: GenerateFeatureScaffoldTool): {
  scaffoldGeneratorService: ScaffoldGeneratorService;
} {
  return tool as unknown as { scaffoldGeneratorService: ScaffoldGeneratorService };
}

describe('GenerateFeatureScaffoldTool', () => {
  let tool: GenerateFeatureScaffoldTool;
  const templatesPath = '/test/templates';

  beforeEach(() => {
    tool = new GenerateFeatureScaffoldTool(templatesPath);
    vi.clearAllMocks();
  });

  describe('getDefinition', () => {
    it('should return tool definition with correct schema', () => {
      const definition = tool.getDefinition();

      expect(definition.name).toBe('generate-feature-scaffold');
      expect(definition.description).toBeTruthy();
      expect(definition.inputSchema.type).toBe('object');
      expect(definition.inputSchema.required).toContain('templateName');
      expect(definition.inputSchema.required).toContain('featureName');
      expect(definition.inputSchema.required).toContain('description');
      expect(definition.inputSchema.required).toContain('variables');
    });

    it('should not require generator field', () => {
      const definition = tool.getDefinition();

      expect(definition.inputSchema.required).not.toContain('generator');
    });

    it('should include includes and patterns as optional', () => {
      const definition = tool.getDefinition();

      expect(definition.inputSchema.properties.includes).toBeDefined();
      expect(definition.inputSchema.properties.patterns).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should execute successfully with valid arguments', async () => {
      const args = {
        templateName: 'nextjs-15',
        featureName: 'scaffold-nextjs-page',
        description: 'Generate Next.js pages',
        variables: [
          {
            name: 'pageName',
            description: 'Page name',
            type: 'string',
            required: true,
          },
        ],
      };

      const spy = vi.spyOn(internals(tool).scaffoldGeneratorService, 'generateFeatureScaffold');
      spy.mockResolvedValue({
        success: true,
        message: 'Feature created',
        templatePath: '/test/templates/nextjs-15',
        scaffoldYamlPath: '/test/templates/nextjs-15/scaffold.yaml',
      });

      const result = await tool.execute(args);

      expect(result.isError).toBeFalsy();
      expect(result.content[0].type).toBe('text');
      const response = JSON.parse(getText(result.content[0]));
      expect(response.success).toBe(true);
    });

    it('should handle optional fields', async () => {
      const args = {
        templateName: 'nextjs-15',
        featureName: 'scaffold-test',
        description: 'Test feature',
        instruction: 'Instructions here',
        variables: [],
        includes: ['src/page.tsx'],
        patterns: ['src/**/*.tsx'],
      };

      const spy = vi.spyOn(internals(tool).scaffoldGeneratorService, 'generateFeatureScaffold');
      spy.mockResolvedValue({
        success: true,
        message: 'Feature created',
      });

      const result = await tool.execute(args);

      expect(result.isError).toBeFalsy();
    });

    it('should return error when service fails', async () => {
      const args = {
        templateName: 'nextjs-15',
        featureName: 'existing-feature',
        description: 'Test',
        variables: [],
      };

      const spy = vi.spyOn(internals(tool).scaffoldGeneratorService, 'generateFeatureScaffold');
      spy.mockResolvedValue({
        success: false,
        message: 'Feature already exists',
      });

      const result = await tool.execute(args);

      expect(result.isError).toBeTruthy();
    });
  });
});
