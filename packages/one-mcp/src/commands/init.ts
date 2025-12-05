/**
 * Init Command
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
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { log } from '@agiflowai/aicode-utils';
import { Liquid } from 'liquidjs';
import yamlLiquidTemplate from '../templates/mcp-config.yaml.liquid?raw';
import jsonTemplate from '../templates/mcp-config.json?raw';

/**
 * Initialize MCP configuration file
 */
export const initCommand = new Command('init')
  .description('Initialize MCP configuration file')
  .option('-o, --output <path>', 'Output file path', 'mcp-config.yaml')
  .option('--json', 'Generate JSON config instead of YAML', false)
  .option('-f, --force', 'Overwrite existing config file', false)
  .option('--mcp-servers <json>', 'JSON string of MCP servers to add to config (optional)')
  .action(async (options) => {
    try {
      const outputPath = resolve(options.output);
      const isYaml = !options.json && (outputPath.endsWith('.yaml') || outputPath.endsWith('.yml'));

      let content: string;

      if (isYaml) {
        // Use liquidjs to render YAML template
        const liquid = new Liquid();

        // Parse --mcp-servers if provided
        let mcpServersData: Array<{ name: string; command: string; args: string[] }> | null = null;

        if (options.mcpServers) {
          try {
            const serversObj = JSON.parse(options.mcpServers) as Record<
              string,
              { command: string; args: string[] }
            >;
            // Convert object to array format for liquid template
            mcpServersData = Object.entries(serversObj).map(([name, config]) => ({
              name,
              command: config.command,
              args: config.args,
            }));
          } catch (parseError) {
            log.error(
              'Failed to parse --mcp-servers JSON:',
              parseError instanceof Error ? parseError.message : String(parseError),
            );
            process.exit(1);
          }
        }

        content = await liquid.parseAndRender(yamlLiquidTemplate, {
          mcpServers: mcpServersData,
        });
      } else {
        // For JSON, use the static template (or extend similarly if needed)
        content = jsonTemplate;
      }

      // Write config file atomically - use 'wx' flag to fail if file exists (unless force is set)
      // This prevents race conditions by making the check-and-write atomic
      try {
        await writeFile(outputPath, content, {
          encoding: 'utf-8',
          flag: options.force ? 'w' : 'wx',
        });
      } catch (error) {
        // If file exists and we're not forcing, provide helpful error
        if (error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST') {
          log.error(`Config file already exists: ${outputPath}`);
          log.info('Use --force to overwrite');
          process.exit(1);
        }
        throw error;
      }

      log.info(`MCP configuration file created: ${outputPath}`);
      log.info('Next steps:');
      log.info('1. Edit the configuration file to add your MCP servers');
      log.info(`2. Run: one-mcp mcp-serve --config ${outputPath}`);
    } catch (error) {
      log.error('Error executing init:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
