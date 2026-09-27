import type { GetPromptResult } from '@modelcontextprotocol/server';

export interface PromptArgument {
  name: string;
  description: string;
  required?: boolean;
}

export type PromptContent = GetPromptResult['messages'][number]['content'];

export interface PromptDefinition {
  name: string;
  description: string;
  arguments?: PromptArgument[];
}

export interface PromptMessage {
  role: 'user' | 'assistant';
  content: PromptContent;
}

export interface Prompt {
  getDefinition(): PromptDefinition;
  execute(args: Record<string, string | undefined>): Promise<GetPromptResult>;
}

export function isPromptDefinition(value: unknown): value is PromptDefinition {
  return typeof value === 'object' && value !== null && 'name' in value && 'description' in value;
}

export function isPromptMessage(value: unknown): value is PromptMessage {
  return typeof value === 'object' && value !== null && 'role' in value && 'content' in value;
}
