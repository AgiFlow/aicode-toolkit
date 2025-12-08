import path from 'node:path';
import { pathExists, writeFile, move, remove } from '@agiflowai/aicode-utils';
import { execa } from 'execa';

/**
 * Execute a git command safely using execa to prevent command injection
 */
async function execGit(args: string[], cwd?: string): Promise<void> {
  try {
    await execa('git', args, { cwd });
  } catch (error) {
    const execaError = error as { stderr?: string; message: string };
    throw new Error(`Git command failed: ${execaError.stderr || execaError.message}`);
  }
}

/**
 * Execute git init safely using execa to prevent command injection
 */
export async function gitInit(projectPath: string): Promise<void> {
  try {
    await execa('git', ['init', projectPath]);
  } catch (error) {
    const execaError = error as { stderr?: string; message: string };
    throw new Error(`Git init failed: ${execaError.stderr || execaError.message}`);
  }
}

/**
 * Find the workspace root by searching upwards for .git folder
 * Returns null if no .git folder is found (indicating a new project setup is needed)
 */
export async function findWorkspaceRoot(startPath: string = process.cwd()): Promise<string | null> {
  let currentPath = path.resolve(startPath);
  const rootPath = path.parse(currentPath).root;

  while (true) {
    // Check if .git folder exists (repository root)
    const gitPath = path.join(currentPath, '.git');
    if (await pathExists(gitPath)) {
      return currentPath;
    }

    // Check if we've reached the filesystem root
    if (currentPath === rootPath) {
      // No .git found, return null to indicate new project setup needed
      return null;
    }

    // Move up to parent directory
    currentPath = path.dirname(currentPath);
  }
}

/**
 * Parse GitHub URL to detect if it's a subdirectory
 * Supports formats:
 * - https://github.com/user/repo
 * - https://github.com/user/repo/tree/branch/path/to/dir
 * - https://github.com/user/repo/tree/main/path/to/dir
 */
export function parseGitHubUrl(url: string): {
  owner?: string;
  repo?: string;
  repoUrl: string;
  branch?: string;
  subdirectory?: string;
  isSubdirectory: boolean;
} {
  // Match GitHub URL patterns
  const treeMatch = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)$/);
  const blobMatch = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/);
  const rootMatch = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);

  if (treeMatch || blobMatch) {
    const match = treeMatch || blobMatch;
    return {
      owner: match?.[1],
      repo: match?.[2],
      repoUrl: `https://github.com/${match?.[1]}/${match?.[2]}.git`,
      branch: match?.[3],
      subdirectory: match?.[4],
      isSubdirectory: true,
    };
  }

  if (rootMatch) {
    return {
      owner: rootMatch[1],
      repo: rootMatch[2],
      repoUrl: `https://github.com/${rootMatch[1]}/${rootMatch[2]}.git`,
      isSubdirectory: false,
    };
  }

  // If it doesn't match GitHub patterns, assume it's a direct git URL
  return {
    repoUrl: url,
    isSubdirectory: false,
  };
}

/**
 * Clone a subdirectory from a git repository using sparse checkout
 * Uses '--' to prevent command injection via malicious URLs starting with '--upload-pack'
 */
export async function cloneSubdirectory(
  repoUrl: string,
  branch: string,
  subdirectory: string,
  targetFolder: string,
): Promise<void> {
  const tempFolder = `${targetFolder}.tmp`;

  try {
    // Initialize a new git repo
    await execGit(['init', tempFolder]);

    // Add remote (use '--' to prevent URL injection)
    await execGit(['remote', 'add', 'origin', '--', repoUrl], tempFolder);

    // Enable sparse checkout
    await execGit(['config', 'core.sparseCheckout', 'true'], tempFolder);

    // Configure sparse checkout to only include the subdirectory
    const sparseCheckoutFile = path.join(tempFolder, '.git', 'info', 'sparse-checkout');
    await writeFile(sparseCheckoutFile, `${subdirectory}\n`);

    // Pull the specific branch (use '--' to prevent branch name injection)
    await execGit(['pull', '--depth=1', 'origin', '--', branch], tempFolder);

    // Move the subdirectory content to target folder
    const sourceDir = path.join(tempFolder, subdirectory);
    if (!(await pathExists(sourceDir))) {
      throw new Error(
        `Subdirectory '${subdirectory}' not found in repository at branch '${branch}'`,
      );
    }

    // Check if target folder already exists
    if (await pathExists(targetFolder)) {
      throw new Error(`Target folder already exists: ${targetFolder}`);
    }

    await move(sourceDir, targetFolder);

    // Clean up temp folder
    await remove(tempFolder);
  } catch (error) {
    // Clean up temp folder on error
    if (await pathExists(tempFolder)) {
      await remove(tempFolder);
    }
    throw error;
  }
}

/**
 * Clone entire repository
 * Uses '--' to prevent command injection via malicious URLs starting with '--upload-pack'
 */
export async function cloneRepository(repoUrl: string, targetFolder: string): Promise<void> {
  await execGit(['clone', '--', repoUrl, targetFolder]);

  // Remove .git folder
  const gitFolder = path.join(targetFolder, '.git');
  if (await pathExists(gitFolder)) {
    await remove(gitFolder);
  }
}

/**
 * GitHub API content item interface
 */
interface GitHubContentItem {
  name: string;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string | null;
}

/**
 * Fetch directory listing from GitHub API
 */
export async function fetchGitHubDirectoryContents(
  owner: string,
  repo: string,
  path: string,
  branch = 'main',
): Promise<Array<{ name: string; type: string; path: string }>> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;

  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'scaffold-mcp',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch directory contents: ${response.statusText}`);
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error('Expected directory but got file');
  }

  return data.map((item: GitHubContentItem) => ({
    name: item.name,
    type: item.type,
    path: item.path,
  }));
}
