import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GenerateBoilerplateTool } from '../../src/tools/GenerateBoilerplateTool';
import { getText } from '../helpers/getText';
import type { BoilerplateGeneratorService } from '../../src/services/BoilerplateGeneratorService';

// Mock the service
vi.mock('../../src/services/BoilerplateGeneratorService');

/** Exposes the tool's private service so tests can spy on it. */
function internals(tool: GenerateBoilerplateTool): {
  boilerplateGeneratorService: BoilerplateGeneratorService;
} {
  return tool as unknown as { boilerplateGeneratorService: BoilerplateGeneratorService };
}

describe('GenerateBoilerplateTool', () => {
  let tool: GenerateBoilerplateTool;
  const templatesPath = '/test/templates';

  beforeEach(() => {
    vi.clearAllMocks();
    tool = new GenerateBoilerplateTool(templatesPath);
  });

  describe('getDefinition', () => {
    it('should return tool definition with correct schema', () => {
      const definition = tool.getDefinition();

      expect(definition.name).toBe('generate-boilerplate');
      expect(definition.description).toBeTruthy();
      expect(definition.inputSchema.type).toBe('object');
      expect(definition.inputSchema.required).toContain('templateName');
      expect(definition.inputSchema.required).toContain('boilerplateName');
      expect(definition.inputSchema.required).toContain('description');
    });

    it('should include variables in schema', () => {
      const definition = tool.getDefinition();

      expect(definition.inputSchema.properties.variables).toBeDefined();
      expect(definition.inputSchema.properties.variables.type).toBe('array');
    });
  });

  describe('execute', () => {
    it('should execute successfully with valid arguments', async () => {
      const args = {
        templateName: 'test-template',
        boilerplateName: 'scaffold-test-app',
        description: 'Test description',
        targetFolder: 'apps',
        variables: [
          {
            name: 'appName',
            description: 'App name',
            type: 'string',
            required: true,
          },
        ],
      };

      const spy = vi.spyOn(internals(tool).boilerplateGeneratorService, 'generateBoilerplate');
      spy.mockResolvedValue({
        success: true,
        message: 'Boilerplate created',
        templatePath: '/test/templates/test-template',
        scaffoldYamlPath: '/test/templates/test-template/scaffold.yaml',
      });

      const result = await tool.execute(args);

      expect(result.isError).toBeFalsy();
      expect(result.content[0].type).toBe('text');
      const response = JSON.parse(getText(result.content[0]));
      expect(response.success).toBe(true);
    });

    it('should return error when service fails', async () => {
      const args = {
        templateName: 'test-template',
        boilerplateName: 'scaffold-test-app',
        description: 'Test',
        targetFolder: 'apps',
        variables: [],
      };

      const spy = vi.spyOn(internals(tool).boilerplateGeneratorService, 'generateBoilerplate');
      spy.mockResolvedValue({
        success: false,
        message: 'Boilerplate already exists',
      });

      const result = await tool.execute(args);

      expect(result.isError).toBeTruthy();
      expect(getText(result.content[0])).toContain('already exists');
    });

    it('should handle exceptions gracefully', async () => {
      const args = {
        templateName: 'test-template',
        boilerplateName: 'scaffold-test-app',
        description: 'Test',
        targetFolder: 'apps',
        variables: [],
      };

      const spy = vi.spyOn(internals(tool).boilerplateGeneratorService, 'generateBoilerplate');
      spy.mockRejectedValue(new Error('Unexpected error'));

      const result = await tool.execute(args);

      expect(result.isError).toBeTruthy();
      expect(getText(result.content[0])).toContain('Unexpected error');
    });
  });
});
