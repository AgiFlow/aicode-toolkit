import { describe, expect, it, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findTemplatesPath: vi.fn(),
  resolveProjectConfig: vi.fn(),
  readFile: vi.fn(),
  generateStableId: vi.fn(),
  boilerplateList: vi.fn(),
  getBoilerplate: vi.fn(),
  useBoilerplate: vi.fn(),
  listScaffoldingMethods: vi.fn(),
  listScaffoldingMethodsByTemplate: vi.fn(),
  useScaffoldMethod: vi.fn(),
  writePendingScaffoldLog: vi.fn(),
  generateBoilerplateExecute: vi.fn(),
  generateFeatureExecute: vi.fn(),
  generateFileExecute: vi.fn(),
  writeFileExecute: vi.fn(),
}));

vi.mock('@agiflowai/aicode-utils', () => ({
  TemplatesManagerService: {
    findTemplatesPath: mocks.findTemplatesPath,
  },
  ProjectConfigResolver: {
    hasConfiguration: vi.fn().mockResolvedValue(true),
    resolveProjectConfig: mocks.resolveProjectConfig,
  },
  readFile: mocks.readFile,
  generateStableId: mocks.generateStableId,
  icons: {
    info: 'info',
    package: 'package',
    wrench: 'wrench',
    chart: 'chart',
    folder: 'folder',
    config: 'config',
  },
  print: {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    header: vi.fn(),
    highlight: vi.fn(),
    newline: vi.fn(),
  },
  messages: {
    error: vi.fn(),
    hint: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
    loading: vi.fn(),
  },
  sections: {
    createdFiles: vi.fn(),
    nextSteps: vi.fn(),
    list: vi.fn(),
  },
}));

vi.mock('../../src/services/BoilerplateService', () => ({
  BoilerplateService: vi.fn(function BoilerplateService() {
    return {
      listBoilerplates: mocks.boilerplateList,
      getBoilerplate: mocks.getBoilerplate,
      useBoilerplate: mocks.useBoilerplate,
    };
  }),
}));

vi.mock('../../src/services/FileSystemService', () => ({
  FileSystemService: vi.fn(function FileSystemService() {
    return {};
  }),
}));

vi.mock('../../src/services/ScaffoldingMethodsService', () => ({
  ScaffoldingMethodsService: vi.fn(function ScaffoldingMethodsService() {
    return {
      listScaffoldingMethods: mocks.listScaffoldingMethods,
      listScaffoldingMethodsByTemplate: mocks.listScaffoldingMethodsByTemplate,
      useScaffoldMethod: mocks.useScaffoldMethod,
    };
  }),
}));

vi.mock('../../src/utils/scaffoldPendingLog', () => ({
  writePendingScaffoldLog: mocks.writePendingScaffoldLog,
}));

vi.mock('../../src/tools', () => ({
  GenerateBoilerplateTool: vi.fn(function GenerateBoilerplateTool() {
    return {
      execute: mocks.generateBoilerplateExecute,
    };
  }),
  GenerateFeatureScaffoldTool: vi.fn(function GenerateFeatureScaffoldTool() {
    return {
      execute: mocks.generateFeatureExecute,
    };
  }),
  GenerateBoilerplateFileTool: vi.fn(function GenerateBoilerplateFileTool() {
    return {
      execute: mocks.generateFileExecute,
    };
  }),
  WriteToFileTool: vi.fn(function WriteToFileTool() {
    return {
      execute: mocks.writeFileExecute,
    };
  }),
}));

async function expectProcessExit(promise: Promise<unknown>) {
  await expect(promise).rejects.toThrow('process.exit called');
}

describe('scaffold-mcp CLI parity commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findTemplatesPath.mockResolvedValue('/workspace/templates');
    mocks.resolveProjectConfig.mockResolvedValue({
      type: 'monorepo',
      sourceTemplate: 'typescript-lib',
    });
    mocks.readFile.mockResolvedValue('file text');
    mocks.generateStableId.mockReturnValue('abc123');
    mocks.generateBoilerplateExecute.mockResolvedValue({
      content: [{ type: 'text', text: '{"success":true}' }],
    });
    mocks.generateFeatureExecute.mockResolvedValue({
      content: [{ type: 'text', text: '{"success":true}' }],
    });
    mocks.generateFileExecute.mockResolvedValue({
      content: [{ type: 'text', text: '{"success":true}' }],
    });
    mocks.writeFileExecute.mockResolvedValue({
      content: [{ type: 'text', text: 'Successfully wrote content to file: /workspace/out.txt' }],
    });
  });

  it('passes marker through boilerplate create', async () => {
    const { boilerplateCommand } = await import('../../src/commands/boilerplate');
    mocks.getBoilerplate.mockResolvedValue({
      name: 'scaffold-app',
      target_folder: 'apps',
      variables_schema: { required: [] },
    });
    mocks.useBoilerplate.mockResolvedValue({
      success: true,
      message: 'created',
      createdFiles: [],
    });

    await boilerplateCommand.parseAsync([
      'node',
      'cli',
      'create',
      'scaffold-app',
      '--vars',
      '{"appName":"demo"}',
      '--marker',
      '@custom-marker',
    ]);

    expect(mocks.useBoilerplate).toHaveBeenCalledWith(
      expect.objectContaining({
        boilerplateName: 'scaffold-app',
        marker: '@custom-marker',
      }),
    );
  });

  it('maps boilerplate generate options to generate-boilerplate tool arguments', async () => {
    const { boilerplateCommand } = await import('../../src/commands/boilerplate');

    await boilerplateCommand.parseAsync([
      'node',
      'cli',
      'generate',
      'scaffold-app',
      '--template',
      'vite-react',
      '--description',
      'Vite app',
      '--target-folder',
      'apps',
      '--variables',
      '[{"name":"appName","description":"App name","type":"string","required":true}]',
      '--include',
      'package.json',
      '--include',
      'src/main.tsx',
    ]);

    expect(mocks.generateBoilerplateExecute).toHaveBeenCalledWith({
      templateName: 'vite-react',
      boilerplateName: 'scaffold-app',
      description: 'Vite app',
      instruction: undefined,
      targetFolder: 'apps',
      variables: [
        {
          name: 'appName',
          description: 'App name',
          type: 'string',
          required: true,
        },
      ],
      includes: ['package.json', 'src/main.tsx'],
    });
  });

  it('uses current directory for scaffold list when no project path or template is provided', async () => {
    const { scaffoldCommand } = await import('../../src/commands/scaffold');
    mocks.listScaffoldingMethods.mockResolvedValue({
      methods: [
        {
          name: 'scaffold-service',
          description: 'Service',
          variables_schema: { required: [] },
        },
      ],
    });

    await scaffoldCommand.parseAsync(['node', 'cli', 'list']);

    expect(mocks.listScaffoldingMethods).toHaveBeenCalledWith(process.cwd(), undefined);
  });

  it('passes marker through scaffold add and writes pending scaffold log', async () => {
    const { scaffoldCommand } = await import('../../src/commands/scaffold');
    mocks.listScaffoldingMethods.mockResolvedValue({
      methods: [
        {
          name: 'scaffold-service',
          description: 'Service',
          variables_schema: { required: [] },
        },
      ],
    });
    mocks.useScaffoldMethod.mockResolvedValue({
      success: true,
      message: 'created',
      createdFiles: ['/workspace/apps/demo/src/service.ts'],
    });

    await scaffoldCommand.parseAsync([
      'node',
      'cli',
      'add',
      'scaffold-service',
      '--project',
      '/workspace/apps/demo',
      '--vars',
      '{"serviceName":"DemoService"}',
      '--marker',
      '@custom-marker',
    ]);

    expect(mocks.useScaffoldMethod).toHaveBeenCalledWith({
      projectPath: '/workspace/apps/demo',
      scaffold_feature_name: 'scaffold-service',
      variables: { serviceName: 'DemoService' },
      marker: '@custom-marker',
    });
    expect(mocks.writePendingScaffoldLog).toHaveBeenCalledWith({
      scaffoldId: 'abc123',
      projectPath: '/workspace/apps/demo',
      featureName: 'scaffold-service',
      generatedFiles: ['/workspace/apps/demo/src/service.ts'],
    });
  });

  it('maps scaffold generate options to generate-feature-scaffold tool arguments', async () => {
    const { scaffoldCommand } = await import('../../src/commands/scaffold');

    await scaffoldCommand.parseAsync([
      'node',
      'cli',
      'generate',
      'scaffold-service',
      '--template',
      'typescript-lib',
      '--description',
      'Generate a service',
      '--variables',
      '[{"name":"serviceName","description":"Service name","type":"string","required":true}]',
      '--include',
      'src/services/ExampleService.ts',
      '--pattern',
      'src/services/**/*.ts',
    ]);

    expect(mocks.generateFeatureExecute).toHaveBeenCalledWith({
      templateName: 'typescript-lib',
      featureName: 'scaffold-service',
      description: 'Generate a service',
      instruction: undefined,
      variables: [
        {
          name: 'serviceName',
          description: 'Service name',
          type: 'string',
          required: true,
        },
      ],
      includes: ['src/services/ExampleService.ts'],
      patterns: ['src/services/**/*.ts'],
    });
  });

  it('maps template file create content file input to generate-boilerplate-file tool', async () => {
    const { templateCommand } = await import('../../src/commands/template');

    await templateCommand.parseAsync([
      'node',
      'cli',
      'file',
      'create',
      'src/index.ts',
      '--template',
      'typescript-lib',
      '--content-file',
      '/tmp/source-template.txt',
      '--header',
      'Header text',
    ]);

    expect(mocks.readFile).toHaveBeenCalledWith('/tmp/source-template.txt', 'utf-8');
    expect(mocks.generateFileExecute).toHaveBeenCalledWith({
      templateName: 'typescript-lib',
      filePath: 'src/index.ts',
      content: 'file text',
      sourceFile: undefined,
      header: 'Header text',
    });
  });

  it('rejects template file create when multiple content inputs are provided', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const { templateCommand } = await import('../../src/commands/template');

    await expectProcessExit(
      templateCommand.parseAsync([
        'node',
        'cli',
        'file',
        'create',
        'src/index.ts',
        '--template',
        'typescript-lib',
        '--content',
        'inline',
        '--source-file',
        '/tmp/source.ts',
      ]),
    );

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(mocks.generateFileExecute).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  it('maps file write content file input to write-to-file tool', async () => {
    const { fileCommand } = await import('../../src/commands/file');

    await fileCommand.parseAsync([
      'node',
      'cli',
      'write',
      'out.txt',
      '--content-file',
      '/tmp/out-content.txt',
    ]);

    expect(mocks.writeFileExecute).toHaveBeenCalledWith({
      file_path: 'out.txt',
      content: 'file text',
    });
  });
});
