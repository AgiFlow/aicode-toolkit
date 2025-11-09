## 1.0.3 (2025-11-09)

### 🚀 Features

- **scaffold-mcp:** pagination Add pagination support for list-boilerplates and list-scaffold-methods. \n Fix instruction variables replacement. ([cc80ff8](https://github.com/AgiFlow/aicode-toolkit/commit/cc80ff8))

### ❤️ Thank You

- Vuong Ngo

## 1.0.2 (2025-10-23)

### 🩹 Fixes

- **architect-mcp:** code-review Fix issue when code review update AGENTS.md and CLAUDE.md ([3f0174b](https://github.com/AgiFlow/aicode-toolkit/commit/3f0174b))

### ❤️ Thank You

- Vuong Ngo

## 1.0.1 (2025-10-14)

### 🚀 Features

- integrate OpenSpec and enhance init workflow UX ([a90481f](https://github.com/AgiFlow/aicode-toolkit/commit/a90481f))
- **scaffold-mcp:** add monolith mode support for all MCP tools ([b6cd8eb](https://github.com/AgiFlow/aicode-toolkit/commit/b6cd8eb))

### 🩹 Fixes

- change print.warn to print.warning and configure local Nx cache ([9685400](https://github.com/AgiFlow/aicode-toolkit/commit/9685400))
- linting Fix error in linting and typechecking ([2c8a782](https://github.com/AgiFlow/aicode-toolkit/commit/2c8a782))
- gh-action Fix TruffleHog scan ([8d7e99b](https://github.com/AgiFlow/aicode-toolkit/commit/8d7e99b))
- **aicode-utils:** replace JSON.parse with yaml.load for toolkit.yaml parsing ([8d4b751](https://github.com/AgiFlow/aicode-toolkit/commit/8d4b751))

### ❤️ Thank You

- Vuong Ngo @AgiFlow

# 1.0.0 (2025-10-13)

### 🚀 Features

- **aicode-toolkit:** create standalone CLI application ([785c2a3](https://github.com/AgiFlow/aicode-toolkit/commit/785c2a3))
- **aicode-toolkit:** add gradient banner with theme colors ([2d16e73](https://github.com/AgiFlow/aicode-toolkit/commit/2d16e73))
- **aicode-toolkit:** implement improved init flow with template management and MCP setup ([3bb5059](https://github.com/AgiFlow/aicode-toolkit/commit/3bb5059))
- **aicode-toolkit:** add MCP server selection to init command with conditional template copying ([fc0b466](https://github.com/AgiFlow/aicode-toolkit/commit/fc0b466))
- **aicode-toolkit:** add global RULES.yaml support and improve MCP configuration ([339179c](https://github.com/AgiFlow/aicode-toolkit/commit/339179c))
- **coding-agent-bridge:** scaffold new TypeScript library package ([a565aed](https://github.com/AgiFlow/aicode-toolkit/commit/a565aed))
- ⚠️  **coding-agent-bridge:** implement coding agent abstraction layer with ClaudeCodeService ([b9f2ff9](https://github.com/AgiFlow/aicode-toolkit/commit/b9f2ff9))
- **coding-agent-bridge:** implement Claude Code auto-detection and standardized MCP configuration ([a3c96c4](https://github.com/AgiFlow/aicode-toolkit/commit/a3c96c4))
- **coding-agent-bridge:** add Codex and Gemini CLI service support ([15835b7](https://github.com/AgiFlow/aicode-toolkit/commit/15835b7))
- **scaffold-mcp:** add constants scaffold for typescript-lib template ([954200a](https://github.com/AgiFlow/aicode-toolkit/commit/954200a))

### 🩹 Fixes

- correct README monolith documentation and improve terminal color visibility ([91d0a20](https://github.com/AgiFlow/aicode-toolkit/commit/91d0a20))
- **aicode-toolkit:** use js-yaml for scaffold.yaml parsing ([99dbfb4](https://github.com/AgiFlow/aicode-toolkit/commit/99dbfb4))

### ⚠️  Breaking Changes

- **coding-agent-bridge:** architect-mcp now depends on coding-agent-bridge package

### ❤️ Thank You

- Vuong Ngo @AgiFlow

## 0.6.0 (2025-10-12)

### 🚀 Features

- **scaffold-mcp:** Add interactive new project setup with @inquirer/prompts ([5d2358a](https://github.com/AgiFlow/aicode-toolkit/commit/5d2358a))
- **scaffold-mcp:** Add --name argument and refactor imports ([05d7f22](https://github.com/AgiFlow/aicode-toolkit/commit/05d7f22))
- **scaffold-mcp:** enhance init and add commands with toolkit.yaml support ([cafe65f](https://github.com/AgiFlow/aicode-toolkit/commit/cafe65f))

### 🩹 Fixes

- lint Fix lint errors ([c4ceffb](https://github.com/AgiFlow/aicode-toolkit/commit/c4ceffb))
- **scaffold-mcp:** security and code quality improvements ([bf578ae](https://github.com/AgiFlow/aicode-toolkit/commit/bf578ae))

### ❤️ Thank You

- Vuong Ngo @AgiFlow

## 0.5.0 (2025-10-12)

### 🚀 Features

- claude-code-marketplace Add support for claude-code marketplace. ([f76a779](https://github.com/AgiFlow/aicode-toolkit/commit/f76a779))
- github-actions Add pr-check github actions ([bec9254](https://github.com/AgiFlow/aicode-toolkit/commit/bec9254))
- **architect-mcp:** monolith Support monolith config ([3dd3c46](https://github.com/AgiFlow/aicode-toolkit/commit/3dd3c46))
- **scaffold-mcp:** repo-type Support monolith vs mono-repo init ([e7b7ad8](https://github.com/AgiFlow/aicode-toolkit/commit/e7b7ad8))

### 🩹 Fixes

- claude-code-marketplace Fix mcp settings ([9a6c552](https://github.com/AgiFlow/aicode-toolkit/commit/9a6c552))
- claude-marketplace Fix mcps start command ([67ff822](https://github.com/AgiFlow/aicode-toolkit/commit/67ff822))
- marketplace-mcps Fix mcp start command ([1e10d91](https://github.com/AgiFlow/aicode-toolkit/commit/1e10d91))
- Address code review feedback - type safety, validation, and error handling ([f75a451](https://github.com/AgiFlow/aicode-toolkit/commit/f75a451))
- **architect-mcp:** config Fix finding config fils ([c4da661](https://github.com/AgiFlow/aicode-toolkit/commit/c4da661))

### ❤️ Thank You

- Vuong Ngo @AgiFlow

## 0.4.1 (2025-10-08)

### 🩹 Fixes

- **architect-mcp:** cli Fix wrong cli entry ([a0000c0](https://github.com/AgiFlow/aicode-toolkit/commit/a0000c0))

### ❤️ Thank You

- Vuong Ngo @AgiFlow

## 0.4.0 (2025-10-08)

### 🚀 Features

- **aicode-utils:** shared-utils Add a new packages for shared utilities for toolkit. ([2f90e51](https://github.com/AgiFlow/aicode-toolkit/commit/2f90e51))
- **architect-mcp:** file-design-pattern Add cli and tools to add file design pattern to architect.yaml and retrieve file design  pattern. ([f0fae91](https://github.com/AgiFlow/aicode-toolkit/commit/f0fae91))
- **architect-mcp:** architect Provide architect suggestion using llm if --llm-tool is provided ([466e2e1](https://github.com/AgiFlow/aicode-toolkit/commit/466e2e1))
- **architect-mcp:** rules Add AddRuleTool to add global or template RULES.yaml. And ReviewCodeChangeTool to use RULES.yaml to identify code smell. ([232a3cc](https://github.com/AgiFlow/aicode-toolkit/commit/232a3cc))

### ❤️ Thank You

- Vuong Ngo @AgiFlow

## 0.3.3 (2025-10-07)

### 🩹 Fixes

- **scaffold-mcp:** logger Change file logging to write sync ([72fd733](https://github.com/AgiFlow/aicode-toolkit/commit/72fd733))

### ❤️ Thank You

- Vuong Ngo @AgiFlow

## 0.3.1 (2025-10-06)

### 🩹 Fixes

- **scaffold-mcp:** build-output Change build output to cjs ([7b4dc81](https://github.com/AgiFlow/aicode-toolkit/commit/7b4dc81))
- **scaffold-mcp:** templates-path Use TemplatesManager to find the correct workspace path ([f03d3e6](https://github.com/AgiFlow/aicode-toolkit/commit/f03d3e6))
- **scaffold-mcp:** mcp transport 1. HTTP Transport: Updated to use server factory pattern, creates new MCP server per ([825001c](https://github.com/AgiFlow/aicode-toolkit/commit/825001c))

### ❤️ Thank You

- Vuong Ngo @AgiFlow

## 0.3.0 (2025-10-06)

### 🚀 Features

- nextjs-15-drizzle template Add completed nextjs-15 template with drizzle and better-auth integration. ([8e21344](https://github.com/AgiFlow/aicode-toolkit/commit/8e21344))
- **scaffold-mcp:** cli Update `add` command to get template from git sub folder. Update `init` command to pull all default templates. ([7b2da59](https://github.com/AgiFlow/aicode-toolkit/commit/7b2da59))

### ❤️ Thank You

- Vuong Ngo @AgiFlow

## 0.2.0 (2025-10-06)

### 🚀 Features

- **scaffold-mcp:** extra prompts Add two extra prompts for slash commands: scaffold-application and scaffold-feature ([54d1991](https://github.com/AgiFlow/aicode-toolkit/commit/54d1991))

### ❤️ Thank You

- Vuong Ngo @AgiFlow

## 0.1.0 (2025-10-05)

### 🚀 Features

- nextjs-15 Add nextjs-15 template example ([f7512c5](https://github.com/AgiFlow/aicode-toolkit/commit/f7512c5))

### 🩹 Fixes

- **scaffold-mcp:** cli Fix init and add commands ([5a3db3b](https://github.com/AgiFlow/aicode-toolkit/commit/5a3db3b))

### ❤️ Thank You

- Vuong Ngo @AgiFlow

# 0.0.0 (2025-10-05)

### 🚀 Features

- init Initialize project ([adb2544](https://github.com/AgiFlow/aicode-toolkit/commit/adb2544))

### ❤️ Thank You

- Vuong Ngo