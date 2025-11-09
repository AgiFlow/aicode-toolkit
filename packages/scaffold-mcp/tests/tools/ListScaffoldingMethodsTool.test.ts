import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListScaffoldingMethodsTool } from '../../src/tools/ListScaffoldingMethodsTool';

// Mock the services
vi.mock('../../src/services/FileSystemService');
vi.mock('../../src/services/ScaffoldingMethodsService');

describe('ListScaffoldingMethodsTool', () => {
  let tool: ListScaffoldingMethodsTool;
  const templatesPath = '/test/templates';

  beforeEach(() => {
    vi.clearAllMocks();
    tool = new ListScaffoldingMethodsTool(templatesPath);
  });

  describe('getDefinition', () => {
    it('should return tool definition with correct schema', () => {
      const definition = tool.getDefinition();

      expect(definition.name).toBe('list-scaffolding-methods');
      expect(definition.description).toBeTruthy();
      expect(definition.description).toContain('Lists all available scaffolding methods');
      expect(definition.inputSchema.type).toBe('object');
    });

    it('should include projectPath and templateName in schema', () => {
      const definition = tool.getDefinition();

      expect(definition.inputSchema.properties.projectPath).toBeDefined();
      expect(definition.inputSchema.properties.projectPath.type).toBe('string');
      expect(definition.inputSchema.properties.templateName).toBeDefined();
      expect(definition.inputSchema.properties.templateName.type).toBe('string');
    });
  });

  describe('execute', () => {
    it('should list scaffolding methods successfully', async () => {
      const mockMethods = {
        sourceTemplate: 'nextjs-15',
        templatePath: 'nextjs-15',
        methods: [
          {
            name: 'scaffold-route',
            description: 'Generate a new route for Next.js App Router',
            variables_schema: {
              type: 'object',
              properties: {
                routePath: { type: 'string', description: 'Route path' },
                pageTitle: { type: 'string', description: 'Page title' },
              },
              required: ['routePath', 'pageTitle'],
            },
          },
          {
            name: 'scaffold-component',
            description: 'Generate a new React component',
            variables_schema: {
              type: 'object',
              properties: {
                componentName: { type: 'string', description: 'Component name' },
              },
              required: ['componentName'],
            },
          },
        ],
      };

      const spy = vi.spyOn(tool.scaffoldingMethodsService, 'listScaffoldingMethods');
      spy.mockResolvedValue(mockMethods);

      const result = await tool.execute({ projectPath: '/test/apps/my-app' });

      expect(result.isError).toBeFalsy();
      expect(result.content[0].type).toBe('text');

      const response = JSON.parse(result.content[0].text);
      expect(response.sourceTemplate).toBe('nextjs-15');
      expect(response.methods).toHaveLength(2);
      expect(response.methods[0].name).toBe('scaffold-route');
      expect(spy).toHaveBeenCalledWith('/test/apps/my-app', undefined);
    });

    it('should return error when both projectPath and templateName are missing', async () => {
      const result = await tool.execute({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        'Either projectPath or templateName must be provided',
      );
    });

    it('should list scaffolding methods by templateName successfully', async () => {
      const mockMethods = {
        sourceTemplate: 'typescript-mcp-package',
        templatePath: 'typescript-mcp-package',
        methods: [
          {
            name: 'scaffold-tool',
            description: 'Generate a new MCP tool',
            variables_schema: {
              type: 'object',
              properties: {
                toolName: { type: 'string', description: 'Tool name' },
              },
              required: ['toolName'],
            },
          },
        ],
      };

      const spy = vi.spyOn(tool.scaffoldingMethodsService, 'listScaffoldingMethodsByTemplate');
      spy.mockResolvedValue(mockMethods);

      const result = await tool.execute({ templateName: 'typescript-mcp-package' });

      expect(result.isError).toBeFalsy();
      expect(result.content[0].type).toBe('text');

      const response = JSON.parse(result.content[0].text);
      expect(response.sourceTemplate).toBe('typescript-mcp-package');
      expect(response.methods).toHaveLength(1);
      expect(response.methods[0].name).toBe('scaffold-tool');
      expect(spy).toHaveBeenCalledWith('typescript-mcp-package', undefined);
    });

    it('should prioritize projectPath over templateName when both are provided', async () => {
      const mockMethods = {
        sourceTemplate: 'nextjs-15',
        templatePath: 'nextjs-15',
        methods: [],
      };

      const projectPathSpy = vi.spyOn(tool.scaffoldingMethodsService, 'listScaffoldingMethods');
      projectPathSpy.mockResolvedValue(mockMethods);

      const templateNameSpy = vi.spyOn(
        tool.scaffoldingMethodsService,
        'listScaffoldingMethodsByTemplate',
      );

      await tool.execute({ projectPath: '/test/apps/my-app', templateName: 'nextjs-15' });

      expect(projectPathSpy).toHaveBeenCalledWith('/test/apps/my-app', undefined);
      expect(templateNameSpy).not.toHaveBeenCalled();
    });

    it('should handle empty methods list', async () => {
      const mockMethods = {
        sourceTemplate: 'nextjs-15',
        templatePath: 'nextjs-15',
        methods: [],
      };

      const spy = vi.spyOn(tool.scaffoldingMethodsService, 'listScaffoldingMethods');
      spy.mockResolvedValue(mockMethods);

      const result = await tool.execute({ projectPath: '/test/apps/my-app' });

      expect(result.isError).toBeFalsy();
      const response = JSON.parse(result.content[0].text);
      expect(response.methods).toHaveLength(0);
    });

    it('should handle service errors gracefully', async () => {
      const spy = vi.spyOn(tool.scaffoldingMethodsService, 'listScaffoldingMethods');
      spy.mockRejectedValue(new Error('Project not found or missing project.json'));

      const result = await tool.execute({ projectPath: '/test/apps/missing' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Project not found or missing project.json');
    });
  });
});
