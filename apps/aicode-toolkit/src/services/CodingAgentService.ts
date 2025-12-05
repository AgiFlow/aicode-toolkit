/**
 * CodingAgentService
 *
 * DESIGN PATTERNS:
 * - Service pattern for business logic encapsulation
 * - Strategy pattern for different agent configurations
 * - Single responsibility: Handle MCP setup for coding agents
 *
 * CODING STANDARDS:
 * - Use async/await for asynchronous operations
 * - Throw descriptive errors for error cases
 * - Document methods with JSDoc comments
 *
 * AVOID:
 * - Direct UI interaction (no prompts in services)
 * - Hard-coding agent configurations (use strategies)
 */

import {
  CLAUDE_CODE,
  CODEX,
  CURSOR,
  GEMINI_CLI,
  GITHUB_COPILOT,
  NONE,
  ClaudeCodeService,
  CodexService,
  CursorService,
  GeminiCliService,
  GitHubCopilotService,
  type CodingAgentId,
} from '@agiflowai/coding-agent-bridge';
import { print } from '@agiflowai/aicode-utils';

// Re-export the type for convenience
export type CodingAgent = CodingAgentId;

export class CodingAgentService {
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Detect which coding agent is enabled in the workspace
   * Checks for Claude Code, Codex, Gemini CLI, GitHub Copilot, and Cursor installations
   * @param workspaceRoot - The workspace root directory
   * @returns Promise resolving to detected agent ID or null
   */
  static async detectCodingAgent(workspaceRoot: string): Promise<CodingAgent | null> {
    // Check for Claude Code
    const claudeCodeService = new ClaudeCodeService({ workspaceRoot });
    const isClaudeCodeEnabled = await claudeCodeService.isEnabled();

    if (isClaudeCodeEnabled) {
      return CLAUDE_CODE;
    }

    // Check for Cursor
    const cursorService = new CursorService({ workspaceRoot });
    const isCursorEnabled = await cursorService.isEnabled();

    if (isCursorEnabled) {
      return CURSOR;
    }

    // Check for GitHub Copilot
    const githubCopilotService = new GitHubCopilotService({ workspaceRoot });
    const isGitHubCopilotEnabled = await githubCopilotService.isEnabled();

    if (isGitHubCopilotEnabled) {
      return GITHUB_COPILOT;
    }

    // Check for Codex
    const codexService = new CodexService({ workspaceRoot });
    const isCodexEnabled = await codexService.isEnabled();

    if (isCodexEnabled) {
      return CODEX;
    }

    // Check for Gemini CLI
    const geminiService = new GeminiCliService({ workspaceRoot });
    const isGeminiEnabled = await geminiService.isEnabled();

    if (isGeminiEnabled) {
      return GEMINI_CLI;
    }

    return null;
  }

  /**
   * Get available coding agents with their descriptions
   */
  static getAvailableAgents(): Array<{ value: CodingAgent; name: string; description: string }> {
    return [
      {
        value: CLAUDE_CODE,
        name: 'Claude Code',
        description: 'Anthropic Claude Code CLI agent',
      },
      {
        value: CURSOR,
        name: 'Cursor',
        description: 'Cursor AI-first code editor',
      },
      {
        value: GITHUB_COPILOT,
        name: 'GitHub Copilot',
        description: 'GitHub Copilot coding agent and CLI',
      },
      {
        value: CODEX,
        name: 'Codex',
        description: 'OpenAI Codex CLI agent',
      },
      {
        value: GEMINI_CLI,
        name: 'Gemini CLI',
        description: 'Google Gemini CLI agent',
      },
      {
        value: NONE,
        name: 'Other',
        description: 'Other coding agent or skip MCP configuration',
      },
    ];
  }

  /**
   * Get the coding agent service instance
   * @param agent - The coding agent to get service for
   * @returns The service instance or null if not supported
   */
  private getCodingAgentService(
    agent: CodingAgent,
  ):
    | ClaudeCodeService
    | CodexService
    | CursorService
    | GeminiCliService
    | GitHubCopilotService
    | null {
    if (agent === CLAUDE_CODE) {
      return new ClaudeCodeService({ workspaceRoot: this.workspaceRoot });
    }
    if (agent === CURSOR) {
      return new CursorService({ workspaceRoot: this.workspaceRoot });
    }
    if (agent === GITHUB_COPILOT) {
      return new GitHubCopilotService({ workspaceRoot: this.workspaceRoot });
    }
    if (agent === CODEX) {
      return new CodexService({ workspaceRoot: this.workspaceRoot });
    }
    if (agent === GEMINI_CLI) {
      return new GeminiCliService({ workspaceRoot: this.workspaceRoot });
    }
    return null;
  }

  /**
   * Update custom instructions/prompts for the coding agent
   * Appends custom instruction prompt to the agent's configuration
   * @param agent - The coding agent to update
   * @param instructionPrompt - The instruction prompt to append
   * @param customInstructionFile - Optional custom file path to write instructions to (e.g., '.claude/aicode-instructions.md')
   */
  async updateCustomInstructions(
    agent: CodingAgent,
    instructionPrompt: string,
    customInstructionFile?: string,
  ): Promise<void> {
    if (agent === NONE) {
      print.info('Skipping custom instruction update');
      return;
    }

    print.info(`\nUpdating custom instructions for ${agent}...`);

    const service = this.getCodingAgentService(agent);

    if (!service) {
      print.info(`Custom instruction update for ${agent} is not yet supported.`);
      print.info('Please manually add the instructions to your agent configuration.');
      print.info('\nInstruction prompt to add:');
      print.info(instructionPrompt);
      return;
    }

    // Update the prompt configuration with AICODE markers
    await service.updatePrompt({
      systemPrompt: instructionPrompt,
      customInstructionFile,
      marker: true,
    });

    if (customInstructionFile) {
      print.success(
        `Custom instructions written to ${customInstructionFile} and referenced in CLAUDE.md and AGENTS.md`,
      );
    } else {
      print.success(`Custom instructions appended to CLAUDE.md and AGENTS.md`);
    }
  }

  /**
   * Setup MCP configuration for the selected coding agent
   * @param agent - The coding agent to configure
   * @param selectedMcpServers - Optional array of selected MCP servers
   */
  async setupMCP(agent: CodingAgent, selectedMcpServers?: string[]): Promise<void> {
    if (agent === NONE) {
      print.info('Skipping MCP configuration');
      return;
    }

    print.info(`\nSetting up MCP for ${agent}...`);

    // Initialize the appropriate service based on agent type
    const service = this.getCodingAgentService(agent);
    let configLocation = '';
    let restartInstructions = '';

    if (agent === CLAUDE_CODE) {
      configLocation = '.mcp.json';
      restartInstructions = 'Restart Claude Code to load the new MCP servers';
    } else if (agent === CURSOR) {
      configLocation = '~/.cursor/mcp.json (or .cursor/mcp.json for workspace)';
      restartInstructions = 'Restart Cursor to load the new MCP servers';
    } else if (agent === GITHUB_COPILOT) {
      configLocation = '~/.copilot/config.json (CLI) or GitHub UI (Coding Agent)';
      restartInstructions =
        'Restart GitHub Copilot CLI or configure via GitHub repository settings';
    } else if (agent === CODEX) {
      configLocation = '~/.codex/config.toml';
      restartInstructions = 'Restart Codex CLI to load the new MCP servers';
    } else if (agent === GEMINI_CLI) {
      configLocation = '~/.gemini/settings.json';
      restartInstructions = 'Restart Gemini CLI to load the new MCP servers';
    }

    if (!service) {
      print.info(`MCP configuration for ${agent} is not yet supported.`);
      print.info('Please configure MCP servers manually for this coding agent.');
      return;
    }

    // Check if one-mcp is selected
    const useOneMcp = selectedMcpServers?.includes('one-mcp');

    if (useOneMcp) {
      // Create mcp-config.yaml with the other selected MCP servers
      await this.createMcpConfigYaml(selectedMcpServers);

      // Configure one-mcp as the single MCP server
      const mcpServers = {
        'one-mcp': {
          type: 'stdio' as const,
          command: 'npx',
          args: ['-y', '@agiflowai/one-mcp', 'mcp-serve'],
          disabled: false,
        },
      };

      await service.updateMcpSettings({
        servers: mcpServers,
      });

      print.success(`Added one-mcp to ${configLocation}`);
      print.success('Created mcp-config.yaml with selected MCP server configurations');
    } else {
      // Build standardized MCP server configurations for individual servers
      const mcpServers: Record<
        string,
        { type: 'stdio'; command: string; args: string[]; disabled: boolean }
      > = {};

      if (selectedMcpServers?.includes('scaffold-mcp') ?? true) {
        mcpServers['scaffold-mcp'] = {
          type: 'stdio' as const,
          command: 'npx',
          args: ['-y', '@agiflowai/scaffold-mcp', 'mcp-serve'],
          disabled: false,
        };
      }

      if (selectedMcpServers?.includes('architect-mcp') ?? true) {
        mcpServers['architect-mcp'] = {
          type: 'stdio' as const,
          command: 'npx',
          args: ['-y', '@agiflowai/architect-mcp', 'mcp-serve'],
          disabled: false,
        };
      }

      // Update MCP settings using the service (each service handles its own format conversion)
      await service.updateMcpSettings({
        servers: mcpServers,
      });

      const serverNames = Object.keys(mcpServers).join(' and ');
      print.success(`Added ${serverNames} to ${configLocation}`);
    }

    print.info('\nNext steps:');
    print.indent(`1. ${restartInstructions}`);
    print.indent('2. The configured MCP servers will be available');

    print.success('\nMCP configuration completed!');
  }

  /**
   * Create mcp-config.yaml file using one-mcp init command
   * This is used when one-mcp is selected to configure which servers it should include
   * Excludes one-mcp itself from the config file
   * @param selectedMcpServers - Array of selected MCP servers
   */
  private async createMcpConfigYaml(selectedMcpServers?: string[]): Promise<void> {
    const { execSync } = await import('node:child_process');
    const path = await import('node:path');

    // Build the MCP server configurations for included servers (excluding one-mcp)
    const servers: Record<string, { command: string; args: string[] }> = {};

    // Filter out one-mcp and add the rest
    const serversToInclude = selectedMcpServers?.filter((s) => s !== 'one-mcp') ?? [];

    for (const server of serversToInclude) {
      if (server === 'scaffold-mcp') {
        servers['scaffold-mcp'] = {
          command: 'npx',
          args: ['-y', '@agiflowai/scaffold-mcp', 'mcp-serve', '--admin-enable'],
        };
      } else if (server === 'architect-mcp') {
        servers['architect-mcp'] = {
          command: 'npx',
          args: ['-y', '@agiflowai/architect-mcp', 'mcp-serve', '--admin-enable'],
        };
      }
    }

    // If no servers selected (only one-mcp), include all available servers by default
    if (Object.keys(servers).length === 0) {
      servers['scaffold-mcp'] = {
        command: 'npx',
        args: ['-y', '@agiflowai/scaffold-mcp', 'mcp-serve', '--admin-enable'],
      };
      servers['architect-mcp'] = {
        command: 'npx',
        args: ['-y', '@agiflowai/architect-mcp', 'mcp-serve', '--admin-enable'],
      };
    }

    const configPath = path.join(this.workspaceRoot, 'mcp-config.yaml');

    // Build the command with optional --mcp-servers argument
    const mcpServersJson = JSON.stringify(servers);
    const command = `npx -y @agiflowai/one-mcp init -o "${configPath}" -f --mcp-servers '${mcpServersJson}'`;

    execSync(command, {
      cwd: this.workspaceRoot,
      stdio: 'inherit',
    });
  }
}
