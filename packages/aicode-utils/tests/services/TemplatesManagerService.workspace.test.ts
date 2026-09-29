import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { TemplatesManagerService } from '../../src/services/TemplatesManagerService';

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('explicit non-Git workspaces', () => {
  it('resolves two independent template roots without changing process.cwd()', async () => {
    const original = process.cwd();
    for (let index = 0; index < 2; index++) {
      const directory = await mkdtemp(path.join(tmpdir(), 'scaffold-workspace-'));
      directories.push(directory);
      const templates = path.join(directory, 'templates');
      await mkdir(templates);
      expect(TemplatesManagerService.findTemplatesPathSync(directory)).toBe(templates);
      await expect(TemplatesManagerService.findTemplatesPath(directory)).resolves.toBe(templates);
    }
    expect(process.cwd()).toBe(original);
  });
});
