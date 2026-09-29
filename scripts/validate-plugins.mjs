import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const catalog = read('plugins/catalog.json');
const claude = read('.claude-plugin/marketplace.json');
const codex = read('.agents/plugins/marketplace.json');
const names = catalog.plugins.map((plugin) => plugin.name);
assert.equal(new Set(names).size, names.length, 'Plugin names must be unique');
assert.deepEqual(
  claude.plugins.map((p) => p.name),
  names,
);
assert.deepEqual(
  codex.plugins.map((p) => p.name),
  names,
);

function inside(base, relative) {
  assert.equal(path.isAbsolute(relative), false, `Absolute path: ${relative}`);
  const full = path.resolve(base, relative);
  assert.ok(full.startsWith(`${base}${path.sep}`), `Path escapes plugin root: ${relative}`);
  assert.ok(fs.existsSync(full), `Missing asset: ${full}`);
  const real = fs.realpathSync(full);
  assert.ok(real.startsWith(`${base}${path.sep}`), `Symlink escapes plugin root: ${relative}`);
  return full;
}

function checkTree(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const item = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      assert.ok(
        fs.realpathSync(item).startsWith(`${dir}${path.sep}`),
        `Unexpected symlink: ${item}`,
      );
    } else if (entry.isDirectory()) {
      checkTree(item);
    }
  }
}

for (const [index, plugin] of catalog.plugins.entries()) {
  const base = path.join(root, 'plugins', plugin.name);
  assert.equal(path.resolve(root, claude.plugins[index].source), base);
  assert.equal(path.resolve(root, codex.plugins[index].source.path), base);
  assert.equal(claude.plugins[index].version, catalog.version);
  const pluginManifest = read(`plugins/${plugin.name}/.claude-plugin/plugin.json`);
  const codexManifest = read(`plugins/${plugin.name}/.codex-plugin/plugin.json`);
  const cursorManifest = read(`plugins/${plugin.name}/.cursor-plugin/plugin.json`);
  const geminiManifest = read(`plugins/${plugin.name}/gemini-extension.json`);
  for (const manifest of [pluginManifest, codexManifest, cursorManifest, geminiManifest]) {
    assert.equal(manifest.name, plugin.name);
    assert.equal(manifest.version, catalog.version);
  }
  for (const asset of [
    'README.md',
    'LICENSE',
    'GEMINI.md',
    'gemini-extension.json',
    'mcp.json',
    '.mcp.json',
    'skills',
    '.claude-plugin/plugin.json',
    '.codex-plugin/plugin.json',
    '.cursor-plugin/plugin.json',
  ])
    inside(base, asset);
  inside(base, codexManifest.skills);
  inside(base, codexManifest.mcpServers);
  inside(base, geminiManifest.contextFileName);
  const mcp = read(`plugins/${plugin.name}/.mcp.json`).mcpServers;
  assert.deepEqual(mcp, read(`plugins/${plugin.name}/mcp.json`).mcpServers);
  assert.deepEqual(mcp, geminiManifest.mcpServers);
  assert.equal(Object.keys(mcp).length, plugin.servers.length);
  for (const [key, server] of Object.entries(mcp)) {
    assert.ok(/^aicode-/.test(key));
    assert.equal(server.command, 'npx');
    assert.ok(server.args.includes('--type') && server.args.includes('stdio'));
    assert.equal(server.args.includes('--admin-enable'), Boolean(plugin.admin));
    assert.ok(server.args.every((arg) => !arg.includes('/src/') && !arg.includes('@latest')));
    assert.ok(server.args.some((arg) => Object.values(catalog.packages).includes(arg)));
  }
  for (const skill of plugin.skills) {
    const text = fs.readFileSync(inside(base, `skills/${skill}/SKILL.md`), 'utf8');
    assert.match(text, new RegExp(`^---\\nname: ${skill}\\n`, 'm'));
    assert.match(text, /\ndescription: [^\n]+\n---\n/);
  }
  if (plugin.name === 'aicode-develop') {
    const command = fs.readFileSync(inside(base, 'commands/edit-with-pattern.md'), 'utf8');
    const toml = fs.readFileSync(inside(base, 'commands/edit-with-pattern.toml'), 'utf8');
    const lines = toml.trimEnd().split('\n');
    assert.equal(lines.length, 2, 'Unexpected Gemini command fields');
    assert.match(lines[0], /^description = "(?:[^"\\]|\\.)*"$/);
    assert.ok(lines[1].startsWith('prompt = "'), 'Invalid Gemini command prompt');
    assert.equal(JSON.parse(lines[1].slice('prompt = '.length)), command);
  }
  checkTree(base);
}
console.log(`Validated ${names.length} self-contained plugin roots`);
