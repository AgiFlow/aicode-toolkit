## 1.0.21 (2026-03-06)

### 🧱 Updated Dependencies

- Updated @agiflowai/aicode-utils to 1.0.18

## 1.0.20 (2026-03-06)

### 🧱 Updated Dependencies

- Updated @agiflowai/aicode-utils to 1.0.17

## 1.0.19 (2026-02-22)

### 🧱 Updated Dependencies

- Updated @agiflowai/aicode-utils to 1.0.16

## 1.0.18 (2026-02-20)

### 🧱 Updated Dependencies

- Updated @agiflowai/aicode-utils to 1.0.15

## 1.0.16 (2026-01-26)

### 🧱 Updated Dependencies

- Updated @agiflowai/aicode-utils to 1.0.13

## 1.0.15 (2026-01-16)

### 🧱 Updated Dependencies

- Updated @agiflowai/aicode-utils to 1.0.12

## 1.0.14 (2026-01-09)

### 🧱 Updated Dependencies

- Updated @agiflowai/aicode-utils to 1.0.11

## 1.0.13 (2025-12-27)

### 🩹 Fixes

- **coding-agent-bridge:** remove --yolo flag from gemini-cli sandbox mode ([fce7e95](https://github.com/AgiFlow/aicode-toolkit/commit/fce7e95))
- **coding-agent-bridge:** pass process.env to execa version checks ([fc10940](https://github.com/AgiFlow/aicode-toolkit/commit/fc10940))

### ❤️ Thank You

- Vuong Ngo

## 1.0.12 (2025-12-27)

This was a version bump only for @agiflowai/coding-agent-bridge to align it with other projects, there were no code changes.

## 1.0.11 (2025-12-27)

### 🩹 Fixes

- **coding-agent-bridge:** merge toolConfig with default args to prevent duplicate CLI flags ([540367a](https://github.com/AgiFlow/aicode-toolkit/commit/540367a))
- **coding-agent-bridge:** add --yolo flag to enable OAuth auth with sandbox mode ([536f87c](https://github.com/AgiFlow/aicode-toolkit/commit/536f87c))

### 🧱 Updated Dependencies

- Updated @agiflowai/aicode-utils to 1.0.10

### ❤️ Thank You

- Vuong Ngo

## 1.0.10 (2025-12-12)

### 🚀 Features

- **coding-agent-bridge:** add toolConfig support for LLM services ([d286734](https://github.com/AgiFlow/aicode-toolkit/commit/d286734))

### ❤️ Thank You

- Vuong Ngo

## 1.0.9 (2025-12-08)

### 🧱 Updated Dependencies

- Updated @agiflowai/aicode-utils to 1.0.9

## 1.0.8 (2025-12-07)

### 🧱 Updated Dependencies

- Updated @agiflowai/aicode-utils to 1.0.8

## 1.0.7 (2025-12-05)

### 🧱 Updated Dependencies

- Updated @agiflowai/aicode-utils to 1.0.7

## 1.0.6 (2025-12-04)

### 🧱 Updated Dependencies

- Updated @agiflowai/aicode-utils to 1.0.6

## 1.0.5 (2025-11-28)

### 🩹 Fixes

- **coding-agent-bridge:** use secure temporary file creation in CodexService ([22fe373](https://github.com/AgiFlow/aicode-toolkit/commit/22fe373))
- resolve lint formatting issues ([ea43109](https://github.com/AgiFlow/aicode-toolkit/commit/ea43109))

### 🧱 Updated Dependencies

- Updated @agiflowai/aicode-utils to 1.0.4

### ❤️ Thank You

- Vuong Ngo

## 1.0.4 (2025-11-15)

### 🚀 Features

- integrate OpenSpec and enhance init workflow UX ([a90481f](https://github.com/AgiFlow/aicode-toolkit/commit/a90481f))
- **coding-agent-bridge:** add Codex and Gemini CLI service support ([15835b7](https://github.com/AgiFlow/aicode-toolkit/commit/15835b7))
- **coding-agent-bridge:** implement Claude Code auto-detection and standardized MCP configuration ([a3c96c4](https://github.com/AgiFlow/aicode-toolkit/commit/a3c96c4))
- ⚠️  **coding-agent-bridge:** implement coding agent abstraction layer with ClaudeCodeService ([b9f2ff9](https://github.com/AgiFlow/aicode-toolkit/commit/b9f2ff9))
- **coding-agent-bridge:** scaffold new TypeScript library package ([a565aed](https://github.com/AgiFlow/aicode-toolkit/commit/a565aed))

### 🩹 Fixes

- linting Fix error in linting and typechecking ([2c8a782](https://github.com/AgiFlow/aicode-toolkit/commit/2c8a782))

### ⚠️  Breaking Changes

- **coding-agent-bridge:** architect-mcp now depends on coding-agent-bridge package

### ❤️ Thank You

- Vuong Ngo @AgiFlow

## 1.0.3 (2025-11-09)

This was a version bump only for @agiflowai/coding-agent-bridge to align it with other projects, there were no code changes.

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

- **coding-agent-bridge:** add Codex and Gemini CLI service support ([15835b7](https://github.com/AgiFlow/aicode-toolkit/commit/15835b7))
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