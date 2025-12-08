# Publishing Packages to npm

This guide explains how to publish packages from this monorepo to npm using Nx Release.

## Prerequisites

1. **npm account**: You need an npm account with access to publish under the `@agiflowai` scope
2. **Authentication**: Set up npm authentication using one of these methods:
   - Run `npm login` to authenticate interactively
   - Set `NPM_TOKEN` environment variable with your npm token
   - Uncomment and configure the auth line in `.npmrc`

## Package Configuration

All packages are configured for publishing:

- `@agiflowai/aicode-utils` - Shared utilities and types
- `@agiflowai/scaffold-mcp` - MCP server for scaffolding with CLI
- `@agiflowai/architect-mcp` - MCP server for design patterns and code review

### Key Configuration Details

- **Access**: Both packages use `publishConfig.access: "public"` for public npm packages
- **Files**: Only `dist` and `README.md` are published (via `files` field)
- **Workspace Dependencies**: `workspace:*` protocol is automatically converted to actual versions during publish
- **License**: AGPL-3.0

## Publishing Workflow

### 1. First-Time Release

For the initial release (already at version 0.0.1):

```bash
# Preview what will happen (recommended)
pnpm exec nx release --first-release --dry-run
# or use the npm script
pnpm release:dry-run -- --first-release

# Review the output, then publish
pnpm exec nx release --first-release
# or use the npm script
pnpm release -- --first-release
```

This will:
- ✅ Skip version bumping (already at 0.0.1)
- ✅ Generate changelogs
- ✅ Create git tags
- ✅ Build packages
- ✅ Publish to npm registry

### 2. Subsequent Releases

After the first release, use the standard workflow:

```bash
# Always start with dry-run
pnpm exec nx release --dry-run
# or use the npm script
pnpm release:dry-run

# Review and confirm, then publish
pnpm exec nx release
# or use the npm script
pnpm release
```

### 3. Version Bumping Options

Nx Release supports both semver keywords and exact version numbers. The version is passed as a **positional argument** (not a flag):

```bash
# Patch release (0.0.1 -> 0.0.2)
pnpm exec nx release patch

# Minor release (0.0.1 -> 0.1.0)
pnpm exec nx release minor

# Major release (0.0.1 -> 1.0.0)
pnpm exec nx release major

# Specific exact version (recommended for precise control)
pnpm exec nx release 0.1.0
pnpm exec nx release 1.2.3

# Using the version subcommand (equivalent)
pnpm exec nx release version 0.1.0

# Prerelease versions
pnpm exec nx release prerelease --preid=alpha
# Creates version like 1.0.1-alpha.0

# Always preview first
pnpm exec nx release 0.2.0 --dry-run
```

**Important**: The version specifier is a positional argument, so use `nx release 1.2.3`, NOT `nx release --version=1.2.3`.

### 4. Publishing Individual Packages

You can version and publish packages independently:

```bash
# Version and publish a specific package with exact version
pnpm exec nx release 0.2.0 --projects=@agiflowai/aicode-utils

# Bump specific package with semver keyword
pnpm exec nx release patch --projects=@agiflowai/scaffold-mcp

# Preview first (always recommended)
pnpm exec nx release 1.0.0 --projects=@agiflowai/one-mcp --dry-run

# Version only (without publishing)
pnpm exec nx release version 0.3.0 --projects=@agiflowai/architect-mcp

# Publish only (after versioning)
pnpm exec nx release publish --projects=@agiflowai/architect-mcp
```

**Workflow for independent package releases:**

1. **Version the package**: `pnpm exec nx release version 0.2.0 --projects=@agiflowai/aicode-utils --dry-run`
2. **Review changes**: Check the version updates and changelog
3. **Apply version**: `pnpm exec nx release version 0.2.0 --projects=@agiflowai/aicode-utils`
4. **Publish**: `pnpm exec nx release publish --projects=@agiflowai/aicode-utils`

Or combine versioning and publishing in one command:
```bash
pnpm exec nx release 0.2.0 --projects=@agiflowai/aicode-utils
```

### 5. Advanced Publishing Options

The `nx release publish` command supports additional options:

```bash
# Publish to a specific registry
pnpm exec nx release publish --registry=https://custom-registry.com

# Publish with a specific distribution tag (e.g., 'beta', 'next')
pnpm exec nx release publish --tag=beta

# Override access level (public/restricted)
pnpm exec nx release publish --access=public

# Publish with 2FA one-time password
pnpm exec nx release publish --otp=123456

# Dry run to preview what will be published
pnpm exec nx release publish --dry-run

# Publish specific packages only
pnpm exec nx release publish --projects=@agiflowai/aicode-utils,@agiflowai/scaffold-mcp
```

**Common use cases:**

```bash
# Beta release with beta tag
pnpm exec nx release version prerelease --preid=beta
pnpm exec nx release publish --tag=beta

# Publish to a private registry
pnpm exec nx release publish --registry=https://npm.mycompany.com

# First time publishing (skip existence check)
pnpm exec nx release publish --first-release
```

## Nx Release Configuration

The release process is configured in `nx.json`:

```json
{
  "release": {
    "projects": ["packages/*"],
    "version": {
      "conventionalCommits": true,
      "generatorOptions": {
        "updateDependents": "auto"
      }
    },
    "changelog": {
      "projectChangelogs": {
        "createRelease": "github",
        "renderOptions": {
          "authors": true
        }
      }
    }
  }
}
```

Key features:
- **Conventional Commits**: Automatically determines version bump based on commit messages
- **Update Dependents**: Automatically updates dependent packages when dependencies change
- **GitHub Releases**: Creates GitHub releases with changelog
- **Author Attribution**: Includes commit authors in changelogs

## CI/CD Publishing

### GitHub Actions Example

Create `.github/workflows/publish.yml`:

```yaml
name: Publish Packages

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to publish (leave empty for auto)'
        required: false

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}

      - uses: pnpm/action-setup@v2
        with:
          version: 10.18.0

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build packages
        run: pnpm build

      - name: Configure npm
        run: |
          echo "//registry.npmjs.org/:_authToken=${{ secrets.NPM_TOKEN }}" > ~/.npmrc

      - name: Publish packages
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          if [ -z "${{ github.event.inputs.version }}" ]; then
            pnpm exec nx release --yes
          else
            pnpm exec nx release ${{ github.event.inputs.version }} --yes
          fi
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Required Secrets

Add to your GitHub repository settings:
- `NPM_TOKEN`: Your npm access token (create at https://www.npmjs.com/settings/tokens)

## Troubleshooting

### Authentication Issues

If you get authentication errors:

```bash
# Login to npm
npm login

# Or set NPM_TOKEN environment variable
export NPM_TOKEN=your-token-here
```

### Workspace Dependencies

The `workspace:*` protocol in package dependencies (e.g., `scaffold-mcp` and `architect-mcp` depending on `aicode-utils`) is automatically converted to the actual version during publishing. You don't need to manually update this.

### Build Before Publish

Always ensure packages are built before publishing:

```bash
# Build all packages
pnpm build

# Or build specific package
pnpm exec nx build scaffold-mcp
```

### Verify Published Packages

After publishing, verify on npm:

- https://www.npmjs.com/package/@agiflowai/aicode-utils
- https://www.npmjs.com/package/@agiflowai/scaffold-mcp
- https://www.npmjs.com/package/@agiflowai/architect-mcp

## Best Practices

1. **Always use --dry-run first**: Preview changes before publishing
2. **Use conventional commits**: Enables automatic version bumping
   - `feat:` → minor version bump
   - `fix:` → patch version bump
   - `BREAKING CHANGE:` → major version bump
3. **Test packages locally**: Use `npm pack` to test package contents
4. **Review changelogs**: Ensure generated changelogs are accurate
5. **Tag releases**: Nx Release automatically creates git tags
6. **Document breaking changes**: Always document breaking changes in commit messages

## Resources

- [Nx Release Documentation](https://nx.dev/features/manage-releases)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [npm Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
