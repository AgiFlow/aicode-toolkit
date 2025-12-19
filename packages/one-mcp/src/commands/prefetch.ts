/**
 * Prefetch Command
 *
 * DESIGN PATTERNS:
 * - Command pattern with Commander for CLI argument parsing
 * - Async/await pattern for asynchronous operations
 * - Error handling pattern with try-catch and proper exit codes
 *
 * CODING STANDARDS:
 * - Use async action handlers for asynchronous operations
 * - Provide clear option descriptions and default values
 * - Handle errors gracefully with process.exit()
 * - Log progress and errors to console
 * - Use Commander's .option() and .argument() for inputs
 *
 * AVOID:
 * - Synchronous blocking operations in action handlers
 * - Missing error handling (always use try-catch)
 * - Hardcoded values (use options or environment variables)
 * - Not exiting with appropriate exit codes on errors
 */

import { Command } from 'commander';
import { log } from '@agiflowai/aicode-utils';
import { ConfigFetcherService, PrefetchService, type PackageManager } from '../services';
import { findConfigFile } from '../utils';

/**
 * Options for the prefetch command
 */
interface PrefetchOptions {
  config?: string;
  parallel: boolean;
  dryRun: boolean;
  filter?: PackageManager;
}

/**
 * Pre-download packages used by MCP servers (npx, pnpx, uvx, uv)
 */
export const prefetchCommand = new Command('prefetch')
  .description('Pre-download packages used by MCP servers (npx, pnpx, uvx, uv)')
  .option('-c, --config <path>', 'Path to MCP server configuration file')
  .option('-p, --parallel', 'Run prefetch commands in parallel', false)
  .option('-d, --dry-run', 'Show what would be prefetched without executing', false)
  .option('-f, --filter <type>', 'Filter by package manager type: npx, pnpx, uvx, or uv')
  .action(async (options: PrefetchOptions) => {
    try {
      // Find config file: use provided path, or search PROJECT_PATH then cwd
      const configFilePath = options.config || findConfigFile();

      if (!configFilePath) {
        log.error('No MCP configuration file found.');
        log.info('Use --config <path> to specify a config file, or run "one-mcp init" to create one.');
        process.exit(1);
      }

      log.info(`Loading configuration from: ${configFilePath}`);

      // Load configuration using ConfigFetcherService
      const configService = new ConfigFetcherService({
        configFilePath,
        useCache: false, // Always fetch fresh config for prefetch
      });

      const mcpConfig = await configService.fetchConfiguration(true);

      // Create PrefetchService with configuration
      const prefetchService = new PrefetchService({
        mcpConfig,
        filter: options.filter,
        parallel: options.parallel,
      });

      // Extract packages to prefetch
      const packages = prefetchService.extractPackages();

      if (packages.length === 0) {
        log.info('No packages found to prefetch.');
        log.info('Prefetch supports: npx, pnpx, uvx, and uv run commands');
        return;
      }

      log.info(`Found ${packages.length} package(s) to prefetch:`);
      for (const pkg of packages) {
        log.info(`  - ${pkg.serverName}: ${pkg.packageManager} ${pkg.packageName}`);
      }

      if (options.dryRun) {
        log.info('\nDry run mode - commands that would be executed:');
        for (const pkg of packages) {
          log.info(`  ${pkg.fullCommand.join(' ')}`);
        }
        return;
      }

      log.info('\nPrefetching packages...');

      // Run prefetch
      const summary = await prefetchService.prefetch();

      // Report results
      log.info(`\nPrefetch complete: ${summary.successful} succeeded, ${summary.failed} failed`);

      if (summary.failed > 0) {
        log.error('\nFailed packages:');
        for (const result of summary.results.filter((r) => !r.success)) {
          log.error(`  - ${result.package.serverName} (${result.package.packageName}): ${result.output.trim()}`);
        }
        process.exit(1);
      }
    } catch (error) {
      log.error('Error executing prefetch:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
