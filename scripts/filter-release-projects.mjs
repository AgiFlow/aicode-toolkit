import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import process from 'node:process';

const releaseProjects = execFileSync('node', ['scripts/list-packages.mjs'], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .map((line) => line.split('\t')[0]);

const [affectedFile] = process.argv.slice(2);
if (!affectedFile || affectedFile === '--all') {
  console.log(releaseProjects.join(','));
  process.exit(0);
}

const affected = new Set(JSON.parse(fs.readFileSync(affectedFile, 'utf8')));
console.log(releaseProjects.filter((project) => affected.has(project)).join(','));
