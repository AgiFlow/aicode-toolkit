# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

An Nx monorepo for building MCP (Model Context Protocol) servers and tooling. Uses pnpm for package management and Nx for build orchestration.

## Coding Workflow (IMPORTANT)

When working on code in this repository, **ALWAYS** follow this workflow using MCP tools:

### 1. Creating New Applications or Features

**Use scaffold-mcp MCP tools to generate boilerplate code:**

- **List available boilerplates**: Use `list-boilerplates` MCP tool from scaffold-mcp
- **Create new application**: Use `use-boilerplate` MCP tool from scaffold-mcp
- **List available features**: Use `list-scaffolding-methods` MCP tool from scaffold-mcp with `projectPath` parameter
- **Add new feature**: Use `use-scaffold-method` MCP tool from scaffold-mcp

### 2. Before Editing Files

**ALWAYS get design patterns and coding standards first:**

Use the `get_file_design_pattern` MCP tool from architect-mcp with the file path you're about to edit.

This returns:

- Project information and source template
- Applicable design patterns from architect.yaml
- Coding rules from RULES.yaml (must_do, should_do, must_not_do)
- Code examples showing the patterns

**Use this information to guide your implementation.**

### 3. After Editing Files

**ALWAYS review code for violations:**

Use the `review_code_change` MCP tool from architect-mcp with the file path you just edited.

This checks:

- Must not do violations (critical issues)
- Must do missing (required patterns not followed)
- Should do suggestions (best practices)

**Fix any violations before proceeding.**

### Summary

1. **Create**: Use scaffold-mcp MCP tools (`use-boilerplate` or `use-scaffold-method`)
2. **Before Edit**: Use architect-mcp `get_file_design_pattern` tool to understand patterns
3. **After Edit**: Use architect-mcp `review_code_change` tool to check for code smells
4. **Fix**: Address any violations found in the review

**Note**: CLI commands are available for manual user interaction but you should use MCP tools directly.

## Development

```bash
# Build packages
pnpm build

# Lint and format
pnpm lint          # Check for issues
pnpm lint:fix      # Fix issues automatically
pnpm format        # Format code

# Test and type check
pnpm test
pnpm typecheck
```

Code quality: Uses [oxlint](https://oxc.rs/docs/guide/usage/linter) for type-aware linting (config: `.oxlintrc.json`) and [oxfmt](https://oxc.rs/docs/guide/usage/formatter) for formatting (config: `.oxfmtrc.json`)
