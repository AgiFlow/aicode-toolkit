## 1.0.27 (2026-03-15)

### 🧱 Updated Dependencies

- Updated @agiflowai/coding-agent-bridge to 1.0.23
- Updated @agiflowai/architect-mcp to 1.0.25
- Updated @agiflowai/hooks-adapter to 0.0.21
- Updated @agiflowai/aicode-utils to 1.0.20

## 1.0.26 (2026-03-14)

### 🩹 Fixes

- **release:** resolve 5 Dependabot security alerts ([#99](https://github.com/AgiFlow/aicode-toolkit/issues/99), [#100](https://github.com/AgiFlow/aicode-toolkit/issues/100), [#101](https://github.com/AgiFlow/aicode-toolkit/issues/101), [#98](https://github.com/AgiFlow/aicode-toolkit/issues/98), [#102](https://github.com/AgiFlow/aicode-toolkit/issues/102))

### 🧱 Updated Dependencies

- Updated @agiflowai/coding-agent-bridge to 1.0.22
- Updated @agiflowai/architect-mcp to 1.0.24
- Updated @agiflowai/hooks-adapter to 0.0.20
- Updated @agiflowai/aicode-utils to 1.0.19

### ❤️ Thank You

- Claude Opus 4.6 (1M context)
- vuongngo

## 1.0.25 (2026-03-06)

### 🧱 Updated Dependencies

- Updated @agiflowai/coding-agent-bridge to 1.0.21
- Updated @agiflowai/architect-mcp to 1.0.23
- Updated @agiflowai/hooks-adapter to 0.0.19
- Updated @agiflowai/aicode-utils to 1.0.18

## 1.0.24 (2026-03-06)

### 🧱 Updated Dependencies

- Updated @agiflowai/coding-agent-bridge to 1.0.20
- Updated @agiflowai/architect-mcp to 1.0.22
- Updated @agiflowai/hooks-adapter to 0.0.18
- Updated @agiflowai/aicode-utils to 1.0.17

## 1.0.23 (2026-02-22)

### 🚀 Features

- derive claude-code hooks from scaffold-mcp/architect-mcp hook config ([8515b35](https://github.com/AgiFlow/aicode-toolkit/commit/8515b35))
- support mcp-serve and hook config in .toolkit/settings.yaml ([40654bb](https://github.com/AgiFlow/aicode-toolkit/commit/40654bb))
- add --fallback-tool and --fallback-tool-config to hook commands ([6bbaff3](https://github.com/AgiFlow/aicode-toolkit/commit/6bbaff3))
- add --fallback-tool and --fallback-tool-config to mcp-serve ([51b82dd](https://github.com/AgiFlow/aicode-toolkit/commit/51b82dd))

### 🩹 Fixes

- reformat scaffold-mcp mcp-serve option call to satisfy biome ([ef247ed](https://github.com/AgiFlow/aicode-toolkit/commit/ef247ed))

### 🧱 Updated Dependencies

- Updated @agiflowai/coding-agent-bridge to 1.0.19
- Updated @agiflowai/architect-mcp to 1.0.21
- Updated @agiflowai/hooks-adapter to 0.0.17
- Updated @agiflowai/aicode-utils to 1.0.16

### ❤️ Thank You

- Claude Sonnet 4.6
- Vuong Ngo

## 1.0.22 (2026-02-20)

### 🚀 Features

- **scaffold-mcp:** skip scaffold prompt when target file already exists ([8d7f9f9](https://github.com/AgiFlow/aicode-toolkit/commit/8d7f9f9))
- **scaffold-mcp:** simplify scaffold method hook message and add tests ([9bd0138](https://github.com/AgiFlow/aicode-toolkit/commit/9bd0138))

### 🩹 Fixes

- **scaffold-mcp:** fix biome lint errors in hook test file ([71b77ec](https://github.com/AgiFlow/aicode-toolkit/commit/71b77ec))

### 🧱 Updated Dependencies

- Updated @agiflowai/coding-agent-bridge to 1.0.18
- Updated @agiflowai/architect-mcp to 1.0.20
- Updated @agiflowai/hooks-adapter to 0.0.16
- Updated @agiflowai/aicode-utils to 1.0.15

### ❤️ Thank You

- Claude Sonnet 4.6
- Vuong Ngo

## 1.0.20 (2026-01-26)

### 🧱 Updated Dependencies

- Updated @agiflowai/coding-agent-bridge to 1.0.16
- Updated @agiflowai/architect-mcp to 1.0.18
- Updated @agiflowai/hooks-adapter to 0.0.14
- Updated @agiflowai/aicode-utils to 1.0.13

## 1.0.19 (2026-01-16)

### 🚀 Features

- **hooks-adapter:** add additionalContext support for Claude Code preToolUse hooks ([0d31594](https://github.com/AgiFlow/aicode-toolkit/commit/0d31594))

### 🧱 Updated Dependencies

- Updated @agiflowai/coding-agent-bridge to 1.0.15
- Updated @agiflowai/architect-mcp to 1.0.17
- Updated @agiflowai/hooks-adapter to 0.0.13
- Updated @agiflowai/aicode-utils to 1.0.12

### ❤️ Thank You

- Vuong Ngo

## 1.0.18 (2026-01-10)

### 🩹 Fixes

- **scaffold-mcp:** search all boilerplates and scaffold methods when using them ([3333900](https://github.com/AgiFlow/aicode-toolkit/commit/3333900))

### ❤️ Thank You

- Vuong Ngo

## 1.0.17 (2026-01-03)

### 🧱 Updated Dependencies

- Updated @agiflowai/architect-mcp to 1.0.15

## 1.0.16 (2025-12-29)

### 🩹 Fixes

- **scaffold-mcp:** fix TypeScript errors in schemaDefaults utility ([9878053](https://github.com/AgiFlow/aicode-toolkit/commit/9878053))
- **scaffold-mcp:** fix conditional scaffold includes with schema defaults ([7d46b59](https://github.com/AgiFlow/aicode-toolkit/commit/7d46b59))

### ❤️ Thank You

- Vuong Ngo

## 1.0.15 (2025-12-27)

### 🩹 Fixes

- **scaffold-mcp:** only block Write operations within working directory ([6c42919](https://github.com/AgiFlow/aicode-toolkit/commit/6c42919))

### 🔥 Performance

- **scaffold-mcp:** parallelize sequential awaits in services ([bda480e](https://github.com/AgiFlow/aicode-toolkit/commit/bda480e))

### 🧱 Updated Dependencies

- Updated @agiflowai/coding-agent-bridge to 1.0.12
- Updated @agiflowai/architect-mcp to 1.0.13
- Updated @agiflowai/hooks-adapter to 0.0.10

### ❤️ Thank You

- Vuong Ngo

## 1.0.14 (2025-12-26)

### 🧱 Updated Dependencies

- Updated @agiflowai/coding-agent-bridge to 1.0.5
- Updated @agiflowai/architect-mcp to 1.0.6
- Updated @agiflowai/hooks-adapter to 0.0.8
- Updated @agiflowai/aicode-utils to 1.0.5

## 1.0.13 (2025-12-26)

### 🚀 Features

- **scaffold-mcp:** add --prompt-as-skill option for Claude Code skill front matter ([0e5b6cf](https://github.com/AgiFlow/aicode-toolkit/commit/0e5b6cf))
- **one-mcp:** add prompt aggregation support ([cf538ff](https://github.com/AgiFlow/aicode-toolkit/commit/cf538ff))
- **hooks-adapter:** Refactor hooks and add ExecutionLogService improvements ([7a241a3](https://github.com/AgiFlow/aicode-toolkit/commit/7a241a3))
- **scaffold-mcp:** hooks Fix scaffold files reminder ([bdb5e48](https://github.com/AgiFlow/aicode-toolkit/commit/bdb5e48))
- **scaffold-mcp:** hooks Add claude codes hook ([91989aa](https://github.com/AgiFlow/aicode-toolkit/commit/91989aa))
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

- **one-mcp:** improve front-matter parser edge case handling ([44a4eae](https://github.com/AgiFlow/aicode-toolkit/commit/44a4eae))
- **aicode-utils:** consolidate git utilities and prevent command injection ([ff1b6b1](https://github.com/AgiFlow/aicode-toolkit/commit/ff1b6b1))
- resolve TypeScript errors and fix test mocks ([e7320c4](https://github.com/AgiFlow/aicode-toolkit/commit/e7320c4))
- handle null return from findTemplatesPath in consuming code ([a00a6b3](https://github.com/AgiFlow/aicode-toolkit/commit/a00a6b3))
- **aicode-utils:** return null instead of throwing when templates path not found ([6dd4545](https://github.com/AgiFlow/aicode-toolkit/commit/6dd4545))
- Improve hook implementations and documentation ([dc430b2](https://github.com/AgiFlow/aicode-toolkit/commit/dc430b2))
- hooks Fix reviewCodeChange and useScaffoldMethod hook ([396a4cc](https://github.com/AgiFlow/aicode-toolkit/commit/396a4cc))
- hooks Fix hooks adapter ([553e358](https://github.com/AgiFlow/aicode-toolkit/commit/553e358))
- hooks Fix scaffold-mcp hooks ([d72a669](https://github.com/AgiFlow/aicode-toolkit/commit/d72a669))
- **architect-mcp:** Hook format Fix --hook config format ([ad18201](https://github.com/AgiFlow/aicode-toolkit/commit/ad18201))
- resolve lint formatting issues ([ea43109](https://github.com/AgiFlow/aicode-toolkit/commit/ea43109))
- **scaffold-mcp:** security and code quality improvements ([bf578ae](https://github.com/AgiFlow/aicode-toolkit/commit/bf578ae))
- Address code review feedback - type safety, validation, and error handling ([f75a451](https://github.com/AgiFlow/aicode-toolkit/commit/f75a451))
- **architect-mcp:** cli Fix wrong cli entry ([a0000c0](https://github.com/AgiFlow/aicode-toolkit/commit/a0000c0))
- **scaffold-mcp:** template-generation Fix template formating. Add logging with pino. ([cf9084a](https://github.com/AgiFlow/aicode-toolkit/commit/cf9084a))
- **scaffold-mcp:** mcp transport 1. HTTP Transport: Updated to use server factory pattern, creates new MCP server per ([825001c](https://github.com/AgiFlow/aicode-toolkit/commit/825001c))
- **scaffold-mcp:** templates-path Use TemplatesManager to find the correct workspace path ([f03d3e6](https://github.com/AgiFlow/aicode-toolkit/commit/f03d3e6))
- **scaffold-mcp:** build-output Change build output to cjs ([7b4dc81](https://github.com/AgiFlow/aicode-toolkit/commit/7b4dc81))

### ⚠️  Breaking Changes

- **coding-agent-bridge:** implement coding agent abstraction layer with ClaudeCodeService  ([b9f2ff9](https://github.com/AgiFlow/aicode-toolkit/commit/b9f2ff9))
  architect-mcp now depends on coding-agent-bridge package
  - Migrate architect-mcp to use ClaudeCodeService from coding-agent-bridge
  - Remove ClaudeCodeLLMService (280 lines) in favor of shared implementation
  - Update CodeReviewService and GetFileDesignPatternTool to use new API (updatePrompt + invokeAsLlm)
  - Fix logic bugs in TemplateFinder and RuleFinder to properly validate files are within projects
  - Fix scaffold-mcp test mocks to target correct import path (@agiflowai/aicode-utils)
  All tests passing: 172/172 (coding-agent-bridge: 8/8, architect-mcp: 13/13, scaffold-mcp: 151/151)
  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  Co-Authored-By: Claude <noreply@anthropic.com>

### ❤️ Thank You

- Claude
- Vuong Ngo @AgiFlow

## 1.0.12 (2025-12-26)

### 🚀 Features

- **scaffold-mcp:** add --prompt-as-skill option for Claude Code skill front matter ([0e5b6cf](https://github.com/AgiFlow/aicode-toolkit/commit/0e5b6cf))
- **one-mcp:** add prompt aggregation support ([cf538ff](https://github.com/AgiFlow/aicode-toolkit/commit/cf538ff))
- **hooks-adapter:** Refactor hooks and add ExecutionLogService improvements ([7a241a3](https://github.com/AgiFlow/aicode-toolkit/commit/7a241a3))
- **scaffold-mcp:** hooks Fix scaffold files reminder ([bdb5e48](https://github.com/AgiFlow/aicode-toolkit/commit/bdb5e48))
- **scaffold-mcp:** hooks Add claude codes hook ([91989aa](https://github.com/AgiFlow/aicode-toolkit/commit/91989aa))
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

- **one-mcp:** improve front-matter parser edge case handling ([44a4eae](https://github.com/AgiFlow/aicode-toolkit/commit/44a4eae))
- **aicode-utils:** consolidate git utilities and prevent command injection ([ff1b6b1](https://github.com/AgiFlow/aicode-toolkit/commit/ff1b6b1))
- resolve TypeScript errors and fix test mocks ([e7320c4](https://github.com/AgiFlow/aicode-toolkit/commit/e7320c4))
- handle null return from findTemplatesPath in consuming code ([a00a6b3](https://github.com/AgiFlow/aicode-toolkit/commit/a00a6b3))
- **aicode-utils:** return null instead of throwing when templates path not found ([6dd4545](https://github.com/AgiFlow/aicode-toolkit/commit/6dd4545))
- Improve hook implementations and documentation ([dc430b2](https://github.com/AgiFlow/aicode-toolkit/commit/dc430b2))
- hooks Fix reviewCodeChange and useScaffoldMethod hook ([396a4cc](https://github.com/AgiFlow/aicode-toolkit/commit/396a4cc))
- hooks Fix hooks adapter ([553e358](https://github.com/AgiFlow/aicode-toolkit/commit/553e358))
- hooks Fix scaffold-mcp hooks ([d72a669](https://github.com/AgiFlow/aicode-toolkit/commit/d72a669))
- **architect-mcp:** Hook format Fix --hook config format ([ad18201](https://github.com/AgiFlow/aicode-toolkit/commit/ad18201))
- resolve lint formatting issues ([ea43109](https://github.com/AgiFlow/aicode-toolkit/commit/ea43109))
- **scaffold-mcp:** security and code quality improvements ([bf578ae](https://github.com/AgiFlow/aicode-toolkit/commit/bf578ae))
- Address code review feedback - type safety, validation, and error handling ([f75a451](https://github.com/AgiFlow/aicode-toolkit/commit/f75a451))
- **architect-mcp:** cli Fix wrong cli entry ([a0000c0](https://github.com/AgiFlow/aicode-toolkit/commit/a0000c0))
- **scaffold-mcp:** template-generation Fix template formating. Add logging with pino. ([cf9084a](https://github.com/AgiFlow/aicode-toolkit/commit/cf9084a))
- **scaffold-mcp:** mcp transport 1. HTTP Transport: Updated to use server factory pattern, creates new MCP server per ([825001c](https://github.com/AgiFlow/aicode-toolkit/commit/825001c))
- **scaffold-mcp:** templates-path Use TemplatesManager to find the correct workspace path ([f03d3e6](https://github.com/AgiFlow/aicode-toolkit/commit/f03d3e6))
- **scaffold-mcp:** build-output Change build output to cjs ([7b4dc81](https://github.com/AgiFlow/aicode-toolkit/commit/7b4dc81))

### ⚠️  Breaking Changes

- **coding-agent-bridge:** implement coding agent abstraction layer with ClaudeCodeService  ([b9f2ff9](https://github.com/AgiFlow/aicode-toolkit/commit/b9f2ff9))
  architect-mcp now depends on coding-agent-bridge package
  - Migrate architect-mcp to use ClaudeCodeService from coding-agent-bridge
  - Remove ClaudeCodeLLMService (280 lines) in favor of shared implementation
  - Update CodeReviewService and GetFileDesignPatternTool to use new API (updatePrompt + invokeAsLlm)
  - Fix logic bugs in TemplateFinder and RuleFinder to properly validate files are within projects
  - Fix scaffold-mcp test mocks to target correct import path (@agiflowai/aicode-utils)
  All tests passing: 172/172 (coding-agent-bridge: 8/8, architect-mcp: 13/13, scaffold-mcp: 151/151)
  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  Co-Authored-By: Claude <noreply@anthropic.com>

### 🧱 Updated Dependencies

- Updated @agiflowai/architect-mcp to 1.0.6
- Updated @agiflowai/hooks-adapter to 0.0.7

### ❤️ Thank You

- Claude
- Vuong Ngo @AgiFlow

## 1.0.11 (2025-12-12)

### 🧱 Updated Dependencies

- Updated @agiflowai/coding-agent-bridge to 1.0.10
- Updated @agiflowai/architect-mcp to 1.0.11
- Updated @agiflowai/hooks-adapter to 0.0.6

## 1.0.10 (2025-12-08)

### 🚀 Features

- **one-mcp:** add prompt aggregation support ([cf538ff](https://github.com/AgiFlow/aicode-toolkit/commit/cf538ff))

### 🩹 Fixes

- **aicode-utils:** consolidate git utilities and prevent command injection ([ff1b6b1](https://github.com/AgiFlow/aicode-toolkit/commit/ff1b6b1))
- resolve TypeScript errors and fix test mocks ([e7320c4](https://github.com/AgiFlow/aicode-toolkit/commit/e7320c4))
- handle null return from findTemplatesPath in consuming code ([a00a6b3](https://github.com/AgiFlow/aicode-toolkit/commit/a00a6b3))
- **aicode-utils:** return null instead of throwing when templates path not found ([6dd4545](https://github.com/AgiFlow/aicode-toolkit/commit/6dd4545))

### 🧱 Updated Dependencies

- Updated @agiflowai/coding-agent-bridge to 1.0.9
- Updated @agiflowai/architect-mcp to 1.0.10
- Updated @agiflowai/hooks-adapter to 0.0.5
- Updated @agiflowai/aicode-utils to 1.0.9

### ❤️ Thank You

- Vuong Ngo

## 1.0.9 (2025-12-07)

### 🧱 Updated Dependencies

- Updated @agiflowai/coding-agent-bridge to 1.0.8
- Updated @agiflowai/architect-mcp to 1.0.9
- Updated @agiflowai/hooks-adapter to 0.0.4
- Updated @agiflowai/aicode-utils to 1.0.8

## 1.0.8 (2025-12-05)

### 🧱 Updated Dependencies

- Updated @agiflowai/coding-agent-bridge to 1.0.7
- Updated @agiflowai/architect-mcp to 1.0.8
- Updated @agiflowai/hooks-adapter to 0.0.3
- Updated @agiflowai/aicode-utils to 1.0.7

## 1.0.7 (2025-12-04)

### 🚀 Features

- **hooks-adapter:** Refactor hooks and add ExecutionLogService improvements ([7a241a3](https://github.com/AgiFlow/aicode-toolkit/commit/7a241a3))
- **scaffold-mcp:** hooks Fix scaffold files reminder ([bdb5e48](https://github.com/AgiFlow/aicode-toolkit/commit/bdb5e48))
- **scaffold-mcp:** hooks Add claude codes hook ([91989aa](https://github.com/AgiFlow/aicode-toolkit/commit/91989aa))

### 🩹 Fixes

- Improve hook implementations and documentation ([dc430b2](https://github.com/AgiFlow/aicode-toolkit/commit/dc430b2))
- hooks Fix reviewCodeChange and useScaffoldMethod hook ([396a4cc](https://github.com/AgiFlow/aicode-toolkit/commit/396a4cc))
- hooks Fix hooks adapter ([553e358](https://github.com/AgiFlow/aicode-toolkit/commit/553e358))
- hooks Fix scaffold-mcp hooks ([d72a669](https://github.com/AgiFlow/aicode-toolkit/commit/d72a669))
- **architect-mcp:** Hook format Fix --hook config format ([ad18201](https://github.com/AgiFlow/aicode-toolkit/commit/ad18201))

### 🧱 Updated Dependencies

- Updated @agiflowai/coding-agent-bridge to 1.0.6
- Updated @agiflowai/architect-mcp to 1.0.7
- Updated @agiflowai/hooks-adapter to 0.0.2
- Updated @agiflowai/aicode-utils to 1.0.6

### ❤️ Thank You

- Vuong Ngo

## 1.0.6 (2025-12-02)

### 🧱 Updated Dependencies

- Updated @agiflowai/aicode-utils to 1.0.5

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