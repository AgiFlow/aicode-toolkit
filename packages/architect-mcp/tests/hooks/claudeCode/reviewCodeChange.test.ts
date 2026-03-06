import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockWasRecentlyReviewed = vi.fn();
const mockGetFileMetadata = vi.fn();
const mockHasFileChangedSinceLastReview = vi.fn();
const mockLogExecution = vi.fn();
const mockFindTemplateForFile = vi.fn();
const mockParseArchitectFile = vi.fn();
const mockParseGlobalArchitectFile = vi.fn();
const mockGetMatchedFilePatterns = vi.fn();
const mockReviewCodeChange = vi.fn();

vi.mock('@agiflowai/hooks-adapter', () => ({
  ExecutionLogService: class MockExecutionLogService {
    wasRecentlyReviewed = mockWasRecentlyReviewed;
    getFileMetadata = mockGetFileMetadata;
    hasFileChangedSinceLastReview = mockHasFileChangedSinceLastReview;
    logExecution = mockLogExecution;
  },
  DECISION_SKIP: 'skip',
  DECISION_DENY: 'deny',
  DECISION_ALLOW: 'allow',
}));

vi.mock('../../../src/services/TemplateFinder', () => ({
  TemplateFinder: class MockTemplateFinder {
    findTemplateForFile = mockFindTemplateForFile;
  },
}));

vi.mock('../../../src/services/ArchitectParser', () => ({
  ArchitectParser: class MockArchitectParser {
    parseArchitectFile = mockParseArchitectFile;
    parseGlobalArchitectFile = mockParseGlobalArchitectFile;
  },
}));

vi.mock('../../../src/services/PatternMatcher', () => ({
  PatternMatcher: class MockPatternMatcher {
    getMatchedFilePatterns = mockGetMatchedFilePatterns;
  },
}));

vi.mock('../../../src/services/CodeReview', () => ({
  CodeReviewService: class MockCodeReviewService {
    constructor(public readonly options?: Record<string, unknown>) {}
    reviewCodeChange = mockReviewCodeChange;
  },
}));

vi.mock('@agiflowai/coding-agent-bridge', () => ({
  isValidLlmTool: (value: string) => ['claude-code', 'gemini-cli', 'codex'].includes(value),
}));

import { ReviewCodeChangeHook } from '../../../src/hooks/claudeCode/reviewCodeChange';

describe('ReviewCodeChangeHook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWasRecentlyReviewed.mockResolvedValue(false);
    mockGetFileMetadata.mockResolvedValue({ mtime: 123, checksum: 'abc' });
    mockHasFileChangedSinceLastReview.mockResolvedValue(true);
    mockLogExecution.mockResolvedValue(undefined);
    mockFindTemplateForFile.mockResolvedValue({
      templatePath: '/mock/template',
      projectPath: '/mock/project',
    });
    mockParseArchitectFile.mockResolvedValue({ features: [] });
    mockParseGlobalArchitectFile.mockResolvedValue({ features: [] });
    mockGetMatchedFilePatterns.mockReturnValue('src/**/*.ts');
    mockReviewCodeChange.mockResolvedValue({
      file_path: '/test/file.ts',
      feedback: 'Rules provided for agent review. LLM-based review not enabled.',
      fix_required: false,
      identified_issues: [],
      rules: {
        pattern: 'src/**/*.ts',
        description: 'TypeScript rules',
        must_do: [{ rule: 'Use named exports' }],
        should_do: [{ rule: 'Add tests' }],
        must_not_do: [{ rule: 'Do not use default exports' }],
      },
    });
  });

  it('returns compact rule guidance without implicit Claude fallback', async () => {
    const hook = new ReviewCodeChangeHook();
    const result = await hook.postToolUse({
      hook_event_name: 'PostToolUse',
      session_id: 'session-123',
      tool_name: 'Write',
      tool_input: { file_path: '/test/file.ts' },
      cwd: '/test',
    } as any);

    expect(mockReviewCodeChange).toHaveBeenCalledWith('/test/file.ts');
    expect(result.decision).toBe('allow');
    expect(result.message).toContain('LLM review is disabled for this hook');
    expect(result.message).toContain('Use named exports');
    expect(mockHasFileChangedSinceLastReview).toHaveBeenCalledWith('/test/file.ts');
  });

  it('skips non-mutating file tools', async () => {
    const hook = new ReviewCodeChangeHook();
    const result = await hook.postToolUse({
      hook_event_name: 'PostToolUse',
      session_id: 'session-123',
      tool_name: 'Read',
      tool_input: { file_path: '/test/file.ts' },
      cwd: '/test',
    } as any);

    expect(result.decision).toBe('skip');
    expect(mockReviewCodeChange).not.toHaveBeenCalled();
  });
});
