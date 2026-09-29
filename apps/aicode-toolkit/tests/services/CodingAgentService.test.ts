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
import { execFileSync } from 'node:child_process';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CodingAgentService } from '../../src/services/CodingAgentService';

const { updateMcpSettings } = vi.hoisted(() => ({ updateMcpSettings: vi.fn() }));

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

vi.mock('@agiflowai/coding-agent-bridge', () => {
  // Create mock classes that can be instantiated with 'new'
  const MockClaudeCodeService = class {
    isEnabled = vi.fn().mockResolvedValue(true);
    updateMcpSettings = updateMcpSettings;
  };

  const MockCodexService = class {
    isEnabled = vi.fn().mockResolvedValue(false);
    updateMcpSettings = updateMcpSettings;
  };

  const MockCursorService = class {
    isEnabled = vi.fn().mockResolvedValue(false);
    updateMcpSettings = updateMcpSettings;
  };

  const MockGeminiCliService = class {
    isEnabled = vi.fn().mockResolvedValue(false);
    updateMcpSettings = updateMcpSettings;
  };

  const MockGitHubCopilotService = class {
    isEnabled = vi.fn().mockResolvedValue(false);
    updateMcpSettings = updateMcpSettings;
  };

  return {
    CLAUDE_CODE: 'claude-code',
    CODEX: 'codex',
    CURSOR: 'cursor',
    GEMINI_CLI: 'gemini-cli',
    GITHUB_COPILOT: 'github-copilot',
    NONE: 'none',
    ClaudeCodeService: MockClaudeCodeService,
    CodexService: MockCodexService,
    CursorService: MockCursorService,
    GeminiCliService: MockGeminiCliService,
    GitHubCopilotService: MockGitHubCopilotService,
  };
});

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

describe('CodingAgentService', () => {
  const workspaceRoot = '/test/workspace';
  let service: CodingAgentService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fsHelpers.pathExists).mockResolvedValue(false);
    vi.mocked(fsHelpers.ensureDir).mockResolvedValue(undefined);
    vi.mocked(fsHelpers.writeFile).mockResolvedValue(undefined);
    updateMcpSettings.mockResolvedValue(undefined);
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

    it('installs the scaffolding CLI skill without registering a scaffold MCP server', async () => {
      await service.setupMCP(CLAUDE_CODE);

      expect(fsHelpers.writeFile).toHaveBeenCalledWith(
        '/test/workspace/.claude/skills/scaffolding/SKILL.md',
        expect.stringContaining('scaffold-mcp@2.0.0 boilerplate list'),
      );
      expect(updateMcpSettings).toHaveBeenCalledWith({
        servers: {
          'architect-mcp': expect.any(Object),
        },
      });
    });

    it('preserves an existing scaffolding skill and registers no empty MCP configuration', async () => {
      vi.mocked(fsHelpers.pathExists).mockResolvedValue(true);

      await service.setupMCP(CLAUDE_CODE, ['scaffold-mcp']);

      expect(fsHelpers.writeFile).not.toHaveBeenCalled();
      expect(updateMcpSettings).not.toHaveBeenCalled();
    });

    it('keeps scaffold CLI out of the default one-mcp upstream list', async () => {
      await service.setupMCP(CLAUDE_CODE, ['one-mcp']);

      const args = vi.mocked(execFileSync).mock.calls[0]?.[1] as string[];
      const servers = JSON.parse(args[args.indexOf('--mcp-servers') + 1]);
      expect(servers).not.toHaveProperty('scaffold-mcp');
      expect(servers).toHaveProperty('architect-mcp');
      expect(fsHelpers.writeFile).toHaveBeenCalled();
    });

    it('reports a skill write failure instead of installing partial MCP settings', async () => {
      vi.mocked(fsHelpers.writeFile).mockRejectedValueOnce(new Error('permission denied'));

      await expect(service.setupMCP(CLAUDE_CODE)).rejects.toThrow('permission denied');
      expect(updateMcpSettings).not.toHaveBeenCalled();
    });

    it('should create one-mcp config using explicit npx package execution', async () => {
      vi.mocked(fsHelpers.pathExists).mockResolvedValue(false);
      vi.mocked(fsHelpers.writeFile).mockResolvedValue(undefined);

      await expect(
        service.setupMCP(CLAUDE_CODE, ['one-mcp', 'architect-mcp']),
      ).resolves.not.toThrow();

      expect(execFileSync).toHaveBeenCalledWith(
        'npx',
        [
          '--yes',
          '--package',
          '@agiflowai/one-mcp',
          'one-mcp',
          'init',
          '-o',
          '/test/workspace/mcp-config.yaml',
          '-f',
          '--mcp-servers',
          JSON.stringify({
            'architect-mcp': {
              command: 'npx',
              args: ['-y', '@agiflowai/architect-mcp', 'mcp-serve', '--admin-enable'],
            },
          }),
        ],
        {
          cwd: workspaceRoot,
          stdio: 'inherit',
        },
      );
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
