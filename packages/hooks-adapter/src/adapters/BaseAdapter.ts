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

import type { HookContext, HookResponse, HookCallback } from '../types';

/**
 * Abstract base adapter for normalizing AI agent hook formats
 */
export abstract class BaseAdapter {
  /**
   * Parse stdin from AI agent into normalized HookContext
   * @param stdin - Raw stdin string from AI agent
   * @returns Normalized hook context
   */
  abstract parseInput(stdin: string): HookContext;

  /**
   * Format normalized HookResponse into AI agent-specific output
   * @param response - Normalized hook response
   * @returns Formatted output string for AI agent
   */
  abstract formatOutput(response: HookResponse): string;

  /**
   * Execute hook callback with normalized context
   * Template method that orchestrates the hook execution flow
   *
   * @param callback - Hook callback function to execute
   */
  async execute(callback: HookCallback): Promise<void> {
    try {
      // Read stdin from AI agent
      const stdin = await this.readStdin();

      // Parse into normalized context
      const context = this.parseInput(stdin);

      // Execute callback with normalized context
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
