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
import yamlTemplate from '../templates/mcp-config.yaml?raw';
import jsonTemplate from '../templates/mcp-config.json?raw';

/**
 * Initialize MCP configuration file
 */
export const initCommand = new Command('init')
  .description('Initialize MCP configuration file')
  .option('-o, --output <path>', 'Output file path', 'mcp-config.yaml')
  .option('--json', 'Generate JSON config instead of YAML', false)
  .option('-f, --force', 'Overwrite existing config file', false)
  .action(async (options) => {
    try {
      const outputPath = resolve(options.output);
      const isYaml = !options.json && (outputPath.endsWith('.yaml') || outputPath.endsWith('.yml'));

      // Select template based on format
      const template = isYaml ? yamlTemplate : jsonTemplate;

      // Write config file atomically - use 'wx' flag to fail if file exists (unless force is set)
      // This prevents race conditions by making the check-and-write atomic
      try {
        await writeFile(outputPath, template, {
          encoding: 'utf-8',
          flag: options.force ? 'w' : 'wx'
        });
      } catch (error) {
        // If file exists and we're not forcing, provide helpful error
        if (error.code === 'EEXIST') {
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
