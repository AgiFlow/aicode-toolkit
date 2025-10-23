## 1.0.2 (2025-10-23)

### 🩹 Fixes

- **architect-mcp:** code-review Fix issue when code review update AGENTS.md and CLAUDE.md ([3f0174b](https://github.com/AgiFlow/aicode-toolkit/commit/3f0174b))

### ❤️ Thank You

- Vuong Ngo

## 1.0.1 (2025-10-14)

### 🚀 Features

- **scaffold-mcp:** add monolith mode support for all MCP tools ([b6cd8eb](https://github.com/AgiFlow/aicode-toolkit/commit/b6cd8eb))
- integrate OpenSpec and enhance init workflow UX ([a90481f](https://github.com/AgiFlow/aicode-toolkit/commit/a90481f))

### 🩹 Fixes

- gh-action Fix TruffleHog scan ([8d7e99b](https://github.com/AgiFlow/aicode-toolkit/commit/8d7e99b))
- linting Fix error in linting and typechecking ([2c8a782](https://github.com/AgiFlow/aicode-toolkit/commit/2c8a782))
- change print.warn to print.warning and configure local Nx cache ([9685400](https://github.com/AgiFlow/aicode-toolkit/commit/9685400))
- **aicode-utils:** replace JSON.parse with yaml.load for toolkit.yaml parsing ([8d4b751](https://github.com/AgiFlow/aicode-toolkit/commit/8d4b751))

### ❤️ Thank You

- Vuong Ngo @AgiFlow

# 1.0.0 (2025-10-13)

### 🚀 Features

- **aicode-toolkit:** add global RULES.yaml support and improve MCP configuration ([339179c](https://github.com/AgiFlow/aicode-toolkit/commit/339179c))
- **coding-agent-bridge:** implement Claude Code auto-detection and standardized MCP configuration ([a3c96c4](https://github.com/AgiFlow/aicode-toolkit/commit/a3c96c4))
- **aicode-toolkit:** add MCP server selection to init command with conditional template copying ([fc0b466](https://github.com/AgiFlow/aicode-toolkit/commit/fc0b466))
- ⚠️  **coding-agent-bridge:** implement coding agent abstraction layer with ClaudeCodeService ([b9f2ff9](https://github.com/AgiFlow/aicode-toolkit/commit/b9f2ff9))
- **coding-agent-bridge:** scaffold new TypeScript library package ([a565aed](https://github.com/AgiFlow/aicode-toolkit/commit/a565aed))
- **scaffold-mcp:** add constants scaffold for typescript-lib template ([954200a](https://github.com/AgiFlow/aicode-toolkit/commit/954200a))
- **aicode-toolkit:** add gradient banner with theme colors ([2d16e73](https://github.com/AgiFlow/aicode-toolkit/commit/2d16e73))
- **aicode-toolkit:** create standalone CLI application ([785c2a3](https://github.com/AgiFlow/aicode-toolkit/commit/785c2a3))

### 🩹 Fixes

- correct README monolith documentation and improve terminal color visibility ([91d0a20](https://github.com/AgiFlow/aicode-toolkit/commit/91d0a20))

### ⚠️  Breaking Changes

- **coding-agent-bridge:** architect-mcp now depends on coding-agent-bridge package

### ❤️ Thank You

- Vuong Ngo @AgiFlow

## 0.6.0 (2025-10-12)

### 🚀 Features

- **scaffold-mcp:** Add interactive new project setup with @inquirer/prompts ([5d2358a](https://github.com/AgiFlow/aicode-toolkit/commit/5d2358a))

### 🩹 Fixes

- lint Fix lint errors ([c4ceffb](https://github.com/AgiFlow/aicode-toolkit/commit/c4ceffb))
- **scaffold-mcp:** security and code quality improvements ([bf578ae](https://github.com/AgiFlow/aicode-toolkit/commit/bf578ae))

### ❤️ Thank You

- Vuong Ngo @AgiFlow

## 0.5.0 (2025-10-12)

### 🚀 Features

- **scaffold-mcp:** repo-type Support monolith vs mono-repo init ([e7b7ad8](https://github.com/AgiFlow/aicode-toolkit/commit/e7b7ad8))
- github-actions Add pr-check github actions ([bec9254](https://github.com/AgiFlow/aicode-toolkit/commit/bec9254))
- claude-code-marketplace Add support for claude-code marketplace. ([f76a779](https://github.com/AgiFlow/aicode-toolkit/commit/f76a779))

### 🩹 Fixes

- Address code review feedback - type safety, validation, and error handling ([f75a451](https://github.com/AgiFlow/aicode-toolkit/commit/f75a451))
- marketplace-mcps Fix mcp start command ([1e10d91](https://github.com/AgiFlow/aicode-toolkit/commit/1e10d91))
- claude-marketplace Fix mcps start command ([67ff822](https://github.com/AgiFlow/aicode-toolkit/commit/67ff822))
- claude-code-marketplace Fix mcp settings ([9a6c552](https://github.com/AgiFlow/aicode-toolkit/commit/9a6c552))

### ❤️ Thank You

- Vuong Ngo @AgiFlow

## 0.4.1 (2025-10-08)

This was a version bump only for @agiflowai/aicode-utils to align it with other projects, there were no code changes.

## 0.4.0 (2025-10-08)

### 🚀 Features

- **architect-mcp:** rules Add AddRuleTool to add global or template RULES.yaml. And ReviewCodeChangeTool to use RULES.yaml to identify code smell. ([232a3cc](https://github.com/AgiFlow/aicode-toolkit/commit/232a3cc))
- **architect-mcp:** architect Provide architect suggestion using llm if --llm-tool is provided ([466e2e1](https://github.com/AgiFlow/aicode-toolkit/commit/466e2e1))
- **architect-mcp:** file-design-pattern Add cli and tools to add file design pattern to architect.yaml and retrieve file design  pattern. ([f0fae91](https://github.com/AgiFlow/aicode-toolkit/commit/f0fae91))
- **aicode-utils:** shared-utils Add a new packages for shared utilities for toolkit. ([2f90e51](https://github.com/AgiFlow/aicode-toolkit/commit/2f90e51))

### ❤️ Thank You

- Vuong Ngo @AgiFlow