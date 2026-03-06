import type { RuleSection } from '../types';

const MUTATING_TOOL_NAMES = new Set(['edit', 'multiedit', 'write', 'update']);

export function isMutatingFileTool(toolName: string): boolean {
  return MUTATING_TOOL_NAMES.has(toolName.toLowerCase());
}

export function summarizeRulesForAgentReview(rules: RuleSection): string {
  const parts: string[] = [
    'LLM review is disabled for this hook. Apply these rules during your next edit pass:',
  ];

  appendRuleSection(parts, 'MUST DO', rules.must_do);
  appendRuleSection(parts, 'MUST NOT DO', rules.must_not_do);
  appendRuleSection(parts, 'SHOULD DO', rules.should_do, 2);

  return parts.join('\n');
}

function appendRuleSection(
  parts: string[],
  label: string,
  rules: RuleSection['must_do'] | RuleSection['should_do'] | RuleSection['must_not_do'],
  limit = 4,
): void {
  if (!rules || rules.length === 0) return;

  parts.push(`\n${label}:`);

  for (const rule of rules.slice(0, limit)) {
    parts.push(`- ${rule.rule}`);
  }

  if (rules.length > limit) {
    parts.push(`- ...and ${rules.length - limit} more`);
  }
}
