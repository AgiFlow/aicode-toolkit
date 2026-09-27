import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// Prints the CHANGELOG.md section nx release wrote for one package version, which
// becomes the body of that version's GitHub release.

const [manifestPath, version] = process.argv.slice(2);
if (!manifestPath || !version) {
  throw new Error('Usage: node scripts/changelog-section.mjs <package.json path> <version>');
}

const changelogPath = path.join(path.dirname(manifestPath), 'CHANGELOG.md');
const lines = fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath, 'utf8').split('\n') : [];
const start = lines.findIndex((line) => line.startsWith(`## ${version} `) || line === `## ${version}`);
if (start === -1) {
  console.log(`No changelog entry was recorded for ${version}.`);
  process.exit(0);
}

const end = lines.findIndex((line, index) => index > start && line.startsWith('## '));
console.log(
  lines
    .slice(start, end === -1 ? undefined : end)
    .join('\n')
    .trim(),
);
