import path from 'node:path';
import {
  icons,
  messages,
  print,
  sections,
  TemplatesManagerService,
  pathExists,
  ensureDir,
} from '@agiflowai/aicode-utils';
import { Command } from 'commander';
import { cloneRepository, cloneSubdirectory, parseGitHubUrl } from '../utils';

/**
 * Add command - add a template to templates folder
 */
export const addCommand = new Command('add')
  .description('Add a template to templates folder')
  .requiredOption('--name <name>', 'Template name')
  .requiredOption('--url <url>', 'URL of the template repository to download')
  .option('--path <path>', 'Override templates folder path (uses toolkit.yaml config by default)')
  .option('--type <type>', 'Template type: boilerplate or scaffold', 'boilerplate')
  .action(async (options) => {
    try {
      // Use TemplatesManagerService to find templates path, or use provided --path override
      const foundTemplatesPath = options.path
        ? path.resolve(options.path)
        : await TemplatesManagerService.findTemplatesPath();

      if (!foundTemplatesPath) {
        messages.error(
          'Templates folder not found. Create a templates folder or specify templatesPath in toolkit.yaml',
        );
        process.exit(1);
      }
      const templatesPath = foundTemplatesPath;

      const templateType = options.type.toLowerCase();
      const templateName = options.name;
      const templateUrl = options.url;

      // Validate type
      if (templateType !== 'boilerplate' && templateType !== 'scaffold') {
        messages.error('Invalid template type. Use: boilerplate or scaffold');
        process.exit(1);
      }

      // Ensure templates folder exists
      const targetFolder = path.join(templatesPath, `${templateType}s`, templateName);

      if (await pathExists(targetFolder)) {
        messages.error(`Template '${templateName}' already exists at ${targetFolder}`);
        process.exit(1);
      }

      print.info(`${icons.download} Downloading template '${templateName}' from ${templateUrl}...`);

      await ensureDir(path.dirname(targetFolder));

      // Parse URL to detect if it's a subdirectory
      const parsedUrl = parseGitHubUrl(templateUrl);

      // Clone the repository
      try {
        if (parsedUrl.isSubdirectory && parsedUrl.branch && parsedUrl.subdirectory) {
          // Clone subdirectory using sparse checkout
          print.info(
            `${icons.folder} Detected subdirectory: ${parsedUrl.subdirectory} (branch: ${parsedUrl.branch})`,
          );
          await cloneSubdirectory(
            parsedUrl.repoUrl,
            parsedUrl.branch,
            parsedUrl.subdirectory,
            targetFolder,
          );
        } else {
          // Clone entire repository
          await cloneRepository(parsedUrl.repoUrl, targetFolder);
        }

        messages.success(`Template '${templateName}' added successfully!`);
        print.header(`\n${icons.folder} Template location:`);
        print.indent(targetFolder);

        // Check for configuration file
        const configFiles = [
          path.join(targetFolder, 'boilerplate.yaml'),
          path.join(targetFolder, 'scaffold.yaml'),
        ];

        let hasConfig = false;
        for (const configFile of configFiles) {
          if (await pathExists(configFile)) {
            print.header(`\n${icons.config} Configuration file found:`);
            print.indent(path.basename(configFile));
            hasConfig = true;
            break;
          }
        }

        if (!hasConfig) {
          messages.warning(
            'Warning: No configuration file found (boilerplate.yaml or scaffold.yaml)',
          );
          print.indent('You may need to create one manually.');
        }

        sections.nextSteps([
          `Review the template in ${targetFolder}`,
          `Test it with: scaffold-mcp ${templateType} list`,
        ]);
      } catch (error) {
        // If git clone fails, try to give helpful error messages
        if (
          (error as Error).message.includes('not found') ||
          (error as Error).message.includes('command not found')
        ) {
          messages.error('git command not found. Please install git first.');
        } else if ((error as Error).message.includes('Authentication failed')) {
          messages.error('Authentication failed. Make sure you have access to the repository.');
        } else if ((error as Error).message.includes('Repository not found')) {
          messages.error('Repository not found. Check the URL and try again.');
        } else {
          messages.error('Failed to clone repository:', error as Error);
        }
        process.exit(1);
      }
    } catch (error) {
      messages.error('Error adding template:', error as Error);
      process.exit(1);
    }
  });
