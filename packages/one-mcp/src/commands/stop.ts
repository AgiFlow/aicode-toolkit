/**
 * Stop Command
 *
 * Stops a running HTTP one-mcp server using the authenticated admin endpoint
 * and the persisted runtime registry.
 */

import { Command } from 'commander';
import { StopServerService, type StopServerResult } from '../services';

/**
 * Options for the stop command.
 */
interface StopCommandOptions {
  id?: string;
  host?: string;
  port?: number;
  config?: string;
  token?: string;
  force: boolean;
  json: boolean;
  timeout: number;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function printStopResult(result: StopServerResult): void {
  console.log(`Stopped one-mcp server '${result.serverId}'.`);
  console.log(`Endpoint: http://${result.host}:${result.port}`);
  console.log(`Result: ${result.message}`);
}

/**
 * Stop a running HTTP one-mcp server.
 */
export const stopCommand = new Command('stop')
  .description('Stop a running HTTP one-mcp server')
  .option('--id <id>', 'Target server ID from the runtime registry')
  .option('--host <host>', 'Target runtime host')
  .option(
    '--port <port>',
    'Target runtime port',
    (value: string): number => Number.parseInt(value, 10),
  )
  .option('-c, --config <path>', 'Reserved for future config-based targeting support')
  .option('--token <token>', 'Override the persisted shutdown token')
  .option('--force', 'Skip server ID verification against the /health response', false)
  .option('-j, --json', 'Output as JSON', false)
  .option(
    '--timeout <ms>',
    'Maximum time to wait for shutdown completion',
    (value: string): number => Number.parseInt(value, 10),
    5000,
  )
  .action(async (options: StopCommandOptions): Promise<void> => {
    try {
      if (options.config) {
        console.error('Warning: --config is not used yet; runtime resolution uses the persisted registry.');
      }

      const stopServerService = new StopServerService();
      const result = await stopServerService.stop({
        serverId: options.id,
        host: options.host,
        port: options.port,
        token: options.token,
        force: options.force,
        timeoutMs: options.timeout,
      });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      printStopResult(result);
    } catch (error) {
      const errorMessage = `Error executing stop: ${toErrorMessage(error)}`;
      if (options.json) {
        console.log(
          JSON.stringify(
            {
              ok: false,
              error: errorMessage,
            },
            null,
            2,
          ),
        );
      } else {
        console.error(errorMessage);
      }
      process.exit(1);
    }
  });
