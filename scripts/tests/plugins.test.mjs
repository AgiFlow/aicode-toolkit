import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const script = path.join(root, 'scripts/validate-plugins.mjs');
const run = (file, args = []) => spawnSync(process.execPath, [file, ...args], { encoding: 'utf8' });

test('should validate all independent plugin roots', () => {
  assert.equal(run(script).status, 0);
  assert.equal(run(path.join(root, 'scripts/generate-plugins.mjs'), ['--check']).status, 0);
  assert.equal(run(script).status, 0);
});

function fixture(mutator) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'aicode-plugins-'));
  try {
    fs.cpSync(path.join(root, 'plugins'), path.join(directory, 'plugins'), { recursive: true });
    fs.cpSync(path.join(root, '.claude-plugin'), path.join(directory, '.claude-plugin'), {
      recursive: true,
    });
    fs.cpSync(path.join(root, '.agents'), path.join(directory, '.agents'), { recursive: true });
    fs.mkdirSync(path.join(directory, 'scripts'));
    fs.copyFileSync(script, path.join(directory, 'scripts/validate-plugins.mjs'));
    mutator(directory);
    return run(path.join(directory, 'scripts/validate-plugins.mjs'));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('should reject missing packaged skill assets', () => {
  const result = fixture((dir) =>
    fs.rmSync(path.join(dir, 'plugins/aicode-review/skills/review-changes/SKILL.md')),
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing asset/);
});

test('should reject plugin version drift', () => {
  const result = fixture((dir) => {
    const file = path.join(dir, 'plugins/aicode-admin/gemini-extension.json');
    const content = JSON.parse(fs.readFileSync(file, 'utf8'));
    content.version = '99.0.0';
    fs.writeFileSync(file, JSON.stringify(content));
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Expected values to be strictly equal/);
});

test('should reject marketplace paths outside installation roots', () => {
  const result = fixture((dir) => {
    const file = path.join(dir, '.claude-plugin/marketplace.json');
    const content = JSON.parse(fs.readFileSync(file, 'utf8'));
    content.plugins[0].source = '../missing';
    fs.writeFileSync(file, JSON.stringify(content));
  });
  assert.notEqual(result.status, 0);
});

test('should reject corrupted Gemini commands', () => {
  const result = fixture((dir) => {
    fs.writeFileSync(
      path.join(dir, 'plugins/aicode-develop/commands/edit-with-pattern.toml'),
      'description = "bad"\nprompt = "unterminated\n',
    );
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unterminated string|Unexpected end|SyntaxError/);
});
