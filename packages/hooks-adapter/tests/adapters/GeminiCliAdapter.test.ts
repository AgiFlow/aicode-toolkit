/**
 * Tests for GeminiCliAdapter
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Chance from 'chance';
import { GeminiCliAdapter } from '../../src/adapters/GeminiCliAdapter';

/** Seeded random generator for reproducible tests */
const chance: Chance.Chance = new Chance(12345);

/** Expected output structure from GeminiCliAdapter.formatOutput */
interface GeminiCliOutput {
  decision: 'ALLOW' | 'DENY' | 'ASK_USER';
  message?: string;
  updatedInput?: Record<string, unknown>;
}

/** Input response structure for formatOutput */
interface HookResponse {
  decision: 'allow' | 'deny' | 'ask' | 'skip';
  message: string;
  updatedInput?: Record<string, unknown>;
}

/** Helper to generate random file path */
function generateFilePath(): string {
  return `/${chance.word()}/${chance.word()}.ts`;
}

/** Helper to generate random session ID */
function generateSessionId(): string {
  return `session-${chance.guid()}`;
}

/** Helper to generate random cwd */
function generateCwd(): string {
  return `/${chance.word()}`;
}

describe('GeminiCliAdapter', () => {
  let adapter: GeminiCliAdapter;

  beforeEach(() => {
    adapter = new GeminiCliAdapter();
  });

  describe('parseInput', () => {
    it('should parse Gemini CLI stdin format with all fields', () => {
      const toolName = chance.word();
      const filePath = generateFilePath();
      const sessionId = generateSessionId();
      const cwd = generateCwd();

      const input = JSON.stringify({
        tool_name: toolName,
        tool_input: { file_path: filePath, limit: 100 },
        cwd,
        session_id: sessionId,
        event: 'BeforeTool',
        llm_tool: 'gemini-cli',
      });

      const context = adapter.parseInput(input);

      expect(context.tool_name).toBe(toolName);
      expect(context.tool_input).toEqual({ file_path: filePath, limit: 100 });
      expect(context.cwd).toBe(cwd);
      expect(context.session_id).toBe(sessionId);
      expect(context.event).toBe('BeforeTool');
      expect(context.llm_tool).toBe('gemini-cli');
    });

    it.each([
      ['Write', { file_path: generateFilePath(), content: chance.sentence() }],
      [
        'Edit',
        { file_path: generateFilePath(), old_string: chance.word(), new_string: chance.word() },
      ],
      ['Read', { file_path: generateFilePath() }],
    ])('should parse %s tool correctly', (toolName, toolInput) => {
      const input = JSON.stringify({
        tool_name: toolName,
        tool_input: toolInput,
        cwd: generateCwd(),
        session_id: generateSessionId(),
        event: 'BeforeTool',
      });

      const context = adapter.parseInput(input);

      expect(context.tool_name).toBe(toolName);
      expect(context.tool_input).toEqual(toolInput);
    });

    it('should parse non-file tools correctly', () => {
      const command = chance.sentence();
      const cwd = generateCwd();
      const sessionId = generateSessionId();

      const input = JSON.stringify({
        tool_name: 'Bash',
        tool_input: { command },
        cwd,
        session_id: sessionId,
        event: 'BeforeTool',
      });

      const context = adapter.parseInput(input);

      expect(context.tool_name).toBe('Bash');
      expect(context.tool_input).toEqual({ command });
    });

    it('should handle missing optional llm_tool field', () => {
      const input = JSON.stringify({
        tool_name: chance.word(),
        tool_input: { file_path: generateFilePath() },
        cwd: generateCwd(),
        session_id: generateSessionId(),
        event: 'AfterTool',
      });

      const context = adapter.parseInput(input);

      expect(context.llm_tool).toBeUndefined();
    });

    it.each(['BeforeTool', 'AfterTool', 'BeforeModel', 'AfterModel'] as const)(
      'should parse %s event correctly',
      (event) => {
        const input = JSON.stringify({
          tool_name: chance.word(),
          tool_input: { file_path: generateFilePath() },
          cwd: generateCwd(),
          session_id: generateSessionId(),
          event,
        });

        const context = adapter.parseInput(input);

        expect(context.event).toBe(event);
      },
    );

    it('should throw SyntaxError on invalid JSON', () => {
      const invalidJson = chance.sentence();
      expect(() => adapter.parseInput(invalidJson)).toThrow(SyntaxError);
    });

    it('should throw SyntaxError on empty input', () => {
      expect(() => adapter.parseInput('')).toThrow(SyntaxError);
    });

    it('should return undefined fields when given empty object input', () => {
      const input = JSON.stringify({});
      const context = adapter.parseInput(input);

      // Empty object is valid JSON, fields will be undefined
      expect(context.tool_name).toBeUndefined();
      expect(context.tool_input).toBeUndefined();
    });

    it('should handle null tool_input gracefully', () => {
      const input = JSON.stringify({
        tool_name: chance.word(),
        tool_input: null,
        cwd: generateCwd(),
        session_id: generateSessionId(),
        event: 'BeforeTool',
      });

      const context = adapter.parseInput(input);

      expect(context.tool_input).toBeNull();
    });
  });

  describe('formatOutput', () => {
    it('should format allow decision as ALLOW', () => {
      const message = chance.sentence();
      const response: HookResponse = {
        decision: 'allow',
        message,
      };

      const output = adapter.formatOutput(response);
      const parsed = JSON.parse(output) as GeminiCliOutput;

      expect(parsed.decision).toBe('ALLOW');
      expect(parsed.message).toBe(message);
    });

    it('should format deny decision as DENY', () => {
      const message = chance.sentence();
      const response: HookResponse = {
        decision: 'deny',
        message,
      };

      const output = adapter.formatOutput(response);
      const parsed = JSON.parse(output) as GeminiCliOutput;

      expect(parsed.decision).toBe('DENY');
      expect(parsed.message).toBe(message);
    });

    it('should format ask decision as ASK_USER', () => {
      const message = chance.sentence();
      const response: HookResponse = {
        decision: 'ask',
        message,
      };

      const output = adapter.formatOutput(response);
      const parsed = JSON.parse(output) as GeminiCliOutput;

      expect(parsed.decision).toBe('ASK_USER');
      expect(parsed.message).toBe(message);
    });

    it('should format skip decision as ALLOW without message', () => {
      const response: HookResponse = {
        decision: 'skip',
        message: chance.sentence(),
      };

      const output = adapter.formatOutput(response);
      const parsed = JSON.parse(output) as GeminiCliOutput;

      expect(parsed.decision).toBe('ALLOW');
      expect(parsed.message).toBeUndefined();
    });

    it('should include updatedInput when provided', () => {
      const updatedInput = { file_path: generateFilePath(), content: chance.sentence() };
      const response: HookResponse = {
        decision: 'allow',
        message: chance.sentence(),
        updatedInput,
      };

      const output = adapter.formatOutput(response);
      const parsed = JSON.parse(output) as GeminiCliOutput;

      expect(parsed.updatedInput).toEqual(updatedInput);
    });

    it('should exclude updatedInput when not provided', () => {
      const response: HookResponse = {
        decision: 'allow',
        message: chance.sentence(),
      };

      const output = adapter.formatOutput(response);
      const parsed = JSON.parse(output) as GeminiCliOutput;

      expect(parsed.updatedInput).toBeUndefined();
    });

    it('should exclude message when empty string provided', () => {
      const response: HookResponse = {
        decision: 'allow',
        message: '',
      };

      const output = adapter.formatOutput(response);
      const parsed = JSON.parse(output) as GeminiCliOutput;

      expect(parsed.message).toBeUndefined();
    });

    it('should default to ALLOW for unknown decision values', () => {
      // Intentionally testing edge case with invalid decision value
      // Using type cast to simulate runtime scenario where invalid data is received
      const response = {
        decision: 'unknown',
        message: chance.sentence(),
      } as unknown as HookResponse;

      const output = adapter.formatOutput(response);
      const parsed = JSON.parse(output) as GeminiCliOutput;

      // Unknown decisions default to ALLOW for fail-safe behavior
      expect(parsed.decision).toBe('ALLOW');
    });
  });
});
