/**
 * BaseCodingAgentService
 *
 * DESIGN PATTERNS:
 * - Abstract base class for shared functionality across coding agent services
 * - Template method pattern for CLI argument building
 *
 * CODING STANDARDS:
 * - Service class names use PascalCase with 'Service' suffix
 * - Use protected for methods/properties shared with subclasses
 * - Return types should be explicit (never use implicit any)
 *
 * AVOID:
 * - Direct instantiation of abstract class
 * - Exposing internal implementation details
 */

import type {
  CodingAgentService,
  LlmInvocationParams,
  LlmInvocationResponse,
  McpSettings,
  PromptConfig,
} from '../types';

/**
 * Abstract base class for coding agent services
 * Provides shared functionality for CLI-based LLM tool invocation
 */
export abstract class BaseCodingAgentService implements CodingAgentService {
  protected readonly toolConfig: Record<string, unknown>;

  constructor(options?: { toolConfig?: Record<string, unknown> }) {
    this.toolConfig = options?.toolConfig || {};
  }

  /**
   * Convert toolConfig object to CLI arguments array
   * Converts { model: "gpt-5.2-high", timeout: 60000 } to ["--model", "gpt-5.2-high", "--timeout", "60000"]
   */
  protected buildToolConfigArgs(): string[] {
    const args: string[] = [];
    for (const [key, value] of Object.entries(this.toolConfig)) {
      if (value !== undefined && value !== null) {
        // Convert camelCase to kebab-case for CLI flags
        const flag = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
        args.push(flag, String(value));
      }
    }
    return args;
  }

  abstract isEnabled(): Promise<boolean>;
  abstract updateMcpSettings(settings: McpSettings): Promise<void>;
  abstract updatePrompt(config: PromptConfig): Promise<void>;
  abstract invokeAsLlm(params: LlmInvocationParams): Promise<LlmInvocationResponse>;
}
