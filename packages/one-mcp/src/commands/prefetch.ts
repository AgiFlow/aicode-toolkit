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
import { print } from '@agiflowai/aicode-utils';
import {
  ConfigFetcherService,
  DefinitionsCacheService,
  McpClientManagerService,
  PrefetchService,
  SkillService,
  type PackageManager,
} from '../services';
import { generateServerId, findConfigFile } from '../utils';
import packageJson from '../../package.json' assert { type: 'json' };

/**
 * Options for the prefetch command
 */
interface PrefetchOptions {
  config?: string;
  parallel: boolean;
  dryRun: boolean;
  filter?: PackageManager;
  definitionsOut?: string;
  skipPackages: boolean;
  clearDefinitionsCache: boolean;
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
  .option('--definitions-out <path>', 'Write discovered definitions to a JSON or YAML cache file')
  .option('--skip-packages', 'Skip package prefetch and only build definitions cache', false)
  .option('--clear-definitions-cache', 'Delete the definitions cache file before continuing', false)
  .action(async (options: PrefetchOptions): Promise<void> => {
    try {
      // Find config file: use provided path, or search PROJECT_PATH then cwd
      const configFilePath = options.config || findConfigFile();

      if (!configFilePath) {
        print.error('No MCP configuration file found.');
        print.info(
          'Use --config <path> to specify a config file, or run "one-mcp init" to create one.',
        );
        process.exit(1);
      }

      print.info(`Loading configuration from: ${configFilePath}`);

      // Load configuration using ConfigFetcherService
      const configService = new ConfigFetcherService({
        configFilePath,
        useCache: false, // Always fetch fresh config for prefetch
      });

      const mcpConfig = await configService.fetchConfiguration(true);
      const serverId = mcpConfig.id || generateServerId();
      const configHash = DefinitionsCacheService.generateConfigHash(mcpConfig);
      const effectiveDefinitionsPath =
        options.definitionsOut || DefinitionsCacheService.getDefaultCachePath(configFilePath);

      // Create PrefetchService with configuration
      const prefetchService = new PrefetchService({
        mcpConfig,
        filter: options.filter,
        parallel: options.parallel,
      });

      // Extract packages to prefetch
      const packages = prefetchService.extractPackages();
      const shouldPrefetchPackages = !options.skipPackages;
      const shouldWriteDefinitions = Boolean(options.definitionsOut);

      if (options.clearDefinitionsCache) {
        if (options.dryRun) {
          print.info(`Would clear definitions cache: ${effectiveDefinitionsPath}`);
        } else {
          await DefinitionsCacheService.clearFile(effectiveDefinitionsPath);
          print.success(`Cleared definitions cache: ${effectiveDefinitionsPath}`);
        }
      }

      if (shouldPrefetchPackages) {
        if (packages.length === 0) {
          print.warning('No packages found to prefetch.');
          print.info('Prefetch supports: npx, pnpx, uvx, and uv run commands');
        } else {
          print.info(`Found ${packages.length} package(s) to prefetch:`);
          for (const pkg of packages) {
            print.item(`${pkg.serverName}: ${pkg.packageManager} ${pkg.packageName}`);
          }
        }
      }

      if (!shouldPrefetchPackages && !shouldWriteDefinitions) {
        print.warning('Nothing to do. Use package prefetch or provide --definitions-out.');
        return;
      }

      if (options.dryRun) {
        if (shouldPrefetchPackages && packages.length > 0) {
          print.newline();
          print.header('Dry run mode - commands that would be executed:');
          for (const pkg of packages) {
            print.indent(pkg.fullCommand.join(' '));
          }
        }
        if (shouldWriteDefinitions) {
          print.newline();
          print.info(`Would write definitions cache to: ${effectiveDefinitionsPath}`);
        }
        return;
      }

      let packagePrefetchFailed = false;
      if (shouldPrefetchPackages && packages.length > 0) {
        print.newline();
        print.info('Prefetching packages...');

        const summary = await prefetchService.prefetch();

        print.newline();
        if (summary.failed === 0) {
          print.success(
            `Package prefetch complete: ${summary.successful} succeeded, ${summary.failed} failed`,
          );
        } else {
          print.warning(
            `Package prefetch complete: ${summary.successful} succeeded, ${summary.failed} failed`,
          );
        }

        if (summary.failed > 0) {
          packagePrefetchFailed = true;
          print.newline();
          print.error('Failed packages:');
          for (const result of summary.results.filter((r) => !r.success)) {
            print.item(
              `${result.package.serverName} (${result.package.packageName}): ${result.output.trim()}`,
            );
          }
        }
      }

      if (shouldWriteDefinitions) {
        print.newline();
        print.info('Collecting definitions cache...');

        const clientManager = new McpClientManagerService();
        const skillPaths = mcpConfig.skills?.paths || [];
        const skillService =
          skillPaths.length > 0 ? new SkillService(process.cwd(), skillPaths) : undefined;
        const definitionsCacheService = new DefinitionsCacheService(clientManager, skillService);

        await Promise.all(
          Object.entries(mcpConfig.mcpServers).map(async ([serverName, serverConfig]) => {
            try {
              await clientManager.connectToServer(serverName, serverConfig);
              print.item(`Connected for definitions: ${serverName}`);
            } catch (error) {
              print.warning(
                `Failed to connect for definitions: ${serverName} (${error instanceof Error ? error.message : String(error)})`,
              );
            }
          }),
        );

        const definitionsCache = await definitionsCacheService.collectForCache({
          configPath: configFilePath,
          configHash,
          oneMcpVersion: packageJson.version,
          serverId,
        });
        await DefinitionsCacheService.writeToFile(effectiveDefinitionsPath, definitionsCache);
        print.success(
          `Definitions cache written: ${effectiveDefinitionsPath} (${Object.keys(definitionsCache.servers).length} servers, ${definitionsCache.skills.length} skills)`,
        );

        if (definitionsCache.failures.length > 0) {
          print.warning(
            `Definitions cache completed with ${definitionsCache.failures.length} server failure(s)`,
          );
        }

        await clientManager.disconnectAll();
      }

      if (packagePrefetchFailed) {
        process.exit(1);
      }
    } catch (error) {
      print.error(
        'Error executing prefetch:',
        error instanceof Error ? error.message : String(error),
      );
      process.exit(1);
    }
  });
