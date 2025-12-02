## 1.0.5 (2025-12-02)

### 🚀 Features

- **scaffold-mcp:** pagination Add pagination support for list-boilerplates and list-scaffold-methods. \n Fix instruction variables replacement. ([cc80ff8](https://github.com/AgiFlow/aicode-toolkit/commit/cc80ff8))
- **scaffold-mcp:** add monolith mode support for all MCP tools ([b6cd8eb](https://github.com/AgiFlow/aicode-toolkit/commit/b6cd8eb))
- integrate OpenSpec and enhance init workflow UX ([a90481f](https://github.com/AgiFlow/aicode-toolkit/commit/a90481f))
- **aicode-toolkit:** add MCP server selection to init command with conditional template copying ([fc0b466](https://github.com/AgiFlow/aicode-toolkit/commit/fc0b466))
- ⚠️  **coding-agent-bridge:** implement coding agent abstraction layer with ClaudeCodeService ([b9f2ff9](https://github.com/AgiFlow/aicode-toolkit/commit/b9f2ff9))
- **scaffold-mcp:** Add --name argument and refactor imports ([05d7f22](https://github.com/AgiFlow/aicode-toolkit/commit/05d7f22))
- **scaffold-mcp:** Add interactive new project setup with @inquirer/prompts ([5d2358a](https://github.com/AgiFlow/aicode-toolkit/commit/5d2358a))
- **scaffold-mcp:** repo-type Support monolith vs mono-repo init ([e7b7ad8](https://github.com/AgiFlow/aicode-toolkit/commit/e7b7ad8))
- claude-code-marketplace Add support for claude-code marketplace. ([f76a779](https://github.com/AgiFlow/aicode-toolkit/commit/f76a779))
- **architect-mcp:** rules Add AddRuleTool to add global or template RULES.yaml. And ReviewCodeChangeTool to use RULES.yaml to identify code smell. ([232a3cc](https://github.com/AgiFlow/aicode-toolkit/commit/232a3cc))
- **aicode-utils:** shared-utils Add a new packages for shared utilities for toolkit. ([2f90e51](https://github.com/AgiFlow/aicode-toolkit/commit/2f90e51))
- **scaffold-mcp:** cli Update `add` command to get template from git sub folder. Update `init` command to pull all default templates. ([7b2da59](https://github.com/AgiFlow/aicode-toolkit/commit/7b2da59))
- nextjs-15-drizzle template Add completed nextjs-15 template with drizzle and better-auth integration. ([8e21344](https://github.com/AgiFlow/aicode-toolkit/commit/8e21344))
- **scaffold-mcp:** extra prompts Add two extra prompts for slash commands: scaffold-application and scaffold-feature ([54d1991](https://github.com/AgiFlow/aicode-toolkit/commit/54d1991))

### 🩹 Fixes

- resolve lint formatting issues ([ea43109](https://github.com/AgiFlow/aicode-toolkit/commit/ea43109))
- lint Fix lint errors ([c4ceffb](https://github.com/AgiFlow/aicode-toolkit/commit/c4ceffb))
- **scaffold-mcp:** security and code quality improvements ([bf578ae](https://github.com/AgiFlow/aicode-toolkit/commit/bf578ae))
- Address code review feedback - type safety, validation, and error handling ([f75a451](https://github.com/AgiFlow/aicode-toolkit/commit/f75a451))
- **architect-mcp:** cli Fix wrong cli entry ([a0000c0](https://github.com/AgiFlow/aicode-toolkit/commit/a0000c0))
- **scaffold-mcp:** template-generation Fix template formating. Add logging with pino. ([cf9084a](https://github.com/AgiFlow/aicode-toolkit/commit/cf9084a))
- **scaffold-mcp:** mcp transport 1. HTTP Transport: Updated to use server factory pattern, creates new MCP server per ([825001c](https://github.com/AgiFlow/aicode-toolkit/commit/825001c))
- **scaffold-mcp:** templates-path Use TemplatesManager to find the correct workspace path ([f03d3e6](https://github.com/AgiFlow/aicode-toolkit/commit/f03d3e6))
- **scaffold-mcp:** build-output Change build output to cjs ([7b4dc81](https://github.com/AgiFlow/aicode-toolkit/commit/7b4dc81))

### ⚠️  Breaking Changes

- **coding-agent-bridge:** architect-mcp now depends on coding-agent-bridge package

### ❤️ Thank You

- Vuong Ngo @AgiFlow

## 1.0.4 (2025-11-28)

### 🚀 Features

- **scaffold-mcp:** pagination Add pagination support for list-boilerplates and list-scaffold-methods. \n Fix instruction variables replacement. ([cc80ff8](https://github.com/AgiFlow/aicode-toolkit/commit/cc80ff8))
- **scaffold-mcp:** add monolith mode support for all MCP tools ([b6cd8eb](https://github.com/AgiFlow/aicode-toolkit/commit/b6cd8eb))
- integrate OpenSpec and enhance init workflow UX ([a90481f](https://github.com/AgiFlow/aicode-toolkit/commit/a90481f))
- **aicode-toolkit:** add MCP server selection to init command with conditional template copying ([fc0b466](https://github.com/AgiFlow/aicode-toolkit/commit/fc0b466))
- ⚠️  **coding-agent-bridge:** implement coding agent abstraction layer with ClaudeCodeService ([b9f2ff9](https://github.com/AgiFlow/aicode-toolkit/commit/b9f2ff9))
- **scaffold-mcp:** Add --name argument and refactor imports ([05d7f22](https://github.com/AgiFlow/aicode-toolkit/commit/05d7f22))
- **scaffold-mcp:** Add interactive new project setup with @inquirer/prompts ([5d2358a](https://github.com/AgiFlow/aicode-toolkit/commit/5d2358a))
- **scaffold-mcp:** repo-type Support monolith vs mono-repo init ([e7b7ad8](https://github.com/AgiFlow/aicode-toolkit/commit/e7b7ad8))
- claude-code-marketplace Add support for claude-code marketplace. ([f76a779](https://github.com/AgiFlow/aicode-toolkit/commit/f76a779))
- **architect-mcp:** rules Add AddRuleTool to add global or template RULES.yaml. And ReviewCodeChangeTool to use RULES.yaml to identify code smell. ([232a3cc](https://github.com/AgiFlow/aicode-toolkit/commit/232a3cc))
- **aicode-utils:** shared-utils Add a new packages for shared utilities for toolkit. ([2f90e51](https://github.com/AgiFlow/aicode-toolkit/commit/2f90e51))
- **scaffold-mcp:** cli Update `add` command to get template from git sub folder. Update `init` command to pull all default templates. ([7b2da59](https://github.com/AgiFlow/aicode-toolkit/commit/7b2da59))
- nextjs-15-drizzle template Add completed nextjs-15 template with drizzle and better-auth integration. ([8e21344](https://github.com/AgiFlow/aicode-toolkit/commit/8e21344))
- **scaffold-mcp:** extra prompts Add two extra prompts for slash commands: scaffold-application and scaffold-feature ([54d1991](https://github.com/AgiFlow/aicode-toolkit/commit/54d1991))

### 🩹 Fixes

- resolve lint formatting issues ([ea43109](https://github.com/AgiFlow/aicode-toolkit/commit/ea43109))
- lint Fix lint errors ([c4ceffb](https://github.com/AgiFlow/aicode-toolkit/commit/c4ceffb))
- **scaffold-mcp:** security and code quality improvements ([bf578ae](https://github.com/AgiFlow/aicode-toolkit/commit/bf578ae))
- Address code review feedback - type safety, validation, and error handling ([f75a451](https://github.com/AgiFlow/aicode-toolkit/commit/f75a451))
- **architect-mcp:** cli Fix wrong cli entry ([a0000c0](https://github.com/AgiFlow/aicode-toolkit/commit/a0000c0))
- **scaffold-mcp:** template-generation Fix template formating. Add logging with pino. ([cf9084a](https://github.com/AgiFlow/aicode-toolkit/commit/cf9084a))
- **scaffold-mcp:** mcp transport 1. HTTP Transport: Updated to use server factory pattern, creates new MCP server per ([825001c](https://github.com/AgiFlow/aicode-toolkit/commit/825001c))
- **scaffold-mcp:** templates-path Use TemplatesManager to find the correct workspace path ([f03d3e6](https://github.com/AgiFlow/aicode-toolkit/commit/f03d3e6))
- **scaffold-mcp:** build-output Change build output to cjs ([7b4dc81](https://github.com/AgiFlow/aicode-toolkit/commit/7b4dc81))

### ⚠️  Breaking Changes

- **coding-agent-bridge:** architect-mcp now depends on coding-agent-bridge package

### 🧱 Updated Dependencies

- Updated @agiflowai/aicode-utils to 1.0.4

### ❤️ Thank You

- Vuong Ngo @AgiFlow

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

- **scaffold-mcp:** add monolith mode support for all MCP tools ([b6cd8eb](https://github.com/AgiFlow/aicode-toolkit/commit/b6cd8eb))
- integrate OpenSpec and enhance init workflow UX ([a90481f](https://github.com/AgiFlow/aicode-toolkit/commit/a90481f))

### 🩹 Fixes

- gh-action Fix TruffleHog scan ([8d7e99b](https://github.com/AgiFlow/aicode-toolkit/commit/8d7e99b))
- linting Fix error in linting and typechecking ([2c8a782](https://github.com/AgiFlow/aicode-toolkit/commit/2c8a782))
- change print.warn to print.warning and configure local Nx cache ([9685400](https://github.com/AgiFlow/aicode-toolkit/commit/9685400))

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

- **scaffold-mcp:** enhance init and add commands with toolkit.yaml support ([cafe65f](https://github.com/AgiFlow/aicode-toolkit/commit/cafe65f))
- **scaffold-mcp:** Add --name argument and refactor imports ([05d7f22](https://github.com/AgiFlow/aicode-toolkit/commit/05d7f22))
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

### 🩹 Fixes

- **architect-mcp:** cli Fix wrong cli entry ([a0000c0](https://github.com/AgiFlow/aicode-toolkit/commit/a0000c0))

### ❤️ Thank You

- Vuong Ngo @AgiFlow

## 0.4.0 (2025-10-08)

### 🚀 Features

- **architect-mcp:** rules Add AddRuleTool to add global or template RULES.yaml. And ReviewCodeChangeTool to use RULES.yaml to identify code smell. ([232a3cc](https://github.com/AgiFlow/aicode-toolkit/commit/232a3cc))
- **architect-mcp:** architect Provide architect suggestion using llm if --llm-tool is provided ([466e2e1](https://github.com/AgiFlow/aicode-toolkit/commit/466e2e1))
- **architect-mcp:** file-design-pattern Add cli and tools to add file design pattern to architect.yaml and retrieve file design  pattern. ([f0fae91](https://github.com/AgiFlow/aicode-toolkit/commit/f0fae91))
- **aicode-utils:** shared-utils Add a new packages for shared utilities for toolkit. ([2f90e51](https://github.com/AgiFlow/aicode-toolkit/commit/2f90e51))

### ❤️ Thank You

- Vuong Ngo @AgiFlow

## 0.3.3 (2025-10-07)

### 🩹 Fixes

- **scaffold-mcp:** logger Change file logging to write sync ([72fd733](https://github.com/AgiFlow/aicode-toolkit/commit/72fd733))

### ❤️ Thank You

- Vuong Ngo @AgiFlow

## 0.3.1 (2025-10-06)

### 🩹 Fixes

- **scaffold-mcp:** mcp transport 1. HTTP Transport: Updated to use server factory pattern, creates new MCP server per ([825001c](https://github.com/AgiFlow/aicode-toolkit/commit/825001c))
- **scaffold-mcp:** templates-path Use TemplatesManager to find the correct workspace path ([f03d3e6](https://github.com/AgiFlow/aicode-toolkit/commit/f03d3e6))
- **scaffold-mcp:** build-output Change build output to cjs ([7b4dc81](https://github.com/AgiFlow/aicode-toolkit/commit/7b4dc81))

### ❤️ Thank You

- Vuong Ngo @AgiFlow

## 0.3.0 (2025-10-06)

### 🚀 Features

- **scaffold-mcp:** cli Update `add` command to get template from git sub folder. Update `init` command to pull all default templates. ([7b2da59](https://github.com/AgiFlow/aicode-toolkit/commit/7b2da59))
- nextjs-15-drizzle template Add completed nextjs-15 template with drizzle and better-auth integration. ([8e21344](https://github.com/AgiFlow/aicode-toolkit/commit/8e21344))

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