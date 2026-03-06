import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DECISION_ALLOW, DECISION_DENY, DECISION_SKIP } from '@agiflowai/hooks-adapter';
import fs from 'node:fs/promises';

const mockExecute = vi.fn();
const mockHasExecuted = vi.fn().mockResolvedValue(false);
const mockLogExecution = vi.fn().mockResolvedValue(undefined);
const mockFindProjectForFile = vi.fn().mockResolvedValue({ root: '/test/apps/my-app' });

vi.mock('@agiflowai/hooks-adapter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@agiflowai/hooks-adapter')>();
  return {
    ...actual,
    ExecutionLogService: vi.fn(function MockExecutionLogService() {
      return {
        hasExecuted: mockHasExecuted,
        logExecution: mockLogExecution,
      };
    }),
  };
});

vi.mock('@agiflowai/aicode-utils', () => ({
  TemplatesManagerService: {
    findTemplatesPath: vi.fn().mockResolvedValue('/test/templates'),
    getWorkspaceRoot: vi.fn().mockResolvedValue('/test'),
  },
  ProjectFinderService: vi.fn(function MockProjectFinderService() {
    return {
      findProjectForFile: mockFindProjectForFile,
    };
  }),
}));

vi.mock('../../../src/tools/ListScaffoldingMethodsTool', () => ({
  ListScaffoldingMethodsTool: vi.fn(function MockListScaffoldingMethodsTool() {
    return { execute: mockExecute };
  }),
}));

vi.mock('node:fs/promises', () => ({
  default: {
    access: vi.fn().mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })),
  },
  access: vi.fn().mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })),
}));

import { UseScaffoldMethodHook } from '../../../src/hooks/geminiCli';

function makeContext(overrides: Record<string, unknown> = {}) {
  return {
    tool_name: 'write',
    tool_input: { file_path: '/test/apps/my-app/src/new-file.ts' },
    cwd: '/test/apps/my-app',
    session_id: 'gemini-session',
    event: 'BeforeTool',
    ...overrides,
  } as any;
}

describe('Gemini UseScaffoldMethodHook.preToolUse', () => {
  let hook: UseScaffoldMethodHook;

  beforeEach(() => {
    vi.clearAllMocks();
    hook = new UseScaffoldMethodHook();
    mockHasExecuted.mockResolvedValue(false);
    mockLogExecution.mockResolvedValue(undefined);
    mockFindProjectForFile.mockResolvedValue({ root: '/test/apps/my-app' });
    vi.mocked(fs.access).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
  });

  it('skips non-write operations', async () => {
    const result = await hook.preToolUse(makeContext({ tool_name: 'edit' }));
    expect(result.decision).toBe(DECISION_SKIP);
  });

  it('skips existing target files', async () => {
    vi.mocked(fs.access).mockResolvedValueOnce(undefined);

    const result = await hook.preToolUse(makeContext());
    expect(result.decision).toBe(DECISION_SKIP);
  });

  it('denies with a compact capped method list', async () => {
    mockExecute.mockResolvedValue({
      isError: false,
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            methods: [
              {
                name: 'one',
                description: 'First',
                variables_schema: { required: ['a', 'b', 'c', 'd'] },
              },
              {
                name: 'two',
                description: 'Second',
                variables_schema: { required: ['e'] },
              },
              { name: 'three', description: 'Third', variables_schema: { required: ['f'] } },
              { name: 'four', description: 'Fourth', variables_schema: { required: ['g'] } },
              { name: 'five', description: 'Fifth', variables_schema: { required: ['h'] } },
              { name: 'six', description: 'Sixth', variables_schema: { required: ['i'] } },
            ],
          }),
        },
      ],
    });

    const result = await hook.preToolUse(makeContext());

    expect(result.decision).toBe(DECISION_DENY);
    expect(result.message).toContain('- **one**: First');
    expect(result.message).toContain('Required: a, b, c, +1 more');
    expect(result.message).toContain('- **two**: Second');
    expect(result.message).toContain('Required: e');
    expect(result.message).not.toContain('Required: f');
    expect(result.message).not.toContain('- **six**: Sixth');
    expect(result.message).toContain('...and 1 more methods');
  });

  it('allows when no methods are available', async () => {
    mockExecute.mockResolvedValue({
      isError: false,
      content: [{ type: 'text', text: JSON.stringify({ methods: [] }) }],
    });

    const result = await hook.preToolUse(makeContext());
    expect(result.decision).toBe(DECISION_DENY);
    expect(result.message).toContain('No scaffolding methods are available');
  });
});
