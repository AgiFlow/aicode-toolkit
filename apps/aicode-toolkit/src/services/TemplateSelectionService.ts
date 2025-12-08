/**
 * TemplateSelectionService
 *
 * DESIGN PATTERNS:
 * - Service pattern for business logic encapsulation
 * - Single responsibility: Handle template download, listing, and selection
 *
 * CODING STANDARDS:
 * - Use async/await for asynchronous operations
 * - Throw descriptive errors for error cases
 * - Document methods with JSDoc comments
 *
 * AVOID:
 * - Direct UI interaction (no prompts in services)
 * - Mixing concerns beyond template management
 */

import os from 'node:os';
import path from 'node:path';
import {
  ProjectType,
  print,
  pathExists,
  ensureDir,
  copy,
  remove,
  readdir,
  readFile,
  writeFile,
  cloneSubdirectory,
  fetchGitHubDirectoryContents,
} from '@agiflowai/aicode-utils';
import type { TemplateRepoConfig } from './TemplatesService';

export interface TemplateInfo {
  name: string;
  path: string;
  description?: string;
}

export class TemplateSelectionService {
  private tmpDir: string;

  constructor(existingTmpDir?: string) {
    // Reuse existing tmp directory if provided, otherwise create a new unique one
    this.tmpDir = existingTmpDir || path.join(os.tmpdir(), `aicode-templates-${Date.now()}`);
  }

  /**
   * Download templates to OS tmp directory
   * @param repoConfig - Repository configuration
   * @returns Path to the tmp directory containing templates
   */
  async downloadTemplatesToTmp(repoConfig: TemplateRepoConfig): Promise<string> {
    try {
      // Ensure tmp directory exists
      await ensureDir(this.tmpDir);

      // Fetch directory listing from GitHub
      const contents = await fetchGitHubDirectoryContents(
        repoConfig.owner,
        repoConfig.repo,
        repoConfig.path,
        repoConfig.branch,
      );

      // Filter directories (templates) and files (like RULES.yaml)
      const templateDirs = contents.filter((item) => item.type === 'dir');
      const globalFiles = contents.filter(
        (item) => item.type === 'file' && item.name === 'RULES.yaml',
      );

      if (templateDirs.length === 0) {
        throw new Error('No templates found in repository');
      }

      print.info(`Found ${templateDirs.length} template(s), downloading...`);

      // Download each template to tmp directory
      for (const template of templateDirs) {
        const targetFolder = path.join(this.tmpDir, template.name);

        print.info(`Downloading ${template.name}...`);

        const repoUrl = `https://github.com/${repoConfig.owner}/${repoConfig.repo}.git`;
        await cloneSubdirectory(repoUrl, repoConfig.branch, template.path, targetFolder);

        print.success(`Downloaded ${template.name}`);
      }

      // Download global RULES.yaml if exists
      if (globalFiles.length > 0) {
        print.info('Downloading global RULES.yaml...');

        const rulesUrl = `https://raw.githubusercontent.com/${repoConfig.owner}/${repoConfig.repo}/${repoConfig.branch}/${repoConfig.path}/RULES.yaml`;
        const targetFile = path.join(this.tmpDir, 'RULES.yaml');

        const response = await fetch(rulesUrl);
        if (response.ok) {
          const content = await response.text();
          await writeFile(targetFile, content, 'utf-8');
          print.success('Downloaded global RULES.yaml');
        }
      }

      print.success(`\nAll templates downloaded to ${this.tmpDir}`);
      return this.tmpDir;
    } catch (error) {
      // Clean up on error
      await this.cleanup();
      throw new Error(`Failed to download templates: ${(error as Error).message}`);
    }
  }

  /**
   * List available templates in the tmp directory
   * @returns Array of template information
   */
  async listTemplates(): Promise<TemplateInfo[]> {
    try {
      const entries = await readdir(this.tmpDir, { withFileTypes: true });

      const templates: TemplateInfo[] = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const templatePath = path.join(this.tmpDir, entry.name);
          const description = await this.readTemplateDescription(templatePath);

          templates.push({
            name: entry.name,
            path: templatePath,
            description,
          });
        }
      }

      return templates;
    } catch (error) {
      throw new Error(`Failed to list templates: ${(error as Error).message}`);
    }
  }

  /**
   * Copy selected templates to destination
   * @param templateNames - Names of templates to copy
   * @param destinationPath - Destination templates folder path
   * @param projectType - Project type (monolith allows only single template)
   * @param selectedMcpServers - Optional array of selected MCP servers to filter files
   */
  async copyTemplates(
    templateNames: string[],
    destinationPath: string,
    projectType: ProjectType,
    selectedMcpServers?: string[],
  ): Promise<void> {
    try {
      // Validate template count for monolith
      if (projectType === ProjectType.MONOLITH && templateNames.length > 1) {
        throw new Error('Monolith projects can only use a single template');
      }

      // Ensure destination exists
      await ensureDir(destinationPath);

      print.info(`\nCopying templates to ${destinationPath}...`);

      for (const templateName of templateNames) {
        const sourcePath = path.join(this.tmpDir, templateName);
        const targetPath = path.join(destinationPath, templateName);

        // Check if template exists in tmp
        if (!(await pathExists(sourcePath))) {
          throw new Error(`Template '${templateName}' not found in downloaded templates`);
        }

        // Check if already exists at destination
        if (await pathExists(targetPath)) {
          print.info(`Skipping ${templateName} (already exists)`);
          continue;
        }

        print.info(`Copying ${templateName}...`);

        // If MCP server filtering is enabled, copy selectively
        if (selectedMcpServers && selectedMcpServers.length > 0) {
          await this.copyTemplateWithMcpFilter(sourcePath, targetPath, selectedMcpServers);
        } else {
          // Copy everything
          await copy(sourcePath, targetPath);
        }

        print.success(`Copied ${templateName}`);
      }

      // Copy global RULES.yaml if it exists
      const globalRulesSource = path.join(this.tmpDir, 'RULES.yaml');
      const globalRulesTarget = path.join(destinationPath, 'RULES.yaml');

      if (await pathExists(globalRulesSource)) {
        if (!(await pathExists(globalRulesTarget))) {
          print.info('Copying global RULES.yaml...');
          await copy(globalRulesSource, globalRulesTarget);
          print.success('Copied global RULES.yaml');
        }
      }

      print.success('\nTemplates copied successfully!');
    } catch (error) {
      throw new Error(`Failed to copy templates: ${(error as Error).message}`);
    }
  }

  /**
   * Copy template files with MCP server filtering
   * @param sourcePath - Source template path
   * @param targetPath - Target template path
   * @param selectedMcpServers - Selected MCP servers
   */
  private async copyTemplateWithMcpFilter(
    sourcePath: string,
    targetPath: string,
    selectedMcpServers: string[],
  ): Promise<void> {
    // Import MCP constants
    const { MCPServer, MCP_CONFIG_FILES } = await import('../constants/mcp');

    const architectFiles = MCP_CONFIG_FILES[MCPServer.ARCHITECT];
    const hasArchitect = selectedMcpServers.includes(MCPServer.ARCHITECT);
    const hasScaffold = selectedMcpServers.includes(MCPServer.SCAFFOLD);

    // Ensure target directory exists
    await ensureDir(targetPath);

    // Read all files in source
    const entries = await readdir(sourcePath, { withFileTypes: true });

    for (const entry of entries) {
      const entrySourcePath = path.join(sourcePath, entry.name);
      const entryTargetPath = path.join(targetPath, entry.name);

      // Determine if this file should be copied
      const isArchitectFile = (architectFiles as readonly string[]).includes(entry.name);

      if (hasArchitect && hasScaffold) {
        // Copy everything
        if (entry.isDirectory()) {
          await copy(entrySourcePath, entryTargetPath);
        } else {
          await copy(entrySourcePath, entryTargetPath);
        }
      } else if (hasArchitect && !hasScaffold) {
        // Only copy architect files
        if (isArchitectFile) {
          await copy(entrySourcePath, entryTargetPath);
        }
      } else if (!hasArchitect && hasScaffold) {
        // Copy everything except architect files
        if (!isArchitectFile) {
          if (entry.isDirectory()) {
            await copy(entrySourcePath, entryTargetPath);
          } else {
            await copy(entrySourcePath, entryTargetPath);
          }
        }
      }
    }
  }

  /**
   * Read template description from README or scaffold.yaml
   * @param templatePath - Path to the template directory
   * @returns Description string or undefined
   */
  private async readTemplateDescription(templatePath: string): Promise<string | undefined> {
    try {
      // Try reading from scaffold.yaml first
      const scaffoldYamlPath = path.join(templatePath, 'scaffold.yaml');
      if (await pathExists(scaffoldYamlPath)) {
        const yaml = await import('js-yaml');
        const content = await readFile(scaffoldYamlPath, 'utf-8');
        const scaffoldConfig = yaml.load(content) as {
          description?: string;
          boilerplate?: Array<{ description?: string }>;
        };

        if (scaffoldConfig?.description) {
          return scaffoldConfig.description;
        }

        // Try boilerplate description
        if (scaffoldConfig?.boilerplate?.[0]?.description) {
          return scaffoldConfig.boilerplate[0].description;
        }
      }

      // Fallback to README.md
      const readmePath = path.join(templatePath, 'README.md');
      if (await pathExists(readmePath)) {
        const content = await readFile(readmePath, 'utf-8');
        // Get first paragraph (up to first empty line or 200 chars)
        const firstParagraph = content.split('\n\n')[0].substring(0, 200);
        return firstParagraph.trim();
      }

      return undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Get the tmp directory path
   */
  getTmpDir(): string {
    return this.tmpDir;
  }

  /**
   * Clean up tmp directory
   */
  async cleanup(): Promise<void> {
    try {
      if (await pathExists(this.tmpDir)) {
        await remove(this.tmpDir);
      }
    } catch (error) {
      // Log but don't throw - cleanup failures shouldn't stop the process
      print.warning(`Warning: Failed to clean up tmp directory: ${(error as Error).message}`);
    }
  }
}
