/**
 * GeminiCliAdapter - Adapter for Gemini CLI hook format
 *
 * DESIGN PATTERNS:
 * - Adapter pattern: Converts Gemini CLI format to normalized format
 * - Parser pattern: Extracts file paths and operations from tool inputs
 *
 * CODING STANDARDS:
 * - Parse Gemini CLI JSON stdin format exactly as specified
 * - Format output to match Gemini CLI hook response schema
 * - Handle missing/optional fields gracefully
 *
 * AVOID:
 * - Assuming all fields are present
 * - Hardcoding tool names (use constants if needed)
 * - Mutating input objects
 */

import { BaseAdapter } from './BaseAdapter';
import type { HookResponse } from '../types';
import { DECISION_ALLOW, DECISION_DENY, DECISION_ASK, DECISION_SKIP } from '../constants';
import { log } from '@agiflowai/aicode-utils';

/**
 * Gemini CLI hook input format (BeforeTool/AfterTool)
 */
export interface GeminiCliHookInput {
  tool_name: string;
  tool_input: Record<string, any>;
  cwd: string;
  session_id: string;
  event: 'BeforeTool' | 'AfterTool' | 'BeforeModel' | 'AfterModel';
  llm_tool?: string;
}

/**
 * Gemini CLI hook output format
 */
interface GeminiCliHookOutput {
  decision: 'ALLOW' | 'DENY' | 'ASK_USER';
  message?: string;
  updatedInput?: Record<string, any>;
}

/**
 * Adapter for Gemini CLI hook format
 */
export class GeminiCliAdapter extends BaseAdapter<GeminiCliHookInput> {
  /**
   * Parse Gemini CLI stdin into full hook input (preserves all fields)
   *
   * @param stdin - Raw JSON string from Gemini CLI
   * @returns Full Gemini CLI hook input
   */
  parseInput(stdin: string): GeminiCliHookInput {
    log.debug('GeminiCliAdapter.parseInput - Raw input:', stdin);

    const input = JSON.parse(stdin) as GeminiCliHookInput;

    log.debug('GeminiCliAdapter.parseInput - Parsed input:', JSON.stringify(input, null, 2));

    return input;
  }

  /**
   * Format normalized HookResponse into Gemini CLI output
   *
   * @param response - Normalized hook response
   * @returns JSON string for Gemini CLI
   */
  formatOutput(response: HookResponse): string {
    log.debug(
      'GeminiCliAdapter.formatOutput - Normalized response:',
      JSON.stringify(response, null, 2),
    );

    // If decision is 'skip', return ALLOW with no message (transparent pass-through)
    if (response.decision === DECISION_SKIP) {
      const output = JSON.stringify(
        {
          decision: 'ALLOW',
        },
        null,
        2,
      );

      log.debug('GeminiCliAdapter.formatOutput - Output (skip):', output);
      return output;
    }

    // Map our decision types to Gemini CLI format
    const decisionMap: Record<string, 'ALLOW' | 'DENY' | 'ASK_USER'> = {
      [DECISION_ALLOW]: 'ALLOW',
      [DECISION_DENY]: 'DENY',
      [DECISION_ASK]: 'ASK_USER',
    };

    const output: GeminiCliHookOutput = {
      decision: decisionMap[response.decision] || 'ALLOW',
    };

    // Add message if provided
    if (response.message) {
      output.message = response.message;
    }

    // Add updated input if provided
    if (response.updatedInput) {
      output.updatedInput = response.updatedInput;
    }

    const outputStr = JSON.stringify(output, null, 2);
    log.debug('GeminiCliAdapter.formatOutput - Output:', outputStr);

    return outputStr;
  }
}
