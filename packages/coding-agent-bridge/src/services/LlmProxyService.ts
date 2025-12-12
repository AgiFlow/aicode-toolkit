/**
 * LlmProxyService
 *
 * DESIGN PATTERNS:
 * - Proxy pattern: Provides a unified interface for multiple LLM backends
 * - Factory pattern: Creates appropriate service based on tool type
 * - Strategy pattern: Delegates to specific service implementation
 *
 * CODING STANDARDS:
 * - Service class names use PascalCase with 'Service' suffix
 * - Method names use camelCase with descriptive verbs
 * - Return types should be explicit (never use implicit any)
 * - Use async/await for asynchronous operations
 *
 * AVOID:
 * - Direct coupling to specific service implementations outside factory
 * - Exposing internal service instances
 */

import {
  type LlmToolId,
  LLM_TOOL_CLAUDE_CODE,
  LLM_TOOL_CODEX,
  LLM_TOOL_GEMINI_CLI,
  LLM_TOOL_GITHUB_COPILOT,
  isValidLlmTool,
  LlmToolConfig,
} from '../constants/llmTools';
import type { CodingAgentService, LlmInvocationParams, LlmInvocationResponse } from '../types';
import { ClaudeCodeService } from './ClaudeCodeService';
import { CodexService } from './CodexService';
import { GeminiCliService } from './GeminiCliService';
import { GitHubCopilotService } from './GitHubCopilotService';

interface LlmProxyServiceOptions {
  /** The LLM tool to use */
  llmTool: LlmToolId;
  /** Workspace root directory */
  workspaceRoot?: string;
  /** Default timeout in milliseconds */
  defaultTimeout?: number;
  /** Tool-specific configuration (spread to service constructor) */
  toolConfig?: Record<string, unknown>;
}

/**
 * Proxy service that provides a unified interface for multiple LLM backends
 * Use this service when you need to support multiple LLM tools interchangeably
 *
 * @example
 * ```ts
 * import { LlmProxyService, LLM_TOOL_CLAUDE_CODE } from '@agiflowai/coding-agent-bridge';
 *
 * const llm = new LlmProxyService({ llmTool: LLM_TOOL_CLAUDE_CODE });
 * const response = await llm.invokeAsLlm({ prompt: 'Hello' });
 * ```
 */
export class LlmProxyService {
  private service: CodingAgentService;
  private readonly llmTool: LlmToolId;

  constructor(options: LlmProxyServiceOptions) {
    if (!isValidLlmTool(options.llmTool)) {
      throw new Error(
        `Invalid LLM tool: ${options.llmTool}. Supported tools: ${Object.keys(LlmToolConfig).join(', ')}`,
      );
    }

    this.llmTool = options.llmTool;
    this.service = this.createService(options);
  }

  /**
   * Get the current LLM tool identifier
   */
  getLlmTool(): LlmToolId {
    return this.llmTool;
  }

  /**
   * Invoke the LLM with the given parameters
   * Delegates to the appropriate underlying service
   */
  async invokeAsLlm(params: LlmInvocationParams): Promise<LlmInvocationResponse> {
    return this.service.invokeAsLlm(params);
  }

  /**
   * Check if the underlying LLM service is enabled/available
   */
  async isEnabled(): Promise<boolean> {
    return this.service.isEnabled();
  }

  /**
   * Create the appropriate service based on the tool type
   */
  private createService(options: LlmProxyServiceOptions): CodingAgentService {
    const { llmTool, workspaceRoot, defaultTimeout, toolConfig } = options;

    switch (llmTool) {
      case LLM_TOOL_CLAUDE_CODE:
        return new ClaudeCodeService({
          workspaceRoot,
          defaultTimeout,
          toolConfig,
        });

      case LLM_TOOL_CODEX:
        return new CodexService({
          workspaceRoot,
          defaultTimeout,
          toolConfig,
        });

      case LLM_TOOL_GEMINI_CLI:
        return new GeminiCliService({
          workspaceRoot,
          toolConfig,
        });

      case LLM_TOOL_GITHUB_COPILOT:
        return new GitHubCopilotService({
          workspaceRoot,
          defaultTimeout,
          toolConfig,
        });

      default: {
        // TypeScript exhaustiveness check
        const _exhaustiveCheck: never = llmTool;
        throw new Error(`Unsupported LLM tool: ${_exhaustiveCheck}`);
      }
    }
  }
}
