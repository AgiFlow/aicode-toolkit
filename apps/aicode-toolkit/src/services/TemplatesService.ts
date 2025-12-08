/**
 * TemplatesService
 *
 * DESIGN PATTERNS:
 * - Service pattern for business logic encapsulation
 * - Single responsibility principle
 *
 * CODING STANDARDS:
 * - Use async/await for asynchronous operations
 * - Throw descriptive errors for error cases
 * - Keep methods focused and well-named
 * - Document complex logic with comments
 *
 * AVOID:
 * - Mixing concerns (keep focused on single domain)
 * - Direct tool implementation (services should be tool-agnostic)
 */

import path from 'node:path';
import {
  messages,
  print,
  pathExists,
  ensureDir,
  writeFile,
  cloneSubdirectory,
  fetchGitHubDirectoryContents,
} from '@agiflowai/aicode-utils';

export interface TemplateRepoConfig {
  owner: string;
  repo: string;
  branch: string;
  path: string;
}

export class TemplatesService {
  /**
   * Download templates from a GitHub repository with UI feedback
   * @param templatesPath - Local path where templates should be downloaded
   * @param repoConfig - Repository configuration (owner, repo, branch, path)
   */
  async downloadTemplates(templatesPath: string, repoConfig: TemplateRepoConfig): Promise<void> {
    print.info(`Fetching templates from ${repoConfig.owner}/${repoConfig.repo}...`);

    try {
      // Fetch directory listing from GitHub
      const contents = await fetchGitHubDirectoryContents(
        repoConfig.owner,
        repoConfig.repo,
        repoConfig.path,
        repoConfig.branch,
      );

      // Filter only directories
      const templateDirs = contents.filter((item) => item.type === 'dir');

      if (templateDirs.length === 0) {
        messages.warning('No templates found in repository');
        return;
      }

      print.info(`Found ${templateDirs.length} template(s)`);

      let _downloaded = 0;
      let _skipped = 0;

      // Download each template
      for (const template of templateDirs) {
        const targetFolder = path.join(templatesPath, template.name);

        // Skip if already exists
        if (await pathExists(targetFolder)) {
          print.info(`Skipping ${template.name} (already exists)`);
          _skipped++;
          continue;
        }

        print.info(`Downloading ${template.name}...`);

        const repoUrl = `https://github.com/${repoConfig.owner}/${repoConfig.repo}.git`;
        await cloneSubdirectory(repoUrl, repoConfig.branch, template.path, targetFolder);

        print.success(`Downloaded ${template.name}`);
        _downloaded++;
      }

      print.success('\nAll templates downloaded successfully!');
    } catch (error) {
      throw new Error(`Failed to download templates: ${(error as Error).message}`);
    }
  }

  /**
   * Initialize templates folder with README
   * @param templatesPath - Path where templates folder should be created
   */
  async initializeTemplatesFolder(templatesPath: string): Promise<void> {
    // Create templates directory
    await ensureDir(templatesPath);

    // Create README.md
    const readme = `# Templates

This folder contains boilerplate templates and scaffolding methods for your projects.

## Templates

Templates are organized by framework/technology and include configuration files (\`scaffold.yaml\`) that define:
- Boilerplates: Full project starter templates
- Features: Code scaffolding methods for adding new features to existing projects

## Adding More Templates

Use the \`add\` command to add templates from remote repositories:

\`\`\`bash
scaffold-mcp add --name my-template --url https://github.com/user/template
\`\`\`

Or add templates from subdirectories:

\`\`\`bash
scaffold-mcp add --name nextjs-template --url https://github.com/user/repo/tree/main/templates/nextjs
\`\`\`

## Creating Custom Templates

Each template should have a \`scaffold.yaml\` configuration file defining:
- \`boilerplate\`: Array of boilerplate configurations
- \`features\`: Array of feature scaffold configurations

Template files use Liquid syntax for variable placeholders: \`{{ variableName }}\`

See existing templates for examples and documentation for more details.
`;

    await writeFile(path.join(templatesPath, 'README.md'), readme);
  }
}
