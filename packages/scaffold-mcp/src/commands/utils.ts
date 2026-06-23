import { ProjectConfigResolver, TemplatesManagerService, readFile } from '@agiflowai/aicode-utils';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export function parseJsonOption<T>(value: string | undefined, flagName: string): T {
  if (!value) {
    throw new Error(`${flagName} is required`);
  }

  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new Error(
      `Invalid JSON for ${flagName}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function resolveTemplatesPath(): Promise<string> {
  const templatesDir = await TemplatesManagerService.findTemplatesPath();
  if (!templatesDir) {
    throw new Error(
      'Templates folder not found. Create a templates folder or specify templatesPath in toolkit.yaml',
    );
  }
  return templatesDir;
}

export async function detectMonolithMode(): Promise<boolean> {
  try {
    const projectConfig = await ProjectConfigResolver.resolveProjectConfig(process.cwd());
    return projectConfig.type === 'monolith';
  } catch {
    return false;
  }
}

export async function loadTextOption(config: {
  value?: string;
  filePath?: string;
  valueFlag: string;
  fileFlag: string;
  required?: boolean;
}): Promise<string | undefined> {
  const { value, filePath, valueFlag, fileFlag, required = false } = config;

  if (value !== undefined && filePath !== undefined) {
    throw new Error(`Use only one of ${valueFlag} or ${fileFlag}`);
  }

  if (filePath !== undefined) {
    return readFile(filePath, 'utf-8');
  }

  if (value !== undefined) {
    return value;
  }

  if (required) {
    throw new Error(`${valueFlag} or ${fileFlag} is required`);
  }

  return undefined;
}

export function collectOption(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

export function firstTextContent(result: CallToolResult): string {
  const firstContent = result.content[0];
  return firstContent?.type === 'text' ? firstContent.text : '';
}

export function assertToolSuccess(result: CallToolResult): string {
  const text = firstTextContent(result);
  if (result.isError) {
    throw new Error(text || 'Tool execution failed');
  }
  return text;
}
