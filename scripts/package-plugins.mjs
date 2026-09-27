import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { plugins } = JSON.parse(fs.readFileSync(path.join(root, 'plugins/catalog.json'), 'utf8'));
execFileSync(process.execPath, [path.join(root, 'scripts/validate-plugins.mjs')], {
  stdio: 'inherit',
});
const output = path.join(root, 'dist/plugins');
fs.mkdirSync(output, { recursive: true });
for (const plugin of plugins) {
  const archive = path.join(output, `${plugin.name}.tar.gz`);
  execFileSync('tar', ['-czf', archive, '-C', path.join(root, 'plugins', plugin.name), '.']);
  const contents = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' });
  for (const required of [
    './.claude-plugin/plugin.json',
    './.codex-plugin/plugin.json',
    './.cursor-plugin/plugin.json',
    './.mcp.json',
    './skills/',
  ]) {
    if (!contents.includes(required)) throw new Error(`Missing ${required} in ${archive}`);
  }
  console.log(path.relative(root, archive));
}
