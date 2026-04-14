## 1.1.0 (2026-04-14)

### 🩹 Fixes

- align cli metadata and sync success output ([b5c77dc](https://github.com/AgiFlow/aicode-toolkit/commit/b5c77dc))
- address lint issues ([0d734bf](https://github.com/AgiFlow/aicode-toolkit/commit/0d734bf))

### 🧱 Updated Dependencies

- Updated @agiflowai/coding-agent-bridge to 1.1.0
- Updated @agiflowai/aicode-utils to 1.1.0

### ❤️ Thank You

- vuongngo

## 1.0.26 (2026-03-15)

### 🧱 Updated Dependencies

- Updated @agiflowai/coding-agent-bridge to 1.0.23
- Updated @agiflowai/aicode-utils to 1.0.20

## 1.0.25 (2026-03-14)

### 🩹 Fixes

- **release:** resolve 5 Dependabot security alerts ([#99](https://github.com/AgiFlow/aicode-toolkit/issues/99), [#100](https://github.com/AgiFlow/aicode-toolkit/issues/100), [#101](https://github.com/AgiFlow/aicode-toolkit/issues/101), [#98](https://github.com/AgiFlow/aicode-toolkit/issues/98), [#102](https://github.com/AgiFlow/aicode-toolkit/issues/102))

### 🧱 Updated Dependencies

- Updated @agiflowai/coding-agent-bridge to 1.0.22
- Updated @agiflowai/aicode-utils to 1.0.19

### ❤️ Thank You

- Claude Opus 4.6 (1M context)
- vuongngo

## 1.0.24 (2026-03-06)

### 🧱 Updated Dependencies

- Updated @agiflowai/coding-agent-bridge to 1.0.21
- Updated @agiflowai/aicode-utils to 1.0.18

## 1.0.23 (2026-03-06)

### 🧱 Updated Dependencies

- Updated @agiflowai/coding-agent-bridge to 1.0.20
- Updated @agiflowai/aicode-utils to 1.0.17

## 1.0.22 (2026-02-22)

### 🚀 Features

- derive claude-code hooks from scaffold-mcp/architect-mcp hook config ([8515b35](https://github.com/AgiFlow/aicode-toolkit/commit/8515b35))
- add aicode sync command to generate claude and mcp config from settings.yaml ([5cc3691](https://github.com/AgiFlow/aicode-toolkit/commit/5cc3691))
- add architect-mcp config support in .toolkit/settings.yaml ([9732cd5](https://github.com/AgiFlow/aicode-toolkit/commit/9732cd5))
- use liquid template to generate .toolkit/settings.yaml in init command ([28ad23a](https://github.com/AgiFlow/aicode-toolkit/commit/28ad23a))
- add .toolkit/settings.yaml template to aicode-toolkit ([ab3371e](https://github.com/AgiFlow/aicode-toolkit/commit/ab3371e))
- replace flat toolkit.yaml with .toolkit/ config folder ([5808524](https://github.com/AgiFlow/aicode-toolkit/commit/5808524))

### 🩹 Fixes

- handle null YAML values and fix sync.ts type safety ([c059a45](https://github.com/AgiFlow/aicode-toolkit/commit/c059a45))

### 🧱 Updated Dependencies

- Updated @agiflowai/coding-agent-bridge to 1.0.19
- Updated @agiflowai/aicode-utils to 1.0.16

### ❤️ Thank You

- Claude Sonnet 4.6
- Vuong Ngo

## 1.0.21 (2026-02-20)

### 🧱 Updated Dependencies

- Updated @agiflowai/coding-agent-bridge to 1.0.18
- Updated @agiflowai/aicode-utils to 1.0.15

## 1.0.19 (2026-01-26)

### 🧱 Updated Dependencies

- Updated @agiflowai/coding-agent-bridge to 1.0.16
- Updated @agiflowai/aicode-utils to 1.0.13

## 1.0.18 (2026-01-16)

### 🧱 Updated Dependencies

- Updated @agiflowai/coding-agent-bridge to 1.0.15
- Updated @agiflowai/aicode-utils to 1.0.12

## 1.0.17 (2026-01-09)

### 🧱 Updated Dependencies

- Updated @agiflowai/coding-agent-bridge to 1.0.14
- Updated @agiflowai/aicode-utils to 1.0.11

## 1.0.16 (2025-12-27)

### 🧱 Updated Dependencies

- Updated @agiflowai/coding-agent-bridge to 1.0.12

## 1.0.14 (2025-12-26)

### 🧱 Updated Dependencies

- Updated @agiflowai/coding-agent-bridge to 1.0.5
- Updated @agiflowai/aicode-utils to 1.0.5

## 1.0.13 (2025-12-26)

### 🚀 Features

- **aicode-toolkit:** add one-mcp support in MCP selection ([e731037](https://github.com/AgiFlow/aicode-toolkit/commit/e731037))
- **scaffold-mcp:** add monolith mode support for all MCP tools ([b6cd8eb](https://github.com/AgiFlow/aicode-toolkit/commit/b6cd8eb))
- integrate OpenSpec and enhance init workflow UX ([a90481f](https://github.com/AgiFlow/aicode-toolkit/commit/a90481f))
- **coding-agent-bridge:** add Codex and Gemini CLI service support ([15835b7](https://github.com/AgiFlow/aicode-toolkit/commit/15835b7))
- **aicode-toolkit:** add global RULES.yaml support and improve MCP configuration ([339179c](https://github.com/AgiFlow/aicode-toolkit/commit/339179c))
- **coding-agent-bridge:** implement Claude Code auto-detection and standardized MCP configuration ([a3c96c4](https://github.com/AgiFlow/aicode-toolkit/commit/a3c96c4))
- **aicode-toolkit:** add MCP server selection to init command with conditional template copying ([fc0b466](https://github.com/AgiFlow/aicode-toolkit/commit/fc0b466))
- ⚠️  **coding-agent-bridge:** implement coding agent abstraction layer with ClaudeCodeService ([b9f2ff9](https://github.com/AgiFlow/aicode-toolkit/commit/b9f2ff9))
- **aicode-toolkit:** implement improved init flow with template management and MCP setup ([3bb5059](https://github.com/AgiFlow/aicode-toolkit/commit/3bb5059))
- **aicode-toolkit:** add gradient banner with theme colors ([2d16e73](https://github.com/AgiFlow/aicode-toolkit/commit/2d16e73))
- **aicode-toolkit:** create standalone CLI application ([785c2a3](https://github.com/AgiFlow/aicode-toolkit/commit/785c2a3))

### 🩹 Fixes

- **aicode-utils:** consolidate git utilities and prevent command injection ([ff1b6b1](https://github.com/AgiFlow/aicode-toolkit/commit/ff1b6b1))
- resolve TypeScript errors and fix test mocks ([e7320c4](https://github.com/AgiFlow/aicode-toolkit/commit/e7320c4))
- handle null return from findTemplatesPath in consuming code ([a00a6b3](https://github.com/AgiFlow/aicode-toolkit/commit/a00a6b3))
- **aicode-toolkit:** remove remaining fs-extra references ([acf8205](https://github.com/AgiFlow/aicode-toolkit/commit/acf8205))
- resolve lint formatting issues ([ea43109](https://github.com/AgiFlow/aicode-toolkit/commit/ea43109))
- linting Fix error in linting and typechecking ([2c8a782](https://github.com/AgiFlow/aicode-toolkit/commit/2c8a782))
- change print.warn to print.warning and configure local Nx cache ([9685400](https://github.com/AgiFlow/aicode-toolkit/commit/9685400))
- **aicode-toolkit:** use js-yaml for scaffold.yaml parsing ([99dbfb4](https://github.com/AgiFlow/aicode-toolkit/commit/99dbfb4))

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

## 1.0.12 (2025-12-12)

### 🧱 Updated Dependencies

- Updated @agiflowai/coding-agent-bridge to 1.0.10

## 1.0.11 (2025-12-08)

### 🩹 Fixes

- **aicode-utils:** consolidate git utilities and prevent command injection ([ff1b6b1](https://github.com/AgiFlow/aicode-toolkit/commit/ff1b6b1))
- resolve TypeScript errors and fix test mocks ([e7320c4](https://github.com/AgiFlow/aicode-toolkit/commit/e7320c4))
- handle null return from findTemplatesPath in consuming code ([a00a6b3](https://github.com/AgiFlow/aicode-toolkit/commit/a00a6b3))

### 🧱 Updated Dependencies

- Updated @agiflowai/coding-agent-bridge to 1.0.9
- Updated @agiflowai/aicode-utils to 1.0.9

### ❤️ Thank You

- Vuong Ngo

## 1.0.10 (2025-12-07)

### 🧱 Updated Dependencies

- Updated @agiflowai/coding-agent-bridge to 1.0.8
- Updated @agiflowai/aicode-utils to 1.0.8

## 1.0.9 (2025-12-05)

### 🚀 Features

- **aicode-toolkit:** add one-mcp support in MCP selection ([e731037](https://github.com/AgiFlow/aicode-toolkit/commit/e731037))

### 🧱 Updated Dependencies

- Updated @agiflowai/coding-agent-bridge to 1.0.7
- Updated @agiflowai/aicode-utils to 1.0.7

### ❤️ Thank You

- Vuong Ngo

## 1.0.8 (2025-12-04)

### 🧱 Updated Dependencies

- Updated @agiflowai/coding-agent-bridge to 1.0.6
- Updated @agiflowai/aicode-utils to 1.0.6

## 1.0.7 (2025-12-02)

### 🧱 Updated Dependencies

- Updated @agiflowai/coding-agent-bridge to 1.0.5
- Updated @agiflowai/aicode-utils to 1.0.5

## 1.0.6 (2025-12-02)

### 🚀 Features

- **scaffold-mcp:** add monolith mode support for all MCP tools ([b6cd8eb](https://github.com/AgiFlow/aicode-toolkit/commit/b6cd8eb))
- integrate OpenSpec and enhance init workflow UX ([a90481f](https://github.com/AgiFlow/aicode-toolkit/commit/a90481f))
- **coding-agent-bridge:** add Codex and Gemini CLI service support ([15835b7](https://github.com/AgiFlow/aicode-toolkit/commit/15835b7))
- **aicode-toolkit:** add global RULES.yaml support and improve MCP configuration ([339179c](https://github.com/AgiFlow/aicode-toolkit/commit/339179c))
- **coding-agent-bridge:** implement Claude Code auto-detection and standardized MCP configuration ([a3c96c4](https://github.com/AgiFlow/aicode-toolkit/commit/a3c96c4))
- **aicode-toolkit:** add MCP server selection to init command with conditional template copying ([fc0b466](https://github.com/AgiFlow/aicode-toolkit/commit/fc0b466))
- ⚠️  **coding-agent-bridge:** implement coding agent abstraction layer with ClaudeCodeService ([b9f2ff9](https://github.com/AgiFlow/aicode-toolkit/commit/b9f2ff9))
- **aicode-toolkit:** implement improved init flow with template management and MCP setup ([3bb5059](https://github.com/AgiFlow/aicode-toolkit/commit/3bb5059))
- **aicode-toolkit:** add gradient banner with theme colors ([2d16e73](https://github.com/AgiFlow/aicode-toolkit/commit/2d16e73))
- **aicode-toolkit:** create standalone CLI application ([785c2a3](https://github.com/AgiFlow/aicode-toolkit/commit/785c2a3))

### 🩹 Fixes

- **aicode-toolkit:** remove remaining fs-extra references ([acf8205](https://github.com/AgiFlow/aicode-toolkit/commit/acf8205))
- resolve lint formatting issues ([ea43109](https://github.com/AgiFlow/aicode-toolkit/commit/ea43109))
- linting Fix error in linting and typechecking ([2c8a782](https://github.com/AgiFlow/aicode-toolkit/commit/2c8a782))
- change print.warn to print.warning and configure local Nx cache ([9685400](https://github.com/AgiFlow/aicode-toolkit/commit/9685400))
- **aicode-toolkit:** use js-yaml for scaffold.yaml parsing ([99dbfb4](https://github.com/AgiFlow/aicode-toolkit/commit/99dbfb4))

### ⚠️  Breaking Changes

- **coding-agent-bridge:** architect-mcp now depends on coding-agent-bridge package

### ❤️ Thank You

- Vuong Ngo @AgiFlow

## 1.0.5 (2025-11-28)

### 🚀 Features

- **scaffold-mcp:** add monolith mode support for all MCP tools ([b6cd8eb](https://github.com/AgiFlow/aicode-toolkit/commit/b6cd8eb))
- integrate OpenSpec and enhance init workflow UX ([a90481f](https://github.com/AgiFlow/aicode-toolkit/commit/a90481f))
- **coding-agent-bridge:** add Codex and Gemini CLI service support ([15835b7](https://github.com/AgiFlow/aicode-toolkit/commit/15835b7))
- **aicode-toolkit:** add global RULES.yaml support and improve MCP configuration ([339179c](https://github.com/AgiFlow/aicode-toolkit/commit/339179c))
- **coding-agent-bridge:** implement Claude Code auto-detection and standardized MCP configuration ([a3c96c4](https://github.com/AgiFlow/aicode-toolkit/commit/a3c96c4))
- **aicode-toolkit:** add MCP server selection to init command with conditional template copying ([fc0b466](https://github.com/AgiFlow/aicode-toolkit/commit/fc0b466))
- ⚠️  **coding-agent-bridge:** implement coding agent abstraction layer with ClaudeCodeService ([b9f2ff9](https://github.com/AgiFlow/aicode-toolkit/commit/b9f2ff9))
- **aicode-toolkit:** implement improved init flow with template management and MCP setup ([3bb5059](https://github.com/AgiFlow/aicode-toolkit/commit/3bb5059))
- **aicode-toolkit:** add gradient banner with theme colors ([2d16e73](https://github.com/AgiFlow/aicode-toolkit/commit/2d16e73))
- **aicode-toolkit:** create standalone CLI application ([785c2a3](https://github.com/AgiFlow/aicode-toolkit/commit/785c2a3))

### 🩹 Fixes

- **aicode-toolkit:** remove remaining fs-extra references ([acf8205](https://github.com/AgiFlow/aicode-toolkit/commit/acf8205))
- resolve lint formatting issues ([ea43109](https://github.com/AgiFlow/aicode-toolkit/commit/ea43109))
- linting Fix error in linting and typechecking ([2c8a782](https://github.com/AgiFlow/aicode-toolkit/commit/2c8a782))
- change print.warn to print.warning and configure local Nx cache ([9685400](https://github.com/AgiFlow/aicode-toolkit/commit/9685400))
- **aicode-toolkit:** use js-yaml for scaffold.yaml parsing ([99dbfb4](https://github.com/AgiFlow/aicode-toolkit/commit/99dbfb4))

### ⚠️  Breaking Changes

- **coding-agent-bridge:** architect-mcp now depends on coding-agent-bridge package

### 🧱 Updated Dependencies

- Updated @agiflowai/coding-agent-bridge to 1.0.5
- Updated @agiflowai/aicode-utils to 1.0.4

### ❤️ Thank You

- Vuong Ngo @AgiFlow

## 1.0.4 (2025-11-15)

### 🚀 Features

- **scaffold-mcp:** add monolith mode support for all MCP tools ([b6cd8eb](https://github.com/AgiFlow/aicode-toolkit/commit/b6cd8eb))
- integrate OpenSpec and enhance init workflow UX ([a90481f](https://github.com/AgiFlow/aicode-toolkit/commit/a90481f))
- **coding-agent-bridge:** add Codex and Gemini CLI service support ([15835b7](https://github.com/AgiFlow/aicode-toolkit/commit/15835b7))
- **aicode-toolkit:** add global RULES.yaml support and improve MCP configuration ([339179c](https://github.com/AgiFlow/aicode-toolkit/commit/339179c))
- **coding-agent-bridge:** implement Claude Code auto-detection and standardized MCP configuration ([a3c96c4](https://github.com/AgiFlow/aicode-toolkit/commit/a3c96c4))
- **aicode-toolkit:** add MCP server selection to init command with conditional template copying ([fc0b466](https://github.com/AgiFlow/aicode-toolkit/commit/fc0b466))
- ⚠️  **coding-agent-bridge:** implement coding agent abstraction layer with ClaudeCodeService ([b9f2ff9](https://github.com/AgiFlow/aicode-toolkit/commit/b9f2ff9))
- **aicode-toolkit:** implement improved init flow with template management and MCP setup ([3bb5059](https://github.com/AgiFlow/aicode-toolkit/commit/3bb5059))
- **aicode-toolkit:** add gradient banner with theme colors ([2d16e73](https://github.com/AgiFlow/aicode-toolkit/commit/2d16e73))
- **aicode-toolkit:** create standalone CLI application ([785c2a3](https://github.com/AgiFlow/aicode-toolkit/commit/785c2a3))

### 🩹 Fixes

- linting Fix error in linting and typechecking ([2c8a782](https://github.com/AgiFlow/aicode-toolkit/commit/2c8a782))
- change print.warn to print.warning and configure local Nx cache ([9685400](https://github.com/AgiFlow/aicode-toolkit/commit/9685400))
- **aicode-toolkit:** use js-yaml for scaffold.yaml parsing ([99dbfb4](https://github.com/AgiFlow/aicode-toolkit/commit/99dbfb4))

### ⚠️  Breaking Changes

- **coding-agent-bridge:** architect-mcp now depends on coding-agent-bridge package

### 🧱 Updated Dependencies

- Updated @agiflowai/coding-agent-bridge to 1.0.4

### ❤️ Thank You

- Vuong Ngo @AgiFlow

## 1.0.3 (2025-11-09)

This was a version bump only for @agiflowai/aicode-toolkit to align it with other projects, there were no code changes.

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