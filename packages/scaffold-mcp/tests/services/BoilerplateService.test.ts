import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BoilerplateService } from '../../src/services/BoilerplateService';

vi.mock('node:fs', () => ({
  readdirSync: vi.fn(),
}));

vi.mock('@agiflowai/aicode-utils', () => ({
  log: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  pathExistsSync: vi.fn(),
  readFileSync: vi.fn(),
  statSync: vi.fn(),
  ProjectConfigResolver: {
    resolveProjectConfig: vi.fn(),
    createToolkitYaml: vi.fn(),
    createProjectJson: vi.fn(),
  },
}));

vi.mock('../../src/services/ScaffoldService');
vi.mock('../../src/services/ScaffoldConfigLoader');
vi.mock('../../src/services/VariableReplacementService');
vi.mock('../../src/services/FileSystemService');
vi.mock('../../src/services/TemplateService');

function setupBoilerplateMocks(boilerplateCount: number): string {
  const boilerplates = Array.from({ length: boilerplateCount }, (_, i) => ({
    name: `boilerplate-${i + 1}`,
    targetFolder: 'apps',
    description: `Description for boilerplate ${i + 1}`,
  }));

  return `
boilerplate:
${boilerplates.map((b) => `  - name: ${b.name}\n    targetFolder: ${b.targetFolder}\n    description: ${b.description}\n    variables_schema:\n      type: object\n      properties:\n        packageName:\n          type: string\n      required:\n        - packageName`).join('\n')}
`;
}

describe('BoilerplateService', () => {
  let service: BoilerplateService;
  const templatesPath = '/test/templates';

  beforeEach(async () => {
    vi.clearAllMocks();

    const { readdirSync } = await import('node:fs');
    const { pathExistsSync, statSync, ProjectConfigResolver } = await import(
      '@agiflowai/aicode-utils'
    );

    (ProjectConfigResolver.resolveProjectConfig as any).mockResolvedValue({
      type: 'monorepo',
      sourceTemplate: 'test-template',
    });

    (pathExistsSync as any).mockImplementation(() => {
      return true;
    });

    (readdirSync as any).mockImplementation((dir: string) => {
      if (dir === templatesPath) {
        return ['test-template'];
      }
      return ['package.json', 'scaffold.yaml'];
    });

    (statSync as any).mockImplementation((itemPath: string) => {
      const isDir = itemPath.endsWith('test-template') || itemPath === templatesPath;
      return {
        isDirectory: () => isDir,
      };
    });

    service = new BoilerplateService(templatesPath);
  });

  describe('useBoilerplate with >10 boilerplates', () => {
    it('should find boilerplate beyond first page (index > 10)', async () => {
      const { readFileSync } = await import('@agiflowai/aicode-utils');
      (readFileSync as any).mockReturnValue(setupBoilerplateMocks(15));

      const result = await service.useBoilerplate({
        boilerplateName: 'boilerplate-12',
        variables: { packageName: 'test-package' },
      });

      expect(result.message).not.toContain('not found');
    });

    it('should list all boilerplates in error message when boilerplate not found', async () => {
      const { readFileSync } = await import('@agiflowai/aicode-utils');
      (readFileSync as any).mockReturnValue(setupBoilerplateMocks(15));

      const result = await service.useBoilerplate({
        boilerplateName: 'nonexistent-boilerplate',
        variables: { packageName: 'test-package' },
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
      expect(result.message).toContain('boilerplate-1');
      expect(result.message).toContain('boilerplate-12');
      expect(result.message).toContain('boilerplate-15');
    });
  });

  describe('getBoilerplate with >10 boilerplates', () => {
    it('should find boilerplate at index 12 when there are 15 boilerplates', async () => {
      const { readFileSync } = await import('@agiflowai/aicode-utils');
      (readFileSync as any).mockReturnValue(setupBoilerplateMocks(15));

      const result = await service.getBoilerplate('boilerplate-12');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('boilerplate-12');
      expect(result?.description).toBe('Description for boilerplate 12');
    });

    it('should return null for nonexistent boilerplate', async () => {
      const { readFileSync } = await import('@agiflowai/aicode-utils');
      (readFileSync as any).mockReturnValue(setupBoilerplateMocks(15));

      const result = await service.getBoilerplate('nonexistent-boilerplate');

      expect(result).toBeNull();
    });
  });

  describe('listBoilerplates pagination', () => {
    it('should return paginated results with nextCursor for >10 boilerplates', async () => {
      const { readFileSync } = await import('@agiflowai/aicode-utils');
      (readFileSync as any).mockReturnValue(setupBoilerplateMocks(15));

      const result = await service.listBoilerplates();

      expect(result.boilerplates).toHaveLength(10);
      expect(result.nextCursor).toBeDefined();
      expect(result._meta?.total).toBe(15);
    });
  });
});
