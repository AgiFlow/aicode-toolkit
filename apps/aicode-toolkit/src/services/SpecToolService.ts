/**
 * Spec Tool Service
 *
 * DESIGN PATTERNS:
 * - Service pattern for spec tool detection and installation
 * - Bridge pattern to abstract spec tool implementations
 *
 * CODING STANDARDS:
 * - Use async/await for asynchronous operations
 * - Handle errors with try/catch blocks
 * - Use descriptive method names
 */

import { print } from '@agiflowai/aicode-utils';
import { OpenSpecBridge } from '../specs/openspec';
import type { EnabledMcps, ISpecBridge } from '../specs/types';
import type { CodingAgent, CodingAgentService } from './CodingAgentService';

// Re-export for convenience
export type { EnabledMcps } from '../specs/types';

/**
 * Available spec tools
 */
export enum SpecTool {
  OPENSPEC = 'openspec',
}

/**
 * Spec tool information
 */
export const SPEC_TOOL_INFO = {
  [SpecTool.OPENSPEC]: {
    name: 'OpenSpec',
    description: 'Spec-driven development for AI coding assistants',
    docUrl: 'https://github.com/Fission-AI/OpenSpec',
  },
} as const;

/**
 * Service for managing spec tools (e.g., OpenSpec)
 *
 * This service acts as a facade for spec tool operations, using bridge
 * implementations to interact with specific spec tools.
 */
export class SpecToolService {
  private readonly bridge: ISpecBridge;

  constructor(
    private readonly workspaceRoot: string,
    specTool: SpecTool = SpecTool.OPENSPEC,
    private readonly codingAgentService?: CodingAgentService,
  ) {
    // Initialize the appropriate bridge based on spec tool type
    this.bridge = this.createBridge(specTool);
  }

  /**
   * Create a bridge instance for the specified spec tool
   */
  private createBridge(specTool: SpecTool): ISpecBridge {
    switch (specTool) {
      case SpecTool.OPENSPEC:
        return new OpenSpecBridge();
      default:
        throw new Error(`Unsupported spec tool: ${String(specTool)}`);
    }
  }

  /**
   * Detect if a spec tool is installed in the workspace
   */
  async detectSpecTool(): Promise<SpecTool | null> {
    try {
      const isEnabled = await this.bridge.isEnabled(this.workspaceRoot);
      return isEnabled ? SpecTool.OPENSPEC : null;
    } catch (error) {
      print.error(`Error detecting spec tool: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Initialize the spec tool in the workspace
   */
  async initializeSpec(): Promise<void> {
    await this.bridge.initialize(this.workspaceRoot);
  }

  /**
   * Update spec tool agent instructions
   *
   * Generates instruction prompt and updates the coding agent's custom instructions
   *
   * @param enabledMcps - Configuration of which MCP servers are enabled
   * @param codingAgent - The coding agent to update instructions for
   * @param customInstructionFile - Optional custom file to write instructions to (e.g., '.claude/aicode-instructions.md')
   * @returns Promise resolving to the instruction prompt string
   */
  async updateInstructions(
    enabledMcps: EnabledMcps,
    codingAgent?: CodingAgent,
    customInstructionFile?: string,
  ): Promise<string> {
    const prompt = await this.bridge.updateInstruction(enabledMcps);

    // If coding agent service and agent are provided, update custom instructions
    if (this.codingAgentService && codingAgent) {
      await this.codingAgentService.updateCustomInstructions(
        codingAgent,
        prompt,
        customInstructionFile ?? '.claude/aicode-instructions.md',
      );
    } else {
      // Otherwise, just display the prompt for manual addition
      print.info('\nGenerated OpenSpec instruction prompt:');
      print.info('\nYou can append this to your CLAUDE.md or agent config file:');
      print.info(`\n${prompt}`);
    }

    return prompt;
  }
}
