import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'plugins/catalog.json'), 'utf8'));
const check = process.argv.includes('--check');
const generated = new Map();
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const add = (file, text) => {
  const full = path.join(root, file);
  if (file.endsWith('.json')) {
    text = execFileSync(path.join(root, 'node_modules/.bin/oxfmt'), [`--stdin-filepath=${file}`], {
      cwd: root,
      input: text,
      encoding: 'utf8',
    });
  }
  generated.set(full, text);
};

function servers(plugin) {
  return Object.fromEntries(
    plugin.servers.map((key) => {
      const id = `aicode-${key}${plugin.admin ? '-admin' : ''}`;
      return [
        id,
        {
          command: 'npx',
          args: [
            '-y',
            catalog.packages[key],
            'mcp-serve',
            '--type',
            'stdio',
            ...(plugin.admin ? ['--admin-enable'] : []),
          ],
        },
      ];
    }),
  );
}

add(
  '.claude-plugin/marketplace.json',
  json({
    name: catalog.name,
    owner: catalog.owner,
    metadata: {
      description: 'Purpose-based AI development tools for six coding clients.',
      version: catalog.version,
    },
    plugins: catalog.plugins.map((plugin) => ({
      name: plugin.name,
      source: `./plugins/${plugin.name}`,
      description: plugin.description,
      version: catalog.version,
    })),
  }),
);
add(
  '.agents/plugins/marketplace.json',
  json({
    name: catalog.name,
    interface: { displayName: 'AI Code Toolkit' },
    plugins: catalog.plugins.map((plugin) => ({
      name: plugin.name,
      source: { source: 'local', path: `./plugins/${plugin.name}` },
      policy: { installation: 'AVAILABLE', authentication: 'ON_USE' },
      category: 'Productivity',
    })),
  }),
);

for (const plugin of catalog.plugins) {
  const prefix = `plugins/${plugin.name}`;
  const author = { name: catalog.owner.name, email: catalog.owner.email };
  const core = {
    name: plugin.name,
    version: catalog.version,
    description: plugin.description,
    author,
    repository: 'https://github.com/AgiFlow/aicode-toolkit',
    license: 'AGPL-3.0',
  };
  const mcp = { mcpServers: servers(plugin) };
  add(`${prefix}/.claude-plugin/plugin.json`, json(core));
  add(
    `${prefix}/.codex-plugin/plugin.json`,
    json({
      ...core,
      skills: './skills/',
      mcpServers: './.mcp.json',
      interface: {
        displayName: plugin.name,
        shortDescription: plugin.description,
        developerName: catalog.owner.name,
        category: 'Productivity',
        capabilities: ['Read', 'Write'],
      },
    }),
  );
  add(`${prefix}/.cursor-plugin/plugin.json`, json({ ...core, displayName: plugin.name }));
  add(`${prefix}/.mcp.json`, json(mcp));
  add(`${prefix}/mcp.json`, json(mcp));
  add(
    `${prefix}/gemini-extension.json`,
    json({
      name: plugin.name,
      version: catalog.version,
      description: plugin.description,
      mcpServers: servers(plugin),
      contextFileName: 'GEMINI.md',
    }),
  );
  add(
    `${prefix}/GEMINI.md`,
    `# ${plugin.name}\n\n${plugin.description}\n\nRead the relevant skill under \`skills/\` for workflow guidance. Run the MCP server in the consumer project, not the extension installation directory. Before enabling scaffold-backed servers, initialize the consumer project interactively with \`npx -y @agiflowai/aicode-toolkit@2.0.0 init --skip-mcp\`. Workspace configuration may enable admin tools and nested agent backends.\n`,
  );
  add(`${prefix}/LICENSE`, fs.readFileSync(path.join(root, 'LICENSE'), 'utf8'));
  if (plugin.name === 'aicode-develop') {
    const command = fs.readFileSync(
      path.join(root, prefix, 'commands/edit-with-pattern.md'),
      'utf8',
    );
    add(
      `${prefix}/commands/edit-with-pattern.toml`,
      `description = "Edit files using repository design patterns and review results"\nprompt = ${JSON.stringify(command)}\n`,
    );
  }
}

let failures = 0;
for (const [file, content] of generated) {
  if (check) {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content) {
      console.error(`Outdated generated file: ${path.relative(root, file)}`);
      failures++;
    }
  } else {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
}
if (failures) process.exitCode = 1;
else console.log(`${check ? 'Verified' : 'Generated'} ${generated.size} plugin files`);
