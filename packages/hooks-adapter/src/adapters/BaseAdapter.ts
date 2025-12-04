/**
 * BaseAdapter - Abstract base class for AI agent hook adapters
 *
 * DESIGN PATTERNS:
 * - Template Method pattern: execute() defines the algorithm, subclasses implement steps
 * - Fail-open pattern: Errors allow operation to proceed with warning message
 * - Abstract class for shared functionality
 *
 * CODING STANDARDS:
 * - Use abstract methods for steps that vary by adapter
 * - Implement error handling in base class for consistency
 * - Export only what's needed publicly
 *
 * AVOID:
 * - Fail-closed behavior (blocking operations on errors)
 * - Swallowing errors silently
 * - Tight coupling to specific AI tool formats
 */

import type { HookResponse } from '../types';

/**
 * Abstract base adapter for AI agent hook formats
 * @template TContext - The adapter-specific input context type
 */
export abstract class BaseAdapter<TContext = any> {
  /**
   * Parse stdin from AI agent into context (specific to each adapter)
   * @param stdin - Raw stdin string from AI agent
   * @returns Context object (can be adapter-specific or normalized)
   */
  abstract parseInput(stdin: string): TContext;

  /**
   * Format normalized HookResponse into AI agent-specific output
   * @param response - Normalized hook response
   * @returns Formatted output string for AI agent
   */
  abstract formatOutput(response: HookResponse): string;

  /**
   * Execute hook callback with context
   * Template method that orchestrates the hook execution flow
   *
   * @param callback - Hook callback function to execute
   */
  async execute(callback: (context: TContext) => Promise<HookResponse>): Promise<void> {
    try {
      // Read stdin from AI agent
      const stdin = await this.readStdin();

      // Parse into context
      const context = this.parseInput(stdin);

      // Execute callback with context
      const response = await callback(context);

      // If decision is 'skip', don't output anything and let Claude continue normally
      if (response.decision === 'skip') {
        process.exit(0);
        return;
      }

      // Format response for AI agent
      const output = this.formatOutput(response);

      // Write to stdout
      console.log(output);
      process.exit(0);
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Execute multiple hooks with shared stdin (read once, execute all)
   * This is useful when multiple hooks need to process the same input
   * @param callbacks - Array of callback functions to execute
   */
  async executeMultiple(callbacks: Array<(context: TContext) => Promise<HookResponse>>): Promise<void> {
    try {
      // Read stdin from AI agent once
      const stdin = await this.readStdin();

      // Parse into context once
      const context = this.parseInput(stdin);

      // Execute all callbacks in serial, collecting responses
      const responses: HookResponse[] = [];
      for (const callback of callbacks) {
        const response = await callback(context);
        responses.push(response);
      }

      // Find first non-skip response (priority order)
      const finalResponse = responses.find(r => r.decision !== 'skip');

      // If all responses are skip, exit without output
      if (!finalResponse) {
        process.exit(0);
        return;
      }

      // Format and output the first non-skip response
      const output = this.formatOutput(finalResponse);

      // Write to stdout
      console.log(output);
      process.exit(0);
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Read stdin from AI agent
   * @returns Promise resolving to stdin content
   */
  private readStdin(): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      process.stdin.on('data', (chunk) => {
        chunks.push(chunk);
      });

      process.stdin.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf8'));
      });

      process.stdin.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Handle errors with fail-open behavior
   * Allows operation to proceed with warning message
   *
   * @param error - Error that occurred during hook execution
   */
  private handleError(error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Fail open: always allow operation with warning
    const output = this.formatOutput({
      decision: 'allow',
      message: `⚠️ Hook error: ${errorMessage}`,
    });

    console.log(output);
    process.exit(0);
  }
}
