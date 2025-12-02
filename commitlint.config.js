module.exports = {
  extends: ['@commitlint/config-nx-scopes'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'aicode-toolkit',
        'aicode-utils',
        'hooks-adapter',
        'coding-agent-bridge',
        'scaffold-mcp',
        'architect-mcp',
        'one-mcp',
        'release', // Allow 'release' scope for nx release commits
      ],
    ],
  },
};
