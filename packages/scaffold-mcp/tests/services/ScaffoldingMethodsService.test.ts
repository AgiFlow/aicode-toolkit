import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IFileSystemService } from '../../src/types/interfaces';
import { ScaffoldingMethodsService } from '../../src/services/ScaffoldingMethodsService';

// Mock ProjectConfigResolver
vi.mock('@agiflowai/aicode-utils', () => ({
  log: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  ProjectConfigResolver: {
    resolveProjectConfig: vi.fn(),
  },
}));

describe('ScaffoldingMethodsService', () => {
  let service: ScaffoldingMethodsService;
  let mockFileSystem: IFileSystemService;
  const templatesPath = '/test/templates';

  beforeEach(() => {
    mockFileSystem = {
      pathExists: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      ensureDir: vi.fn(),
      readdir: vi.fn(),
      stat: vi.fn(),
      copyFile: vi.fn(),
      remove: vi.fn(),
    } as any;

    service = new ScaffoldingMethodsService(mockFileSystem, templatesPath);
    vi.clearAllMocks();
  });

  describe('listScaffoldingMethods with boilerplate name', () => {
    it('should find template by boilerplate name when sourceTemplate is a boilerplate name', async () => {
      const { ProjectConfigResolver } = await import('@agiflowai/aicode-utils');

      // Mock project config returning a boilerplate name instead of template name
      (ProjectConfigResolver.resolveProjectConfig as any).mockResolvedValue({
        sourceTemplate: 'scaffold-nextjs-app', // This is a boilerplate name from nextjs-15-drizzle
      });

      // Mock file system for template discovery
      (mockFileSystem.readdir as any)
        .mockResolvedValueOnce([
          // First level - templates root
          'nextjs-15-drizzle',
          'typescript-mcp-package',
          'README.md',
        ])
        .mockResolvedValueOnce([
          // Won't be called for this test
        ]);

      // Mock stats for directory checking
      (mockFileSystem.stat as any).mockImplementation((path: string) => {
        if (path.includes('README.md')) {
          return Promise.resolve({ isDirectory: () => false });
        }
        return Promise.resolve({ isDirectory: () => true });
      });

      // Mock pathExists for scaffold.yaml files
      (mockFileSystem.pathExists as any).mockImplementation((path: string) => {
        if (path.includes('nextjs-15-drizzle/scaffold.yaml')) {
          return Promise.resolve(true);
        }
        if (path.includes('typescript-mcp-package/scaffold.yaml')) {
          return Promise.resolve(true);
        }
        return Promise.resolve(false);
      });

      // Mock scaffold.yaml content for nextjs-15-drizzle
      const scaffoldContent = `
boilerplate:
  - name: scaffold-nextjs-app
    targetFolder: apps
    description: A Next.js app
    variables_schema:
      type: object
      properties:
        appName:
          type: string
      required:
        - appName
      additionalProperties: false
features:
  - name: scaffold-route
    description: Generate a new route
    variables_schema:
      type: object
      properties:
        routePath:
          type: string
        pageTitle:
          type: string
      required:
        - routePath
        - pageTitle
      additionalProperties: false
  - name: scaffold-component
    description: Generate a new component
    variables_schema:
      type: object
      properties:
        componentName:
          type: string
      required:
        - componentName
      additionalProperties: false
`;

      (mockFileSystem.readFile as any).mockResolvedValue(scaffoldContent);

      const result = await service.listScaffoldingMethods('/test/apps/my-app');

      expect(result.sourceTemplate).toBe('scaffold-nextjs-app');
      expect(result.templatePath).toBe('nextjs-15-drizzle');
      expect(result.methods).toHaveLength(2);
      expect(result.methods[0].name).toBe('scaffold-route');
      expect(result.methods[1].name).toBe('scaffold-component');
    });

    it('should handle template name as sourceTemplate (exact match)', async () => {
      const { ProjectConfigResolver } = await import('@agiflowai/aicode-utils');

      // Mock project config with exact template name
      (ProjectConfigResolver.resolveProjectConfig as any).mockResolvedValue({
        sourceTemplate: 'nextjs-15-drizzle',
      });

      // Mock file system for template discovery
      (mockFileSystem.readdir as any).mockResolvedValue([
        'nextjs-15-drizzle',
        'typescript-mcp-package',
      ]);

      (mockFileSystem.stat as any).mockResolvedValue({ isDirectory: () => true });

      (mockFileSystem.pathExists as any).mockImplementation((path: string) => {
        if (path.includes('nextjs-15-drizzle/scaffold.yaml')) {
          return Promise.resolve(true);
        }
        return Promise.resolve(false);
      });

      const scaffoldContent = `
features:
  - name: scaffold-route
    description: Generate a new route
    variables_schema:
      type: object
      properties: {}
      required: []
      additionalProperties: false
`;

      (mockFileSystem.readFile as any).mockResolvedValue(scaffoldContent);

      const result = await service.listScaffoldingMethods('/test/apps/my-app');

      expect(result.sourceTemplate).toBe('nextjs-15-drizzle');
      expect(result.templatePath).toBe('nextjs-15-drizzle');
      expect(result.methods).toHaveLength(1);
    });

    it('should throw error when template not found for boilerplate name', async () => {
      const { ProjectConfigResolver } = await import('@agiflowai/aicode-utils');

      (ProjectConfigResolver.resolveProjectConfig as any).mockResolvedValue({
        sourceTemplate: 'nonexistent-boilerplate',
      });

      (mockFileSystem.readdir as any).mockResolvedValue(['nextjs-15-drizzle']);
      (mockFileSystem.stat as any).mockResolvedValue({ isDirectory: () => true });
      (mockFileSystem.pathExists as any).mockResolvedValue(true);

      const scaffoldContent = `
boilerplate:
  - name: scaffold-some-other-app
features: []
`;

      (mockFileSystem.readFile as any).mockResolvedValue(scaffoldContent);

      await expect(service.listScaffoldingMethods('/test/apps/my-app')).rejects.toThrow(
        'Template not found for sourceTemplate: nonexistent-boilerplate',
      );
    });

    it('should handle nested template directories', async () => {
      const { ProjectConfigResolver } = await import('@agiflowai/aicode-utils');

      (ProjectConfigResolver.resolveProjectConfig as any).mockResolvedValue({
        sourceTemplate: 'scaffold-nested-app',
      });

      // Mock file system for nested structure
      (mockFileSystem.readdir as any)
        .mockResolvedValueOnce([
          // First level - templates root
          'apps',
          'packages',
        ])
        .mockResolvedValueOnce([
          // Second level - apps/
          'nextjs-15',
        ])
        .mockResolvedValueOnce([
          // Second level - packages/
          'typescript-lib',
        ]);

      (mockFileSystem.stat as any).mockResolvedValue({ isDirectory: () => true });

      (mockFileSystem.pathExists as any).mockImplementation((path: string) => {
        // No scaffold.yaml at top level
        if (path === '/test/templates/apps/scaffold.yaml') {
          return Promise.resolve(false);
        }
        if (path === '/test/templates/packages/scaffold.yaml') {
          return Promise.resolve(false);
        }
        // scaffold.yaml exists in nested directories
        if (path.includes('apps/nextjs-15/scaffold.yaml')) {
          return Promise.resolve(true);
        }
        if (path.includes('packages/typescript-lib/scaffold.yaml')) {
          return Promise.resolve(true);
        }
        return Promise.resolve(false);
      });

      const scaffoldContent = `
boilerplate:
  - name: scaffold-nested-app
features:
  - name: scaffold-feature
    description: Test feature
    variables_schema:
      type: object
      properties: {}
      required: []
      additionalProperties: false
`;

      (mockFileSystem.readFile as any).mockResolvedValue(scaffoldContent);

      const result = await service.listScaffoldingMethods('/test/apps/my-app');

      expect(result.sourceTemplate).toBe('scaffold-nested-app');
      expect(result.templatePath).toBe('apps/nextjs-15');
      expect(result.methods).toHaveLength(1);
    });

    it('should return empty methods array when no features defined', async () => {
      const { ProjectConfigResolver } = await import('@agiflowai/aicode-utils');

      (ProjectConfigResolver.resolveProjectConfig as any).mockResolvedValue({
        sourceTemplate: 'empty-template',
      });

      (mockFileSystem.readdir as any).mockResolvedValue(['empty-template']);
      (mockFileSystem.stat as any).mockResolvedValue({ isDirectory: () => true });
      (mockFileSystem.pathExists as any).mockResolvedValue(true);

      const scaffoldContent = `
boilerplate:
  - name: scaffold-empty-app
# No features defined
`;

      (mockFileSystem.readFile as any).mockResolvedValue(scaffoldContent);

      const result = await service.listScaffoldingMethods('/test/apps/my-app');

      expect(result.methods).toHaveLength(0);
    });

    it('should use feature name when provided, fallback to sourceTemplate otherwise', async () => {
      const { ProjectConfigResolver } = await import('@agiflowai/aicode-utils');

      (ProjectConfigResolver.resolveProjectConfig as any).mockResolvedValue({
        sourceTemplate: 'test-template',
      });

      (mockFileSystem.readdir as any).mockResolvedValue(['test-template']);
      (mockFileSystem.stat as any).mockResolvedValue({ isDirectory: () => true });
      (mockFileSystem.pathExists as any).mockResolvedValue(true);

      const scaffoldContent = `
features:
  - name: scaffold-with-name
    description: Feature with explicit name
    variables_schema:
      type: object
      properties: {}
      required: []
      additionalProperties: false
  - description: Feature without name
    variables_schema:
      type: object
      properties: {}
      required: []
      additionalProperties: false
`;

      (mockFileSystem.readFile as any).mockResolvedValue(scaffoldContent);

      const result = await service.listScaffoldingMethods('/test/apps/my-app');

      expect(result.methods).toHaveLength(2);
      expect(result.methods[0].name).toBe('scaffold-with-name');
      expect(result.methods[1].name).toBe('scaffold-test-template'); // Fallback to sourceTemplate
    });
  });

  describe('listScaffoldingMethodsWithVariables', () => {
    it('should call listScaffoldingMethods and return methods', async () => {
      const { ProjectConfigResolver } = await import('@agiflowai/aicode-utils');

      (ProjectConfigResolver.resolveProjectConfig as any).mockResolvedValue({
        sourceTemplate: 'test-template',
      });

      (mockFileSystem.readdir as any).mockResolvedValue(['test-template']);
      (mockFileSystem.stat as any).mockResolvedValue({ isDirectory: () => true });
      (mockFileSystem.pathExists as any).mockResolvedValue(true);

      const scaffoldContent = `
features:
  - name: scaffold-feature
    description: Test feature
    instruction: "Create a component"
    variables_schema:
      type: object
      properties:
        componentName:
          type: string
      required:
        - componentName
      additionalProperties: false
`;

      (mockFileSystem.readFile as any).mockResolvedValue(scaffoldContent);

      const result = await service.listScaffoldingMethodsWithVariables('/test/apps/my-app', {
        componentName: 'MyButton',
      });

      expect(result.methods).toHaveLength(1);
      expect(result.methods[0].name).toBe('scaffold-feature');
      // The instruction should be returned (it doesn't have template variables in this simple test)
      expect(result.methods[0].instruction).toBe('Create a component');
    });

    it('should handle methods without instructions', async () => {
      const { ProjectConfigResolver } = await import('@agiflowai/aicode-utils');

      (ProjectConfigResolver.resolveProjectConfig as any).mockResolvedValue({
        sourceTemplate: 'test-template',
      });

      (mockFileSystem.readdir as any).mockResolvedValue(['test-template']);
      (mockFileSystem.stat as any).mockResolvedValue({ isDirectory: () => true });
      (mockFileSystem.pathExists as any).mockResolvedValue(true);

      const scaffoldContent = `
features:
  - name: scaffold-feature
    description: Test feature
    variables_schema:
      type: object
      properties: {}
      required: []
      additionalProperties: false
`;

      (mockFileSystem.readFile as any).mockResolvedValue(scaffoldContent);

      const result = await service.listScaffoldingMethodsWithVariables('/test/apps/my-app', {});

      expect(result.methods).toHaveLength(1);
      expect(result.methods[0].instruction).toBeUndefined();
    });
  });

  describe('useScaffoldMethod with >10 scaffold methods', () => {
    it('should find scaffold method beyond first page (index > 10)', async () => {
      const { ProjectConfigResolver } = await import('@agiflowai/aicode-utils');

      (ProjectConfigResolver.resolveProjectConfig as any).mockResolvedValue({
        sourceTemplate: 'test-template',
      });

      (mockFileSystem.readdir as any).mockResolvedValue(['test-template']);
      (mockFileSystem.stat as any).mockResolvedValue({ isDirectory: () => true });
      (mockFileSystem.pathExists as any).mockResolvedValue(true);

      const features = Array.from({ length: 15 }, (_, i) => ({
        name: `scaffold-feature-${i + 1}`,
        description: `Feature ${i + 1}`,
      }));

      const scaffoldContent = `
features:
${features.map((f) => `  - name: ${f.name}\n    description: ${f.description}\n    variables_schema:\n      type: object\n      properties:\n        featureName:\n          type: string\n      required:\n        - featureName\n      additionalProperties: false`).join('\n')}
`;

      (mockFileSystem.readFile as any).mockResolvedValue(scaffoldContent);

      const result = await service.listScaffoldingMethods('/test/apps/my-app');

      expect(result.methods).toHaveLength(10);
      expect(result.nextCursor).toBeDefined();
      expect(result._meta?.total).toBe(15);
    });

    it('should list all scaffold methods in error when method not found', async () => {
      const { ProjectConfigResolver } = await import('@agiflowai/aicode-utils');

      (ProjectConfigResolver.resolveProjectConfig as any).mockResolvedValue({
        sourceTemplate: 'test-template',
      });

      (mockFileSystem.readdir as any).mockResolvedValue(['test-template']);
      (mockFileSystem.stat as any).mockResolvedValue({ isDirectory: () => true });
      (mockFileSystem.pathExists as any).mockResolvedValue(true);

      const features = Array.from({ length: 15 }, (_, i) => ({
        name: `scaffold-feature-${i + 1}`,
        description: `Feature ${i + 1}`,
      }));

      const scaffoldContent = `
features:
${features.map((f) => `  - name: ${f.name}\n    description: ${f.description}\n    variables_schema:\n      type: object\n      properties:\n        featureName:\n          type: string\n      required:\n        - featureName\n      additionalProperties: false`).join('\n')}
`;

      (mockFileSystem.readFile as any).mockResolvedValue(scaffoldContent);

      await expect(
        service.useScaffoldMethod({
          projectPath: '/test/apps/my-app',
          scaffold_feature_name: 'nonexistent-method',
          variables: { featureName: 'test' },
        }),
      ).rejects.toThrow('not found');

      try {
        await service.useScaffoldMethod({
          projectPath: '/test/apps/my-app',
          scaffold_feature_name: 'nonexistent-method',
          variables: { featureName: 'test' },
        });
      } catch (error: any) {
        expect(error.message).toContain('scaffold-feature-1');
        expect(error.message).toContain('scaffold-feature-12');
        expect(error.message).toContain('scaffold-feature-15');
      }
    });
  });

  describe('listScaffoldingMethods pagination with >10 methods', () => {
    it('should return paginated results with nextCursor', async () => {
      const { ProjectConfigResolver } = await import('@agiflowai/aicode-utils');

      (ProjectConfigResolver.resolveProjectConfig as any).mockResolvedValue({
        sourceTemplate: 'test-template',
      });

      (mockFileSystem.readdir as any).mockResolvedValue(['test-template']);
      (mockFileSystem.stat as any).mockResolvedValue({ isDirectory: () => true });
      (mockFileSystem.pathExists as any).mockResolvedValue(true);

      const features = Array.from({ length: 25 }, (_, i) => ({
        name: `scaffold-feature-${i + 1}`,
        description: `Feature ${i + 1}`,
      }));

      const scaffoldContent = `
features:
${features.map((f) => `  - name: ${f.name}\n    description: ${f.description}\n    variables_schema:\n      type: object\n      properties: {}\n      required: []\n      additionalProperties: false`).join('\n')}
`;

      (mockFileSystem.readFile as any).mockResolvedValue(scaffoldContent);

      const firstPage = await service.listScaffoldingMethods('/test/apps/my-app');

      expect(firstPage.methods).toHaveLength(10);
      expect(firstPage.nextCursor).toBeDefined();
      expect(firstPage._meta?.total).toBe(25);
      expect(firstPage._meta?.offset).toBe(0);
      expect(firstPage._meta?.limit).toBe(10);

      const secondPage = await service.listScaffoldingMethods(
        '/test/apps/my-app',
        firstPage.nextCursor,
      );

      expect(secondPage.methods).toHaveLength(10);
      expect(secondPage.nextCursor).toBeDefined();
      expect(secondPage._meta?.offset).toBe(10);

      const thirdPage = await service.listScaffoldingMethods(
        '/test/apps/my-app',
        secondPage.nextCursor,
      );

      expect(thirdPage.methods).toHaveLength(5);
      expect(thirdPage.nextCursor).toBeUndefined();
      expect(thirdPage._meta?.offset).toBe(20);
    });
  });
});
