# Contributing to AI Code Toolkit

> Help us scale AI coding agents with better scaffolding, patterns, and validation!

Thank you for considering contributing to AI Code Toolkit! We're excited to have you join our community. This guide will help you get started and ensure a smooth contribution process.

---

## Contents

- [Found an Issue?](#found-an-issue)
- [Want to Contribute?](#want-to-contribute)
  - [Coding Rules](#coding-rules)
  - [Commit Rules](#commit-rules)
  - [Environment Setup](#environment-setup)
  - [Testing](#testing)
  - [Documentation Updates](#documentation-updates)
- [Pull Request Process](#pull-request-process)
- [Package Dependency Overview](#package-dependency-overview)

---

## Found an Issue?

Thank you for reporting issues! Your feedback helps make AI Code Toolkit more robust.

**When reporting issues, please:**

- **Title format:** `<Error> when <Task>` (e.g., "Template validation fails when using custom variables")
- **Add labels:** Tag with `bug`, `enhancement`, `documentation`, etc.
- **Include details:**
  - Short summary of what you're trying to do
  - Steps to reproduce the issue
  - Error logs or stack traces (if applicable)
  - Exact version: `npm ls @agiflowai/scaffold-mcp`
  - Node.js version: `node --version`
  - Operating system
- **Be awesome:** Consider contributing a [pull request](#want-to-contribute) with a fix!

**Report issues here:** [GitHub Issues](https://github.com/AgiFlow/aicode-toolkit/issues)

---

## Want to Contribute?

We appreciate all contributions! Please follow these guidelines when submitting pull requests.

### Coding Rules

> Keep the codebase clean and consistent

- **Biome is king** - We use [Biome](https://biomejs.dev/) for linting and formatting
  - Run `pnpm format` before committing
  - Run `pnpm lint:fix` to auto-fix issues
- **Favor micro-libraries** - Prefer small, focused libraries over monolithic ones
- **Type safety** - All code must be fully typed (TypeScript strict mode)
- **Test coverage** - Add tests for new features and bug fixes
- **Documentation** - Update README and JSDoc comments for public APIs
- **Be awesome** - Write clean, readable code with clear variable names

### Commit Rules

> Help everyone understand the commit history

We use [Conventional Commits](https://www.conventionalcommits.org/) enforced by [commitlint](https://commitlint.js.org/).

**Commit message format:**
```
type(scope): subject

[optional body]

[optional footer]
```

**Commit types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Test updates
- `chore`: Build process or tooling changes
- `ci`: CI/CD changes
- `perf`: Performance improvements
- `revert`: Revert a previous commit

**Examples:**
```bash
feat(scaffold-mcp): add support for Vue.js templates
fix(aicode-utils): resolve path resolution issue on Windows
docs(readme): update installation instructions
test(scaffold-mcp): add tests for conditional includes
```

**Rules:**
- Present tense ("add feature" not "added feature")
- Maximum 100 characters for subject line
- Use imperative mood ("fix bug" not "fixes bug")
- Reference issues: `fixes #123` or `closes #456`

**Pre-commit hooks:**
We use [Husky](https://typicode.github.io/husky/) to enforce commit message format automatically.

### Environment Setup

**Prerequisites:**
- Node.js `>= 18` (use [nvm](https://github.com/nvm-sh/nvm) or [asdf](https://asdf-vm.com/))
- pnpm `>= 9` (install with `npm install -g pnpm`)
- Git `>= 2.13.2`

**Setup steps:**

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/<your-username>/aicode-toolkit.git
   cd aicode-toolkit
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Build all packages:**
   ```bash
   pnpm build
   ```

4. **Verify your setup:**
   ```bash
   pnpm test
   pnpm lint
   pnpm typecheck
   ```

### Testing

**Run all tests:**
```bash
pnpm test
```

**Test a specific package:**
```bash
pnpm exec nx test scaffold-mcp
```

**Run tests in watch mode:**
```bash
pnpm exec nx test scaffold-mcp --watch
```

**Check test coverage:**
```bash
pnpm exec nx test scaffold-mcp --coverage
```

### Documentation Updates

**Update package documentation:**
- Edit the relevant `README.md` in `packages/<package-name>/`
- Follow the existing structure and style
- Include code examples for new features

**Update main documentation:**
- Edit `README.md` in the project root
- Update `CLAUDE.md` if adding new guidance for AI agents

**Build and preview documentation:**
```bash
# Format markdown files
pnpm format

# Check for broken links (if applicable)
pnpm exec nx lint
```

---

## Pull Request Process

**Before submitting a PR:**

1. ✅ **Ensure all tests pass:** `pnpm test`
2. ✅ **Lint your code:** `pnpm lint`
3. ✅ **Format your code:** `pnpm format`
4. ✅ **Type check:** `pnpm typecheck`
5. ✅ **Build all packages:** `pnpm build`
6. ✅ **Rebase on latest main:** `git rebase origin/main`
7. ✅ **Squash commits** (if multiple commits address the same feature/fix)

**PR guidelines:**

- **Title:** Short and descriptive (max 100 characters)
  - Format: `feat(scope): add new feature` or `fix(scope): resolve issue`
- **Description:** Include:
  - **What:** What you want to achieve
  - **Why:** Why this change is needed
  - **How:** How you implemented it
  - **Changed:** What you changed
  - **Added:** What you added
  - **Removed:** What you removed
  - **Breaking changes:** Any breaking changes (if applicable)
  - **Related issues:** Link to issues with `fixes #123` or `relates to #456`
- **Screenshots/GIFs:** Include for UI changes
- **Tests:** Add tests for new features or bug fixes
- **Documentation:** Update docs if needed

**PR review process:**

1. Automated checks run (tests, linting, type checking)
2. Maintainers review your code
3. Address feedback in new commits (don't force push during review)
4. Once approved, maintainers will merge your PR

---

## Package Dependency Overview

This is an [Nx](https://nx.dev/) monorepo with the following structure:

```
aicode-toolkit/
├── packages/
│   ├── aicode-utils/          # Core utilities and types
│   ├── architect-mcp/         # MCP server for design patterns and code review
│   └── scaffold-mcp/          # MCP server for scaffolding (depends on aicode-utils)
├── templates/                 # Boilerplate templates
│   ├── nextjs-15/
│   └── vite-react/
└── apps/                      # Example apps (if any)
```

**Dependency graph:**
```
scaffold-mcp
    └── aicode-utils

architect-mcp
    └── aicode-utils
```

**View the full project graph:**
```bash
pnpm exec nx graph
```

---

## Development Workflow

### Working on a Package

1. **Make your changes** in `packages/<package-name>/`
2. **Build the package:**
   ```bash
   pnpm exec nx build <package-name>
   ```
3. **Test your changes:**
   ```bash
   pnpm exec nx test <package-name>
   ```
4. **Lint and format:**
   ```bash
   pnpm lint:fix
   pnpm format
   ```

### Adding a New Package

1. **Use Nx generator:**
   ```bash
   pnpm exec nx g @nx/js:library <package-name>
   ```
2. **Update package.json** with metadata (description, keywords, etc.)
3. **Add to Nx workspace** in `nx.json` (if not auto-added)
4. **Document in main README.md**

### Adding a New Template

1. **Create template directory:** `templates/<framework-name>/`
2. **Add `scaffold.yaml`** defining boilerplates and features
3. **Create template files** with `.liquid` extension
4. **Document in template README.md**
5. **Test with scaffold-mcp CLI:**
   ```bash
   scaffold-mcp init
   scaffold-mcp boilerplate list
   scaffold-mcp boilerplate create <template-name> --vars '{}'
   ```

---

## Questions?

- 💬 **Discussions:** [GitHub Discussions](https://github.com/AgiFlow/aicode-toolkit/discussions)
- 🐛 **Issues:** [GitHub Issues](https://github.com/AgiFlow/aicode-toolkit/issues)
- 📧 **Email:** For sensitive questions, contact the maintainers

---

**Thank you for contributing to AI Code Toolkit! 🚀**
