import { print } from '@agiflowai/aicode-utils';
/**
 * Add Rule Command
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
import { AddRuleTool } from '../tools/AddRuleTool';
import type { RuleItem } from '../types/index.js';

interface AddRuleOptions {
  templateName?: string;
  global?: boolean;
  inherits?: string;
  mustDo?: string;
  shouldDo?: string;
  mustNotDo?: string;
  json?: boolean;
  verbose?: boolean;
}

/**
 * Add a new design pattern rule to a template's RULES.yaml or global RULES.yaml
 */
export const addRuleCommand = new Command('add-rule')
  .description("Add a new design pattern rule to a template's RULES.yaml or global RULES.yaml")
  .argument('<pattern>', 'Pattern identifier (e.g., "src/index.ts", "export-standards")')
  .argument('<description>', 'Description of the rule pattern')
  .option('-t, --template-name <name>', 'Template name (omit for global rules)')
  .option('-g, --global', 'Add to global RULES.yaml', false)
  .option('--inherits <patterns>', 'Comma-separated list of inherited patterns')
  .option('--must-do <rules>', 'Comma-separated list of must-do rules')
  .option('--should-do <rules>', 'Comma-separated list of should-do rules')
  .option('--must-not-do <rules>', 'Comma-separated list of must-not-do rules')
  .option('-j, --json', 'Output as JSON', false)
  .option('-v, --verbose', 'Enable verbose output', false)
  .action(async (pattern: string, description: string, options: AddRuleOptions) => {
    try {
      if (options.verbose) {
        print.info(`Adding rule pattern: ${pattern}`);
        print.info(`Template: ${options.templateName || 'global'}`);
      }

      // Parse rule items
      const parseRuleItems = (rules?: string): RuleItem[] | undefined => {
        if (!rules) return undefined;
        return rules.split(',').map((rule) => ({ rule: rule.trim() }));
      };

      // Create tool instance
      const tool = new AddRuleTool();

      // Execute the tool
      const result = await tool.execute({
        template_name: options.templateName,
        pattern,
        description,
        inherits: options.inherits?.split(',').map((s) => s.trim()),
        must_do: parseRuleItems(options.mustDo),
        should_do: parseRuleItems(options.shouldDo),
        must_not_do: parseRuleItems(options.mustNotDo),
        is_global: options.global,
      });

      // Parse and display result
      const firstContent = result.content[0];
      if (firstContent.type !== 'text') {
        print.error('❌ Error: Unexpected response type');
        process.exit(1);
      }

      if (result.isError) {
        const errorData = JSON.parse(firstContent.text);
        print.error('❌ Error:', errorData.error || errorData);
        process.exit(1);
      }

      const data = JSON.parse(firstContent.text);

      if (options.json) {
        print.info(JSON.stringify(data, null, 2));
      } else {
        print.info(`\n✅ Success: ${data.message}`);
        print.info(`📄 File: ${data.file}`);
        print.info('\nAdded rule:');
        print.info(`  Pattern: ${data.rule.pattern}`);
        print.info(`  Description: ${data.rule.description}`);

        if (data.rule.inherits && data.rule.inherits.length > 0) {
          print.info(`  Inherits: ${data.rule.inherits.join(', ')}`);
        }

        if (data.rule.must_do && data.rule.must_do.length > 0) {
          print.info(`  Must Do: ${data.rule.must_do.length} rules`);
        }

        if (data.rule.should_do && data.rule.should_do.length > 0) {
          print.info(`  Should Do: ${data.rule.should_do.length} rules`);
        }

        if (data.rule.must_not_do && data.rule.must_not_do.length > 0) {
          print.info(`  Must Not Do: ${data.rule.must_not_do.length} rules`);
        }

        print.newline();
      }
    } catch (error) {
      print.error('❌ Error executing add-rule:', error instanceof Error ? error : String(error));
      process.exit(1);
    }
  });
