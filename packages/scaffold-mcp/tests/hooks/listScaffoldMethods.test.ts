import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { HookContext } from '@agiflowai/hooks-adapter';
import { ExecutionLogService, DECISION_ALLOW, DECISION_SKIP } from '@agiflowai/hooks-adapter';
import { postToolUseHook } from '../../src/hooks/claudeCode/listScaffoldMethods';

describe('listScaffoldMethods postToolUseHook', () => {
  const sessionId = 'test-session-123';

  beforeEach(async () => {
    // Clear execution log before each test
    await ExecutionLogService.clearLog();
  });

  afterEach(async () => {
    // Clean up after tests
    await ExecutionLogService.clearLog();
  });

  it('should skip if not a file edit/write operation', async () => {
    const context: HookContext = {
      toolName: 'Read',
      toolInput: {},
      filePath: '/test/file.ts',
      operation: 'read',
      cwd: '/test',
      sessionId,
    };

    const result = await postToolUseHook(context);

    expect(result.decision).toBe(DECISION_SKIP);
    expect(result.message).toBe('Not a file edit/write operation');
  });

  it('should skip if no filePath is provided', async () => {
    const context: HookContext = {
      toolName: 'Edit',
      toolInput: {},
      operation: 'edit',
      cwd: '/test',
      sessionId,
    };

    const result = await postToolUseHook(context);

    expect(result.decision).toBe(DECISION_SKIP);
    expect(result.message).toBe('Not a file edit/write operation');
  });

  it('should skip if no scaffold execution found', async () => {
    const context: HookContext = {
      toolName: 'Edit',
      toolInput: {},
      filePath: '/test/file.ts',
      operation: 'edit',
      cwd: '/test',
      sessionId,
    };

    const result = await postToolUseHook(context);

    expect(result.decision).toBe(DECISION_SKIP);
    expect(result.message).toBe('No scaffold execution found');
  });

  it('should track file edit when file is from scaffold', async () => {
    const generatedFiles = ['/test/file1.ts', '/test/file2.ts', '/test/file3.ts'];

    // Log a scaffold execution
    await ExecutionLogService.logExecution({
      sessionId,
      filePath: '/test/project',
      operation: 'scaffold',
      decision: DECISION_ALLOW,
      generatedFiles,
    });

    // Edit one of the generated files
    const context: HookContext = {
      toolName: 'Edit',
      toolInput: {},
      filePath: '/test/file1.ts',
      operation: 'edit',
      cwd: '/test',
      sessionId,
    };

    const result = await postToolUseHook(context);

    expect(result.decision).toBe(DECISION_ALLOW);
    expect(result.message).toContain('Scaffold Implementation Progress: 1/3 files completed');
    expect(result.message).toContain('/test/file2.ts');
    expect(result.message).toContain('/test/file3.ts');
  });

  it('should skip if edited file is not from scaffold', async () => {
    const generatedFiles = ['/test/file1.ts', '/test/file2.ts'];

    // Log a scaffold execution
    await ExecutionLogService.logExecution({
      sessionId,
      filePath: '/test/project',
      operation: 'scaffold',
      decision: DECISION_ALLOW,
      generatedFiles,
    });

    // Edit a different file
    const context: HookContext = {
      toolName: 'Edit',
      toolInput: {},
      filePath: '/test/other-file.ts',
      operation: 'edit',
      cwd: '/test',
      sessionId,
    };

    const result = await postToolUseHook(context);

    expect(result.decision).toBe(DECISION_SKIP);
    expect(result.message).toBe('Edited file not part of last scaffold execution');
  });

  it('should mark scaffold as fulfilled when all files are edited', async () => {
    const generatedFiles = ['/test/file1.ts', '/test/file2.ts'];

    // Log a scaffold execution
    await ExecutionLogService.logExecution({
      sessionId,
      filePath: '/test/project',
      operation: 'scaffold',
      decision: DECISION_ALLOW,
      generatedFiles,
    });

    // Edit first file
    let context: HookContext = {
      toolName: 'Edit',
      toolInput: {},
      filePath: '/test/file1.ts',
      operation: 'edit',
      cwd: '/test',
      sessionId,
    };

    let result = await postToolUseHook(context);
    expect(result.decision).toBe(DECISION_ALLOW);
    expect(result.message).toContain('1/2 files completed');

    // Edit second file
    context = {
      toolName: 'Edit',
      toolInput: {},
      filePath: '/test/file2.ts',
      operation: 'edit',
      cwd: '/test',
      sessionId,
    };

    result = await postToolUseHook(context);
    expect(result.decision).toBe(DECISION_ALLOW);
    expect(result.message).toContain('All scaffold files have been implemented!');
    expect(result.message).toContain('2/2 files completed');
  });

  it('should skip if scaffold is already fulfilled', async () => {
    const generatedFiles = ['/test/file1.ts'];

    // Log a scaffold execution
    await ExecutionLogService.logExecution({
      sessionId,
      filePath: '/test/project',
      operation: 'scaffold',
      decision: DECISION_ALLOW,
      generatedFiles,
    });

    // Mark scaffold as fulfilled
    await ExecutionLogService.logExecution({
      sessionId,
      filePath: 'scaffold-fulfilled-/test/project',
      operation: 'scaffold-fulfilled',
      decision: DECISION_ALLOW,
    });

    // Try to edit a file
    const context: HookContext = {
      toolName: 'Edit',
      toolInput: {},
      filePath: '/test/file1.ts',
      operation: 'edit',
      cwd: '/test',
      sessionId,
    };

    const result = await postToolUseHook(context);

    expect(result.decision).toBe(DECISION_SKIP);
    expect(result.message).toBe('Scaffold already fulfilled');
  });

  it('should not double-track the same file edit', async () => {
    const generatedFiles = ['/test/file1.ts', '/test/file2.ts'];

    // Log a scaffold execution
    await ExecutionLogService.logExecution({
      sessionId,
      filePath: '/test/project',
      operation: 'scaffold',
      decision: DECISION_ALLOW,
      generatedFiles,
    });

    // Edit same file twice
    const context: HookContext = {
      toolName: 'Edit',
      toolInput: {},
      filePath: '/test/file1.ts',
      operation: 'edit',
      cwd: '/test',
      sessionId,
    };

    const result1 = await postToolUseHook(context);
    expect(result1.decision).toBe(DECISION_ALLOW);
    expect(result1.message).toContain('1/2 files completed');

    const result2 = await postToolUseHook(context);
    expect(result2.decision).toBe(DECISION_ALLOW);
    expect(result2.message).toContain('1/2 files completed'); // Still 1/2, not 2/2
  });

  it('should handle Write operations same as Edit', async () => {
    const generatedFiles = ['/test/file1.ts'];

    // Log a scaffold execution
    await ExecutionLogService.logExecution({
      sessionId,
      filePath: '/test/project',
      operation: 'scaffold',
      decision: DECISION_ALLOW,
      generatedFiles,
    });

    // Write to the file
    const context: HookContext = {
      toolName: 'Write',
      toolInput: {},
      filePath: '/test/file1.ts',
      operation: 'write',
      cwd: '/test',
      sessionId,
    };

    const result = await postToolUseHook(context);

    expect(result.decision).toBe(DECISION_ALLOW);
    expect(result.message).toContain('All scaffold files have been implemented!');
  });

  it('should handle errors gracefully', async () => {
    // Create a context that might cause errors
    const context: HookContext = {
      toolName: 'Edit',
      toolInput: {},
      filePath: '/test/file.ts',
      operation: 'edit',
      cwd: '/test',
      sessionId: '', // Empty session ID might cause issues
    };

    const result = await postToolUseHook(context);

    // Should fail open with SKIP decision
    expect(result.decision).toBe(DECISION_SKIP);
  });

  it('should only use the last scaffold execution', async () => {
    // First scaffold execution
    await ExecutionLogService.logExecution({
      sessionId,
      filePath: '/test/project1',
      operation: 'scaffold',
      decision: DECISION_ALLOW,
      generatedFiles: ['/test/old-file.ts'],
    });

    // Second scaffold execution (this should be the one used)
    await ExecutionLogService.logExecution({
      sessionId,
      filePath: '/test/project2',
      operation: 'scaffold',
      decision: DECISION_ALLOW,
      generatedFiles: ['/test/new-file.ts'],
    });

    // Edit file from first scaffold - should skip because it's not in last scaffold
    let context: HookContext = {
      toolName: 'Edit',
      toolInput: {},
      filePath: '/test/old-file.ts',
      operation: 'edit',
      cwd: '/test',
      sessionId,
    };

    let result = await postToolUseHook(context);
    expect(result.decision).toBe(DECISION_SKIP);
    expect(result.message).toBe('Edited file not part of last scaffold execution');

    // Edit file from second scaffold - should track
    context = {
      toolName: 'Edit',
      toolInput: {},
      filePath: '/test/new-file.ts',
      operation: 'edit',
      cwd: '/test',
      sessionId,
    };

    result = await postToolUseHook(context);
    expect(result.decision).toBe(DECISION_ALLOW);
    expect(result.message).toContain('All scaffold files have been implemented!');
  });
});
