import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DECISION_ALLOW, DECISION_DENY, DECISION_SKIP } from '@agiflowai/hooks-adapter';
import { TemplatesManagerService } from '@agiflowai/aicode-utils';

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
        loadLog: vi.fn().mockResolvedValue([]),
      };
    }),
  };
});

vi.mock('@agiflowai/aicode-utils', () => ({
  TemplatesManagerService: {
    findTemplatesPath: vi.fn().mockResolvedValue('/test/templates'),
    getWorkspaceRoot: vi.fn().mockResolvedValue('/test'),
    readToolkitConfig: vi.fn().mockResolvedValue({
      'scaffold-mcp': { hook: { excludeGlobs: ['**/*.md', '**/*.mdx', '**/src/content/**'] } },
    }),
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

import { UseScaffoldMethodHook } from '../../../src/hooks/codex';

/** Build an apply_patch command body that adds the given (relative) file paths. */
function addPatch(...paths: string[]): string {
  const body = paths.map((p) => `*** Add File: ${p}\n+content`).join('\n');
  return `*** Begin Patch\n${body}\n*** End Patch`;
}

function makeContext(overrides: Record<string, unknown> = {}) {
  return {
    hook_event_name: 'PreToolUse',
    tool_name: 'apply_patch',
    tool_input: { command: addPatch('src/api/x.ts') },
    cwd: '/test/apps/my-app',
    session_id: 'codex-session',
    transcript_path: '',
    permission_mode: 'default',
    tool_use_id: 'tu-1',
    turn_id: 'turn-1',
    model: 'gpt-5',
    ...overrides,
  } as any;
}

function methodsResult(
  methods: Array<{ name: string; description?: string }>,
  excludeGlobs?: string[],
) {
  return {
    isError: false,
    content: [{ type: 'text', text: JSON.stringify({ methods, excludeGlobs }) }],
  };
}

describe('Codex UseScaffoldMethodHook.preToolUse', () => {
  let hook: UseScaffoldMethodHook;

  beforeEach(() => {
    vi.clearAllMocks();
    hook = new UseScaffoldMethodHook();
    mockHasExecuted.mockResolvedValue(false);
    mockLogExecution.mockResolvedValue(undefined);
    mockFindProjectForFile.mockResolvedValue({ root: '/test/apps/my-app' });
  });

  it('skips non-apply_patch tools', async () => {
    const result = await hook.preToolUse(
      makeContext({ tool_name: 'Bash', tool_input: { command: 'echo hi > x.ts' } }),
    );
    expect(result.decision).toBe(DECISION_SKIP);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('skips apply_patch that creates no new files (update only)', async () => {
    const result = await hook.preToolUse(
      makeContext({
        tool_input: {
          command: '*** Begin Patch\n*** Update File: src/api/x.ts\n+more\n*** End Patch',
        },
      }),
    );
    expect(result.decision).toBe(DECISION_SKIP);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('denies a new source file with the available scaffold methods', async () => {
    mockExecute.mockResolvedValue(
      methodsResult([{ name: 'scaffold-route', description: 'Generate a new route' }]),
    );

    const result = await hook.preToolUse(makeContext());

    expect(result.decision).toBe(DECISION_DENY);
    expect(result.message).toContain('- **scaffold-route**: Generate a new route');
  });

  it('allows a new file matching configured global excludeGlobs', async () => {
    mockExecute.mockResolvedValue(
      methodsResult([{ name: 'scaffold-route', description: 'Generate a new route' }]),
    );

    const result = await hook.preToolUse(
      makeContext({ tool_input: { command: addPatch('src/content/blog/x.mdx') } }),
    );

    expect(result.decision).toBe(DECISION_ALLOW);
    expect(result.message).toContain('excludeGlobs');
    // Global excludeGlobs short-circuit before scaffold methods are ever consulted.
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('allows a new file matching a template-level exclude glob from scaffold.yaml', async () => {
    mockExecute.mockResolvedValue(
      methodsResult(
        [{ name: 'scaffold-route', description: 'Generate a new route' }],
        ['**/*.gen.ts'],
      ),
    );

    const result = await hook.preToolUse(
      makeContext({ tool_input: { command: addPatch('src/schema.gen.ts') } }),
    );

    expect(result.decision).toBe(DECISION_ALLOW);
    expect(result.message).toContain('template');
    expect(mockExecute).toHaveBeenCalled();
  });

  it('enforces on the first non-excluded new file in a mixed patch', async () => {
    mockExecute.mockResolvedValue(
      methodsResult([{ name: 'scaffold-route', description: 'Generate a new route' }]),
    );

    // Patch adds an excluded README.md plus a scaffoldable source file.
    const result = await hook.preToolUse(
      makeContext({ tool_input: { command: addPatch('README.md', 'src/api/x.ts') } }),
    );

    expect(result.decision).toBe(DECISION_DENY);
    expect(result.message).toContain('- **scaffold-route**: Generate a new route');
  });

  it('denies content writes when no excludeGlobs are configured', async () => {
    vi.mocked(TemplatesManagerService.readToolkitConfig).mockResolvedValueOnce(null);
    mockExecute.mockResolvedValue(
      methodsResult([{ name: 'scaffold-route', description: 'Generate a new route' }]),
    );

    const result = await hook.preToolUse(
      makeContext({ tool_input: { command: addPatch('src/content/blog/x.mdx') } }),
    );

    expect(result.decision).toBe(DECISION_DENY);
    expect(result.message).toContain('- **scaffold-route**: Generate a new route');
  });

  it('allows when no scaffold methods are available', async () => {
    mockExecute.mockResolvedValue(methodsResult([]));

    const result = await hook.preToolUse(makeContext());

    expect(result.decision).toBe(DECISION_ALLOW);
  });

  it('skips when methods were already shown for this file', async () => {
    mockHasExecuted.mockResolvedValueOnce(true);

    const result = await hook.preToolUse(makeContext());

    expect(result.decision).toBe(DECISION_SKIP);
    expect(mockExecute).not.toHaveBeenCalled();
  });
});
