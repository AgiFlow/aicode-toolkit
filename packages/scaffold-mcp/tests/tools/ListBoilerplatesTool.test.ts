import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListBoilerplatesTool } from '../../src/tools/ListBoilerplatesTool';

// Mock the service
vi.mock('../../src/services/BoilerplateService');

describe('ListBoilerplatesTool', () => {
  let tool: ListBoilerplatesTool;
  const templatesPath = '/test/templates';

  beforeEach(() => {
    vi.clearAllMocks();
    tool = new ListBoilerplatesTool(templatesPath);
  });

  describe('getDefinition', () => {
    it('should return tool definition with correct schema', () => {
      const definition = tool.getDefinition();

      expect(definition.name).toBe('list-boilerplates');
      expect(definition.description).toBeTruthy();
      expect(definition.description).toContain('Lists all available project boilerplates');
      expect(definition.inputSchema.type).toBe('object');
    });

    it('should have cursor as optional property', () => {
      const definition = tool.getDefinition();

      expect(definition.inputSchema.required).toBeUndefined();
      expect(Object.keys(definition.inputSchema.properties || {})).toHaveLength(1);
      expect(definition.inputSchema.properties).toHaveProperty('cursor');
    });
  });

  describe('execute', () => {
    it('should list boilerplates successfully', async () => {
      const mockBoilerplates = {
        boilerplates: [
          {
            name: 'scaffold-nextjs-app',
            description: 'Next.js application template',
            variables_schema: {
              type: 'object',
              properties: {
                appName: { type: 'string', description: 'App name' },
              },
              required: ['appName'],
            },
            template_path: 'nextjs-15',
            target_folder: 'apps',
          },
          {
            name: 'scaffold-vite-app',
            description: 'Vite application template',
            variables_schema: {
              type: 'object',
              properties: {
                appName: { type: 'string', description: 'App name' },
              },
              required: ['appName'],
            },
            template_path: 'vite-react',
            target_folder: 'apps',
          },
        ],
      };

      const spy = vi.spyOn(tool.boilerplateService, 'listBoilerplates');
      spy.mockResolvedValue(mockBoilerplates);

      const result = await tool.execute({});

      expect(result.isError).toBeFalsy();
      expect(result.content[0].type).toBe('text');

      const response = JSON.parse(result.content[0].text);
      expect(response.boilerplates).toHaveLength(2);
      expect(response.boilerplates[0].name).toBe('scaffold-nextjs-app');
      expect(spy).toHaveBeenCalled();
    });

    it('should handle empty boilerplates list', async () => {
      const mockBoilerplates = {
        boilerplates: [],
      };

      const spy = vi.spyOn(tool.boilerplateService, 'listBoilerplates');
      spy.mockResolvedValue(mockBoilerplates);

      const result = await tool.execute();

      expect(result.isError).toBeFalsy();
      const response = JSON.parse(result.content[0].text);
      expect(response.boilerplates).toHaveLength(0);
    });

    it('should handle service errors gracefully', async () => {
      const spy = vi.spyOn(tool.boilerplateService, 'listBoilerplates');
      spy.mockRejectedValue(new Error('Failed to read templates directory'));

      const result = await tool.execute();

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Failed to read templates directory');
    });
  });
});
