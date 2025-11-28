/**
 * CodingAgentService Tests
 *
 * TESTING PATTERNS:
 * - Unit tests with mocked dependencies
 * - Test each method independently
 * - Cover success cases, edge cases, and error handling
 *
 * CODING STANDARDS:
 * - Use descriptive test names (should...)
 * - Arrange-Act-Assert pattern
 * - Mock external dependencies
 * - Test behavior, not implementation
 */

import {
  CLAUDE_CODE,
  CODEX,
  CURSOR,
  GEMINI_CLI,
  GITHUB_COPILOT,
  NONE,
} from '@agiflowai/coding-agent-bridge';
import * as fsHelpers from '@agiflowai/aicode-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CodingAgentService } from '../../src/services/CodingAgentService';

// Mock dependencies
vi.mock('@agiflowai/aicode-utils', async () => {
  const actual = await vi.importActual('@agiflowai/aicode-utils');
  return {
    ...actual,
    pathExists: vi.fn(),
    ensureDir: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
  };
});

vi.mock('@agiflowai/coding-agent-bridge', () => ({
  CLAUDE_CODE: 'claude-code',
  CODEX: 'codex',
  CURSOR: 'cursor',
  GEMINI_CLI: 'gemini-cli',
  GITHUB_COPILOT: 'github-copilot',
  NONE: 'none',
  ClaudeCodeService: vi.fn().mockImplementation(() => ({
    isEnabled: vi.fn().mockResolvedValue(true),
    updateMcpSettings: vi.fn().mockResolvedValue(undefined),
  })),
  CodexService: vi.fn().mockImplementation(() => ({
    isEnabled: vi.fn().mockResolvedValue(false),
    updateMcpSettings: vi.fn().mockResolvedValue(undefined),
  })),
  CursorService: vi.fn().mockImplementation(() => ({
    isEnabled: vi.fn().mockResolvedValue(false),
    updateMcpSettings: vi.fn().mockResolvedValue(undefined),
  })),
  GeminiCliService: vi.fn().mockImplementation(() => ({
    isEnabled: vi.fn().mockResolvedValue(false),
    updateMcpSettings: vi.fn().mockResolvedValue(undefined),
  })),
  GitHubCopilotService: vi.fn().mockImplementation(() => ({
    isEnabled: vi.fn().mockResolvedValue(false),
    updateMcpSettings: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('CodingAgentService', () => {
  const workspaceRoot = '/test/workspace';
  let service: CodingAgentService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CodingAgentService(workspaceRoot);
  });

  describe('getAvailableAgents', () => {
    it('should return list of available agents', () => {
      const agents = CodingAgentService.getAvailableAgents();

      expect(agents).toHaveLength(6);
      expect(agents.map((a) => a.value)).toContain(CLAUDE_CODE);
      expect(agents.map((a) => a.value)).toContain(CURSOR);
      expect(agents.map((a) => a.value)).toContain(GITHUB_COPILOT);
      expect(agents.map((a) => a.value)).toContain(CODEX);
      expect(agents.map((a) => a.value)).toContain(GEMINI_CLI);
      expect(agents.map((a) => a.value)).toContain(NONE);
    });

    it('should return agents with name and description', () => {
      const agents = CodingAgentService.getAvailableAgents();

      agents.forEach((agent) => {
        expect(agent.name).toBeDefined();
        expect(agent.value).toBeDefined();
        expect(agent.description).toBeDefined();
      });
    });
  });

  describe('setupMCP', () => {
    it('should skip setup for NONE agent', async () => {
      await service.setupMCP(NONE);

      expect(fsHelpers.ensureDir).not.toHaveBeenCalled();
      expect(fsHelpers.writeFile).not.toHaveBeenCalled();
    });

    it('should setup MCP for Claude Code', async () => {
      vi.mocked(fsHelpers.pathExists).mockResolvedValue(false);
      vi.mocked(fsHelpers.writeFile).mockResolvedValue(undefined);

      await expect(service.setupMCP(CLAUDE_CODE)).resolves.not.toThrow();
    });

    it('should setup MCP for Codex', async () => {
      vi.mocked(fsHelpers.pathExists).mockResolvedValue(false);
      vi.mocked(fsHelpers.writeFile).mockResolvedValue(undefined);

      await expect(service.setupMCP(CODEX)).resolves.not.toThrow();
    });

    it('should setup MCP for Gemini CLI', async () => {
      vi.mocked(fsHelpers.pathExists).mockResolvedValue(false);
      vi.mocked(fsHelpers.writeFile).mockResolvedValue(undefined);

      await expect(service.setupMCP(GEMINI_CLI)).resolves.not.toThrow();
    });

    it('should print message for unsupported agents', async () => {
      await expect(service.setupMCP(CURSOR)).resolves.not.toThrow();
    });
  });

  describe('detectCodingAgent', () => {
    it('should detect Claude Code when indicators exist', async () => {
      const result = await CodingAgentService.detectCodingAgent(workspaceRoot);
      // The mock ClaudeCodeService always returns isEnabled = true
      expect(result).toBe(CLAUDE_CODE);
    });
  });
});
