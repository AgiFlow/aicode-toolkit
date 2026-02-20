import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UseScaffoldMethodHook } from '../../../src/hooks/claudeCode';
import { DECISION_ALLOW, DECISION_DENY, DECISION_SKIP } from '@agiflowai/hooks-adapter';
import type { ClaudeCodePreToolUseInput, ClaudeCodeStopInput } from '@agiflowai/hooks-adapter';
import { TemplatesManagerService } from '@agiflowai/aicode-utils';

// ---------------------------------------------------------------------------
// Interfaces (declared before vi.mock so factories can reference them)
// ---------------------------------------------------------------------------

interface HoistedMocks {
  mockExecute: ReturnType<typeof vi.fn>;
  mockHasExecuted: ReturnType<typeof vi.fn>;
  mockLogExecution: ReturnType<typeof vi.fn>;
  mockLoadLog: ReturnType<typeof vi.fn>;
}

interface MockExecutionLogService {
  hasExecuted: ReturnType<typeof vi.fn>;
  logExecution: ReturnType<typeof vi.fn>;
  loadLog: ReturnType<typeof vi.fn>;
}

interface MockProjectFinderService {
  findProjectForFile: ReturnType<typeof vi.fn>;
}

interface MockListScaffoldingMethodsTool {
  execute: ReturnType<typeof vi.fn>;
}

interface MockMethodEntry {
  name: string;
  description?: string;
}

interface MockToolResultContent {
  type: string;
  text?: string;
}

interface MockToolResult {
  isError: boolean;
  content: MockToolResultContent[];
}

// ---------------------------------------------------------------------------
// Hoisted mock fns — declared before vi.mock factories run
// ---------------------------------------------------------------------------

const { mockExecute, mockHasExecuted, mockLogExecution, mockLoadLog } = vi.hoisted(
  (): HoistedMocks => ({
    mockExecute: vi.fn(),
    mockHasExecuted: vi.fn().mockResolvedValue(false),
    mockLogExecution: vi.fn().mockResolvedValue(undefined),
    mockLoadLog: vi.fn().mockResolvedValue([]),
  }),
);

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock(
  '@agiflowai/hooks-adapter',
  async (
    importOriginal: () => Promise<typeof import('@agiflowai/hooks-adapter')>,
  ): Promise<object> => {
    const actual = await importOriginal<typeof import('@agiflowai/hooks-adapter')>();
    return {
      ...actual,
      // Vitest v4 requires a regular function (not arrow) for constructor mocks
      // biome-ignore lint/complexity/useArrowFunction: regular function required for `new` call in Vitest v4
      ExecutionLogService: vi.fn(function (): MockExecutionLogService {
        return {
          hasExecuted: mockHasExecuted,
          logExecution: mockLogExecution,
          loadLog: mockLoadLog,
        };
      }),
    };
  },
);

vi.mock('@agiflowai/aicode-utils', (): object => ({
  TemplatesManagerService: {
    findTemplatesPath: vi.fn().mockResolvedValue('/test/templates'),
    getWorkspaceRoot: vi.fn().mockResolvedValue('/test'),
  },
  // Vitest v4 requires a regular function (not arrow) for constructor mocks
  // biome-ignore lint/complexity/useArrowFunction: regular function required for `new` call in Vitest v4
  ProjectFinderService: vi.fn(function (): MockProjectFinderService {
    return {
      findProjectForFile: vi.fn().mockResolvedValue({ root: '/test/apps/my-app' }),
    };
  }),
}));

vi.mock('../../../src/tools', (): object => ({
  // Vitest v4 requires a regular function (not arrow) for constructor mocks
  // biome-ignore lint/complexity/useArrowFunction: regular function required for `new` call in Vitest v4
  ListScaffoldingMethodsTool: vi.fn(function (): MockListScaffoldingMethodsTool {
    return { execute: mockExecute };
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePreToolUseContext(
  overrides: Partial<ClaudeCodePreToolUseInput> = {},
): ClaudeCodePreToolUseInput {
  return {
    hook_event_name: 'PreToolUse',
    tool_name: 'Write',
    tool_input: { file_path: '/test/apps/my-app/src/foo.ts' },
    cwd: '/test/apps/my-app',
    session_id: 'test-session-123',
    transcript_path: '',
    permission_mode: 'default',
    tool_use_id: 'tu-1',
    ...overrides,
  };
}

function makeMethodsResult(methods: MockMethodEntry[], nextCursor?: string): MockToolResult {
  return {
    isError: false,
    content: [{ type: 'text', text: JSON.stringify({ methods, nextCursor }) }],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UseScaffoldMethodHook.preToolUse', (): void => {
  let hook: UseScaffoldMethodHook;

  beforeEach((): void => {
    vi.clearAllMocks();
    hook = new UseScaffoldMethodHook();
  });

  it('should skip non-tool-use events (no tool_name field)', async (): Promise<void> => {
    const stopContext: ClaudeCodeStopInput = {
      hook_event_name: 'Stop',
      cwd: '/test',
      session_id: 's1',
      transcript_path: '',
      permission_mode: 'default',
      stop_hook_active: false,
      last_assistant_message: '',
    };
    const result = await hook.preToolUse(stopContext);
    expect(result.decision).toBe(DECISION_SKIP);
  });

  it('should skip non-Write tool names', async (): Promise<void> => {
    const result = await hook.preToolUse(makePreToolUseContext({ tool_name: 'Edit' }));
    expect(result.decision).toBe(DECISION_SKIP);
  });

  it('should skip Write operations without a file_path', async (): Promise<void> => {
    const result = await hook.preToolUse(makePreToolUseContext({ tool_input: {} }));
    expect(result.decision).toBe(DECISION_SKIP);
  });

  it('should skip files outside the cwd', async (): Promise<void> => {
    const result = await hook.preToolUse(
      makePreToolUseContext({ tool_input: { file_path: '/other/path/file.ts' } }),
    );
    expect(result.decision).toBe(DECISION_SKIP);
  });

  it('should skip when methods were already shown for this file', async (): Promise<void> => {
    mockHasExecuted.mockResolvedValueOnce(true);

    const result = await hook.preToolUse(makePreToolUseContext());
    expect(result.decision).toBe(DECISION_SKIP);
  });

  it('should skip when no templates path is found', async (): Promise<void> => {
    vi.mocked(TemplatesManagerService.findTemplatesPath).mockResolvedValueOnce(null);

    const result = await hook.preToolUse(makePreToolUseContext());
    expect(result.decision).toBe(DECISION_SKIP);
  });

  it('should allow when no scaffold methods are available', async (): Promise<void> => {
    mockExecute.mockResolvedValue(makeMethodsResult([]));

    const result = await hook.preToolUse(makePreToolUseContext());
    expect(result.decision).toBe(DECISION_ALLOW);
  });

  it('should deny and return a concise name:description list when methods are available', async (): Promise<void> => {
    mockExecute.mockResolvedValue(
      makeMethodsResult([
        { name: 'scaffold-route', description: 'Generate a new route' },
        { name: 'scaffold-component', description: 'Generate a new React component' },
      ]),
    );

    const result = await hook.preToolUse(makePreToolUseContext());

    expect(result.decision).toBe(DECISION_DENY);
    expect(result.message).toContain('- **scaffold-route**: Generate a new route');
    expect(result.message).toContain('- **scaffold-component**: Generate a new React component');
  });

  it('should not include instruction text or required variables in the message', async (): Promise<void> => {
    mockExecute.mockResolvedValue(
      makeMethodsResult([{ name: 'scaffold-route', description: 'Short description' }]),
    );

    const result = await hook.preToolUse(makePreToolUseContext());

    expect(result.message).not.toContain('Required:');
    expect(result.message).not.toContain('Instructions:');
    expect(result.message).not.toContain('Using scaffold methods ensures');
  });

  it('should include a nextCursor note when more methods are available', async (): Promise<void> => {
    mockExecute.mockResolvedValue(makeMethodsResult([{ name: 'scaffold-route' }], 'abc123'));

    const result = await hook.preToolUse(makePreToolUseContext());

    expect(result.decision).toBe(DECISION_DENY);
    expect(result.message).toContain('abc123');
  });

  it('should fall back to "No description available" for methods without a description', async (): Promise<void> => {
    mockExecute.mockResolvedValue(makeMethodsResult([{ name: 'scaffold-mystery' }]));

    const result = await hook.preToolUse(makePreToolUseContext());

    expect(result.message).toContain('- **scaffold-mystery**: No description available');
  });

  it('should skip when the tool returns an unexpected content type', async (): Promise<void> => {
    mockExecute.mockResolvedValue({ isError: false, content: [{ type: 'image' }] });

    const result = await hook.preToolUse(makePreToolUseContext());
    expect(result.decision).toBe(DECISION_SKIP);
  });

  it('should skip when the tool returns an error', async (): Promise<void> => {
    mockExecute.mockResolvedValue({
      isError: true,
      content: [{ type: 'text', text: 'Something went wrong' }],
    });

    const result = await hook.preToolUse(makePreToolUseContext());
    expect(result.decision).toBe(DECISION_SKIP);
  });

  it('should allow when the JSON response has no methods key', async (): Promise<void> => {
    mockExecute.mockResolvedValue({
      isError: false,
      content: [{ type: 'text', text: JSON.stringify({ unexpected: true }) }],
    });

    const result = await hook.preToolUse(makePreToolUseContext());
    expect(result.decision).toBe(DECISION_ALLOW);
  });

  it('should skip when the JSON text is malformed', async (): Promise<void> => {
    mockExecute.mockResolvedValue({
      isError: false,
      content: [{ type: 'text', text: 'not-json{{{' }],
    });

    const result = await hook.preToolUse(makePreToolUseContext());
    expect(result.decision).toBe(DECISION_SKIP);
  });

  it('should fail open on unexpected errors', async (): Promise<void> => {
    mockExecute.mockRejectedValue(new Error('Unexpected failure'));

    const result = await hook.preToolUse(makePreToolUseContext());
    expect(result.decision).toBe(DECISION_SKIP);
    expect(result.message).toContain('Unexpected failure');
  });
});
