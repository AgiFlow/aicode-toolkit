import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { Liquid } from 'liquidjs';

async function renderSettingsTemplate() {
  const templatePath = new URL('../../src/templates/settings.yaml.liquid', import.meta.url);
  const template = await readFile(templatePath, 'utf-8');
  const liquid = new Liquid();

  return liquid.parseAndRender(template, {
    projectType: 'monolith',
    templatesPath: 'templates',
    sourceTemplate: 'nextjs-15-drizzle',
    fallbackTool: 'gemini-cli',
    fallbackToolConfig: {
      model: 'gemini-2.0-flash',
    },
  });
}

describe('settings.yaml.liquid', () => {
  it('renders the current settings surface for init-generated config', async () => {
    const content = await renderSettingsTemplate();

    expect(content).toContain('projectType: monolith');
    expect(content).toContain('templatesPath: templates');
    expect(content).toContain('sourceTemplate: nextjs-15-drizzle');
    expect(content).toContain('fallbackTool: gemini-cli');
    expect(content).toContain('model: gemini-2.0-flash');
    expect(content).toContain('# fallbacks:');
    expect(content).toContain('# matcher: Edit|MultiEdit|Write');
    expect(content).toContain('# Set llm-tool only if you want LLM-based review. A cheap model is recommended.');
    expect(content).toContain('# Local overrides go in .toolkit/settings.local.yaml');
    expect(content).toContain('userPromptSubmit:');
    expect(content).toContain('taskCompleted:');
    expect(content).toContain('stop:');
  });
});
