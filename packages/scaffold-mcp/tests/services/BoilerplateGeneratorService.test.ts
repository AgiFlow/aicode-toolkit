import * as fs from 'fs-extra';
import * as yaml from 'js-yaml';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BoilerplateGeneratorService } from '../../src/services/BoilerplateGeneratorService';

vi.mock('fs-extra', () => ({
  default: {
    ensureDir: vi.fn(),
    pathExists: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    readdir: vi.fn(),
  },
  ensureDir: vi.fn(),
  pathExists: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  readdir: vi.fn(),
}));

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

describe('BoilerplateGeneratorService', () => {
  let service: BoilerplateGeneratorService;
  const templatesPath = '/test/templates';

  beforeEach(() => {
    service = new BoilerplateGeneratorService(templatesPath);
    vi.clearAllMocks();

    // Reset mocks
    (fs.pathExists as any).mockResolvedValue(true);
    (fs.readFile as any).mockResolvedValue('');
    (fs.writeFile as any).mockResolvedValue(undefined);
    (fs.ensureDir as any).mockResolvedValue(undefined);
    (yaml.dump as any).mockReturnValue('yaml content');
  });

  describe('generateBoilerplate', () => {
    it('should create a new boilerplate configuration', async () => {
      const options = {
        templateName: 'test-template',
        boilerplateName: 'scaffold-test-app',
        description: 'Test boilerplate description',
        targetFolder: 'apps',
        variables: [
          {
            name: 'appName',
            description: 'Application name',
            type: 'string' as const,
            required: true,
          },
        ],
        includes: ['package.json', 'src/index.ts'],
      };

      (fs.pathExists as any).mockResolvedValue(false);
      (fs.readFile as any).mockResolvedValue('boilerplate: []');
      (yaml.load as any).mockReturnValue({ boilerplate: [] });

      const result = await service.generateBoilerplate(options);

      expect(result.success).toBe(true);
      expect(result.message).toContain('scaffold-test-app');
      expect(fs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('test-template'));
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should reject duplicate boilerplate names', async () => {
      const options = {
        templateName: 'test-template',
        boilerplateName: 'existing-boilerplate',
        description: 'Test boilerplate',
        targetFolder: 'apps',
        variables: [],
      };

      (fs.pathExists as any).mockResolvedValue(true);
      (fs.readFile as any).mockResolvedValue('');
      (yaml.load as any).mockReturnValue({
        boilerplate: [{ name: 'existing-boilerplate' }],
      });

      const result = await service.generateBoilerplate(options);

      expect(result.success).toBe(false);
      expect(result.message).toContain('already exists');
    });

    it('should handle optional instruction field', async () => {
      const options = {
        templateName: 'test-template',
        boilerplateName: 'scaffold-test-app',
        description: 'Test boilerplate',
        instruction: 'Detailed instructions here',
        targetFolder: 'apps',
        variables: [],
      };

      (fs.pathExists as any).mockResolvedValue(false);
      (fs.readFile as any).mockResolvedValue('');
      (yaml.load as any).mockReturnValue({ boilerplate: [] });

      const result = await service.generateBoilerplate(options);

      expect(result.success).toBe(true);
    });
  });

  describe('createTemplateFile', () => {
    it('should create a template file with content', async () => {
      const options = {
        templateName: 'test-template',
        filePath: 'package.json',
        content: '{"name": "{{ appName }}"}',
      };

      (fs.pathExists as any).mockResolvedValue(true);

      const result = await service.createTemplateFile(options);

      expect(result.success).toBe(true);
      expect(fs.ensureDir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.liquid'),
        expect.any(String),
        'utf-8',
      );
    });

    it('should add .liquid extension automatically', async () => {
      const options = {
        templateName: 'test-template',
        filePath: 'src/index.ts',
        content: 'console.log("test");',
      };

      (fs.pathExists as any).mockResolvedValue(true);

      const result = await service.createTemplateFile(options);

      expect(result.filePath).toContain('.liquid');
    });

    it('should prepend header when provided', async () => {
      const header = '/**\n * Component Header\n */';
      const content = 'export default function() {}';

      const options = {
        templateName: 'test-template',
        filePath: 'Component.tsx',
        content,
        header,
      };

      (fs.pathExists as any).mockResolvedValue(true);

      await service.createTemplateFile(options);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining(header),
        'utf-8',
      );
    });

    it('should copy from source file when provided', async () => {
      const sourceContent = 'export const test = 1;';
      const options = {
        templateName: 'test-template',
        filePath: 'src/test.ts',
        sourceFile: '/path/to/source.ts',
      };

      (fs.pathExists as any).mockResolvedValue(true);
      (fs.readFile as any).mockResolvedValue(sourceContent);

      const result = await service.createTemplateFile(options);

      expect(result.success).toBe(true);
      expect(fs.readFile).toHaveBeenCalledWith('/path/to/source.ts', 'utf-8');
    });

    it('should fail if template directory does not exist', async () => {
      const options = {
        templateName: 'nonexistent',
        filePath: 'test.ts',
        content: 'test',
      };

      (fs.pathExists as any).mockResolvedValue(false);

      const result = await service.createTemplateFile(options);

      expect(result.success).toBe(false);
      expect(result.message).toContain('does not exist');
    });
  });

  describe('templateExists', () => {
    it('should return true when template exists', async () => {
      (fs.pathExists as any).mockResolvedValue(true);

      const exists = await service.templateExists('test-template');

      expect(exists).toBe(true);
    });

    it('should return false when template does not exist', async () => {
      (fs.pathExists as any).mockResolvedValue(false);

      const exists = await service.templateExists('nonexistent');

      expect(exists).toBe(false);
    });
  });

  describe('listTemplates', () => {
    it('should list all template directories', async () => {
      const mockDirents = [
        { name: 'nextjs-15', isDirectory: () => true },
        { name: 'react-vite', isDirectory: () => true },
        { name: 'README.md', isDirectory: () => false },
      ];

      (fs.readdir as any).mockResolvedValue(mockDirents as any);

      const templates = await service.listTemplates();

      expect(templates).toEqual(['nextjs-15', 'react-vite']);
    });
  });
});
