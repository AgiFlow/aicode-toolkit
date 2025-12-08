/**
 * Git Utilities
 *
 * DESIGN PATTERNS:
 * - Safe command execution: Use execa with array arguments to prevent shell injection
 * - Defense in depth: Use '--' separator to prevent option injection attacks
 *
 * CODING STANDARDS:
 * - All git commands must use execGit helper with array arguments
 * - Use '--' separator before user-provided arguments (URLs, branches, paths)
 * - Validate inputs where appropriate
 *
 * AVOID:
 * - Shell string interpolation
 * - Passing unsanitized user input as command options
 *
 * NOTE: These utilities perform I/O operations (git commands, file system) by necessity.
 * Pure utility functions like parseGitHubUrl are side-effect free.
 */

import path from 'node:path';
import { execa } from 'execa';
import { pathExists, writeFile, move, remove } from './fsHelpers';

/**
 * Type guard to check if an error has the expected execa error shape
 * @param error - The error to check
 * @returns True if the error has message property (and optionally stderr)
 * @example
 * try {
 *   await execa('git', ['status']);
 * } catch (error) {
 *   if (isExecaError(error)) {
 *     console.error(error.stderr || error.message);
 *   }
 * }
 */
function isExecaError(error: unknown): error is { stderr?: string; message: string } {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  if (!('message' in error)) {
    return false;
  }
  const errorObj = error as Record<string, unknown>;
  return typeof errorObj.message === 'string';
}

/**
 * Parsed GitHub URL result
 */
export interface ParsedGitHubUrl {
  owner?: string;
  repo?: string;
  repoUrl: string;
  branch?: string;
  subdirectory?: string;
  isSubdirectory: boolean;
}

/**
 * GitHub directory entry
 */
export interface GitHubDirectoryEntry {
  name: string;
  type: string;
  path: string;
}

/**
 * Execute a git command safely using execa to prevent command injection
 * @param args - Array of git command arguments
 * @param cwd - Optional working directory for the command
 * @throws Error when git command fails
 */
async function execGit(args: string[], cwd?: string): Promise<void> {
  try {
    await execa('git', args, { cwd });
  } catch (error) {
    if (isExecaError(error)) {
      throw new Error(`Git command failed: ${error.stderr || error.message}`);
    }
    throw error;
  }
}

/**
 * Execute git init safely using execa to prevent command injection
 * Uses '--' to prevent projectPath from being interpreted as an option
 * @param projectPath - Path where to initialize the git repository
 * @throws Error when git init fails
 */
export async function gitInit(projectPath: string): Promise<void> {
  try {
    await execa('git', ['init', '--', projectPath]);
  } catch (error) {
    if (isExecaError(error)) {
      throw new Error(`Git init failed: ${error.stderr || error.message}`);
    }
    throw error;
  }
}

/**
 * Find the workspace root by searching upwards for .git folder
 * Returns null if no .git folder is found (indicating a new project setup is needed)
 * @param startPath - The path to start searching from (default: current working directory)
 * @returns The workspace root path or null if not in a git repository
 * @example
 * const root = await findWorkspaceRoot('/path/to/project/src');
 * if (root) {
 *   console.log('Workspace root:', root);
 * } else {
 *   console.log('No git repository found');
 * }
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
 * @param url - The GitHub URL to parse
 * @returns Parsed URL components including owner, repo, branch, and subdirectory
 * @example
 * const result = parseGitHubUrl('https://github.com/user/repo/tree/main/src');
 * // result.owner === 'user'
 * // result.repo === 'repo'
 * // result.branch === 'main'
 * // result.subdirectory === 'src'
 * // result.isSubdirectory === true
 */
export function parseGitHubUrl(url: string): ParsedGitHubUrl {
  // Match: https://github.com/(owner)/(repo)/tree/(branch)/(path...)
  const treeMatch = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)$/);
  // Match: https://github.com/(owner)/(repo)/blob/(branch)/(path...)
  const blobMatch = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/);
  // Match: https://github.com/(owner)/(repo) with optional .git suffix
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
 * Uses '--' to mark end of options - prevents malicious URLs like '--upload-pack=evil'
 * from being interpreted as git options
 * @param repoUrl - The git repository URL
 * @param branch - The branch to clone from
 * @param subdirectory - The subdirectory path within the repository
 * @param targetFolder - The local folder to clone into
 * @throws Error if subdirectory not found or target folder already exists
 * @example
 * await cloneSubdirectory(
 *   'https://github.com/user/repo.git',
 *   'main',
 *   'packages/core',
 *   './my-project'
 * );
 */
export async function cloneSubdirectory(
  repoUrl: string,
  branch: string,
  subdirectory: string,
  targetFolder: string,
): Promise<void> {
  const tempFolder = `${targetFolder}.tmp`;

  try {
    // Initialize a new git repo (use '--' to prevent tempFolder injection)
    await execGit(['init', '--', tempFolder]);

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
 * Uses '--' to mark end of options - prevents malicious URLs like '--upload-pack=evil'
 * from being interpreted as git options
 * @param repoUrl - The git repository URL to clone
 * @param targetFolder - The local folder path to clone into
 * @throws Error if git clone fails
 * @example
 * await cloneRepository('https://github.com/user/repo.git', './my-project');
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
 * Type guard to validate GitHub API content item structure
 * @param item - The item to validate
 * @returns True if the item has required GitHubContentItem properties
 */
function isGitHubContentItem(item: unknown): item is GitHubContentItem {
  if (typeof item !== 'object' || item === null) {
    return false;
  }
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.name === 'string' && typeof obj.type === 'string' && typeof obj.path === 'string'
  );
}

/**
 * Fetch directory listing from GitHub API
 * @param owner - The GitHub repository owner/organization
 * @param repo - The repository name
 * @param dirPath - The directory path within the repository
 * @param branch - The branch to fetch from (default: 'main')
 * @returns Array of directory entries with name, type, and path
 * @throws Error if the API request fails or returns non-directory content
 * @remarks
 * - Requires network access to GitHub API
 * - Subject to GitHub API rate limits (60 requests/hour unauthenticated)
 * - Only works with public repositories without authentication
 * @example
 * const contents = await fetchGitHubDirectoryContents('facebook', 'react', 'packages', 'main');
 * // contents: [{ name: 'react', type: 'dir', path: 'packages/react' }, ...]
 */
export async function fetchGitHubDirectoryContents(
  owner: string,
  repo: string,
  dirPath: string,
  branch = 'main',
): Promise<GitHubDirectoryEntry[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${dirPath}?ref=${branch}`;

  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'scaffold-mcp',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch directory contents: ${response.statusText}`);
  }

  const data: unknown = await response.json();

  if (!Array.isArray(data)) {
    throw new Error('Expected directory but got file');
  }

  return data.filter(isGitHubContentItem).map(
    (item: GitHubContentItem): GitHubDirectoryEntry => ({
      name: item.name,
      type: item.type,
      path: item.path,
    }),
  );
}
