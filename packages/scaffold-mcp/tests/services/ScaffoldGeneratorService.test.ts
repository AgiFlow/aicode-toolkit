import * as fsHelpers from '@agiflowai/aicode-utils';
import * as yaml from 'js-yaml';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScaffoldGeneratorService } from '../../src/services/ScaffoldGeneratorService';

vi.mock('@agiflowai/aicode-utils', async () => {
  const actual = await vi.importActual('@agiflowai/aicode-utils');
  return {
    ...actual,
    ensureDir: vi.fn(),
    pathExists: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    readdir: vi.fn(),
  };
});

vi.mock('js-yaml', () => ({
  default: {
    load: vi.fn(),
    dump: vi.fn(),
    Type: vi.fn(),
    Schema: vi.fn(),
    DEFAULT_SCHEMA: {
      extend: vi.fn().mockReturnValue({}),
    },
  },
  load: vi.fn(),
  dump: vi.fn(),
  Type: vi.fn(),
  Schema: vi.fn(),
  DEFAULT_SCHEMA: {
    extend: vi.fn().mockReturnValue({}),
  },
}));

describe('ScaffoldGeneratorService', () => {
  let service: ScaffoldGeneratorService;
  const templatesPath = '/test/templates';

  beforeEach(() => {
    service = new ScaffoldGeneratorService(templatesPath);
    vi.clearAllMocks();

    // Reset mocks
    vi.mocked(fsHelpers.pathExists).mockResolvedValue(true);
    vi.mocked(fsHelpers.readFile).mockResolvedValue('');
    vi.mocked(fsHelpers.writeFile).mockResolvedValue(undefined);
    vi.mocked(fsHelpers.ensureDir).mockResolvedValue(undefined);
    (yaml.dump as any).mockReturnValue('yaml content');
  });

  describe('generateFeatureScaffold', () => {
    it('should create a new feature scaffold configuration', async () => {
      const options = {
        templateName: 'nextjs-15',
        featureName: 'scaffold-nextjs-page',
        description: 'Generate Next.js pages',
        variables: [
          {
            name: 'pageName',
            description: 'Page name',
            type: 'string' as const,
            required: true,
          },
        ],
        includes: ['src/app/page/page.tsx'],
      };

      vi.mocked(fsHelpers.pathExists).mockResolvedValue(false);
      vi.mocked(fsHelpers.readFile).mockResolvedValue('');
      (yaml.load as any).mockReturnValue({ features: [] });

      const result = await service.generateFeatureScaffold(options);

      expect(result.success).toBe(true);
      expect(result.message).toContain('scaffold-nextjs-page');
      expect(fsHelpers.ensureDir).toHaveBeenCalled();
      expect(fsHelpers.writeFile).toHaveBeenCalled();
    });

    it('should reject duplicate feature names', async () => {
      const options = {
        templateName: 'nextjs-15',
        featureName: 'existing-feature',
        description: 'Test feature',
        variables: [],
      };

      vi.mocked(fsHelpers.pathExists).mockResolvedValue(true);
      vi.mocked(fsHelpers.readFile).mockResolvedValue('');
      (yaml.load as any).mockReturnValue({
        features: [{ name: 'existing-feature' }],
      });

      const result = await service.generateFeatureScaffold(options);

      expect(result.success).toBe(false);
      expect(result.message).toContain('already exists');
    });

    it('should handle optional fields', async () => {
      const options = {
        templateName: 'nextjs-15',
        featureName: 'scaffold-test',
        description: 'Test feature',
        instruction: 'Detailed instructions',
        variables: [],
        patterns: ['src/**/*.tsx'],
      };

      vi.mocked(fsHelpers.pathExists).mockResolvedValue(false);
      vi.mocked(fsHelpers.readFile).mockResolvedValue('');
      (yaml.load as any).mockReturnValue({ features: [] });

      const result = await service.generateFeatureScaffold(options);

      expect(result.success).toBe(true);
    });

    it('should create features array if it does not exist', async () => {
      const options = {
        templateName: 'new-template',
        featureName: 'scaffold-test',
        description: 'Test feature',
        variables: [],
      };

      vi.mocked(fsHelpers.pathExists).mockResolvedValue(true);
      vi.mocked(fsHelpers.readFile).mockResolvedValue('');
      vi.mocked(yaml.load).mockReturnValue({}); // No features array

      const result = await service.generateFeatureScaffold(options);

      expect(result.success).toBe(true);
    });
  });

  describe('templateExists', () => {
    it('should return true for existing templates', async () => {
      vi.mocked(fsHelpers.pathExists).mockResolvedValue(true);

      const exists = await service.templateExists('nextjs-15');

      expect(exists).toBe(true);
      expect(fsHelpers.pathExists).toHaveBeenCalledWith(expect.stringContaining('nextjs-15'));
    });

    it('should return false for non-existent templates', async () => {
      vi.mocked(fsHelpers.pathExists).mockResolvedValue(false);

      const exists = await service.templateExists('nonexistent');

      expect(exists).toBe(false);
    });
  });

  describe('listTemplates', () => {
    it('should list only directories', async () => {
      const mockDirents = [
        { name: 'nextjs-15', isDirectory: () => true },
        { name: 'react-vite', isDirectory: () => true },
        { name: 'scaffold.yaml', isDirectory: () => false },
      ];

      vi.mocked(fsHelpers.readdir).mockResolvedValue(mockDirents as any);

      const templates = await service.listTemplates();

      expect(templates).toEqual(['nextjs-15', 'react-vite']);
      expect(templates).not.toContain('scaffold.yaml');
    });
  });
});
