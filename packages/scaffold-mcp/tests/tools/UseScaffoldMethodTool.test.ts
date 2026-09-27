import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UseScaffoldMethodTool } from '../../src/tools/UseScaffoldMethodTool';
import { getText } from '../helpers/getText';
import type { ScaffoldingMethodsService } from '../../src/services/ScaffoldingMethodsService';

// Mock the services
vi.mock('../../src/services/FileSystemService');
vi.mock('../../src/services/ScaffoldingMethodsService');

/** Exposes the tool's private service so tests can spy on it. */
function internals(tool: UseScaffoldMethodTool): {
  scaffoldingMethodsService: ScaffoldingMethodsService;
} {
  return tool as unknown as { scaffoldingMethodsService: ScaffoldingMethodsService };
}

describe('UseScaffoldMethodTool', () => {
  let tool: UseScaffoldMethodTool;
  const templatesPath = '/test/templates';

  beforeEach(() => {
    vi.clearAllMocks();
    tool = new UseScaffoldMethodTool(templatesPath);
  });

  describe('getDefinition', () => {
    it('should return tool definition with correct schema', () => {
      const definition = tool.getDefinition();

      expect(definition.name).toBe('use-scaffold-method');
      expect(definition.description).toBeTruthy();
      expect(definition.inputSchema.type).toBe('object');
      expect(definition.inputSchema.required).toContain('projectPath');
      expect(definition.inputSchema.required).toContain('scaffold_feature_name');
      expect(definition.inputSchema.required).toContain('variables');
    });

    it('should include all required properties in schema', () => {
      const definition = tool.getDefinition();

      expect(definition.inputSchema.properties.projectPath).toBeDefined();
      expect(definition.inputSchema.properties.scaffold_feature_name).toBeDefined();
      expect(definition.inputSchema.properties.variables).toBeDefined();
      expect(definition.inputSchema.properties.variables.type).toBe('object');
    });
  });

  describe('execute', () => {
    it('should execute successfully with valid arguments', async () => {
      const args = {
        projectPath: '/test/apps/my-app',
        scaffold_feature_name: 'scaffold-route',
        variables: {
          routePath: 'about',
          pageTitle: 'About Us',
        },
      };

      const spy = vi.spyOn(internals(tool).scaffoldingMethodsService, 'useScaffoldMethod');
      spy.mockResolvedValue({
        success: true,
        message: 'Successfully scaffolded scaffold-route in /test/apps/my-app',
      });

      const result = await tool.execute(args);

      expect(result.isError).toBeFalsy();
      expect(result.content[0].type).toBe('text');
      expect(getText(result.content[0])).toContain('Successfully scaffolded');
      expect(spy).toHaveBeenCalledWith({
        projectPath: '/test/apps/my-app',
        scaffold_feature_name: 'scaffold-route',
        variables: { routePath: 'about', pageTitle: 'About Us' },
      });
    });

    it('should handle service errors gracefully', async () => {
      const args = {
        projectPath: '/test/apps/my-app',
        scaffold_feature_name: 'scaffold-route',
        variables: { routePath: 'about' },
      };

      const spy = vi.spyOn(internals(tool).scaffoldingMethodsService, 'useScaffoldMethod');
      spy.mockRejectedValue(new Error('Scaffold method not found'));

      const result = await tool.execute(args);

      expect(result.isError).toBe(true);
      expect(getText(result.content[0])).toContain('Scaffold method not found');
    });
  });
});
