import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const packageDirectories = [
  ...directoriesIn(path.join(root, 'packages')),
  ...directoriesIn(path.join(root, 'apps')),
].filter((directory) => fs.existsSync(path.join(directory, 'package.json')));

function directoriesIn(directory) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(directory, entry.name));
}

for (const directory of packageDirectories.sort()) {
  const manifestPath = path.join(directory, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.private === true) {
    continue;
  }
  if (process.argv.includes('--paths')) {
    console.log(path.relative(root, manifestPath));
    continue;
  }
  console.log(`${manifest.name}\t${manifest.version}`);
}
