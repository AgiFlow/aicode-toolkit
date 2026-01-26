## 0.3.7 (2026-01-26)

### 🚀 Features

- **aicode-toolkit:** add clawdbot-mcp-plugin package ([6860d89](https://github.com/AgiFlow/aicode-toolkit/commit/6860d89))

### 🧱 Updated Dependencies

- Updated @agiflowai/aicode-utils to 1.0.13

### ❤️ Thank You

- Vuong Ngo

## 0.3.6 (2026-01-16)

### 🚀 Features

- **hooks-adapter:** add additionalContext support for Claude Code preToolUse hooks ([0d31594](https://github.com/AgiFlow/aicode-toolkit/commit/0d31594))

### 🧱 Updated Dependencies

- Updated @agiflowai/aicode-utils to 1.0.12

### ❤️ Thank You

- Vuong Ngo

## 0.3.5 (2026-01-09)

### 🩹 Fixes

- address CodeQL security warnings ([724c9f0](https://github.com/AgiFlow/aicode-toolkit/commit/724c9f0))

### 🧱 Updated Dependencies

- Updated @agiflowai/aicode-utils to 1.0.11

### ❤️ Thank You

- Vuong Ngo

## 0.3.4 (2025-12-27)

### 🩹 Fixes

- **one-mcp:** add type assertion for process.env spread ([629e126](https://github.com/AgiFlow/aicode-toolkit/commit/629e126))
- **coding-agent-bridge:** pass process.env to execa version checks ([fc10940](https://github.com/AgiFlow/aicode-toolkit/commit/fc10940))

### ❤️ Thank You

- Vuong Ngo

## 0.2.8 (2025-12-27)

### 🚀 Features

- **one-mcp:** add unique server identifier for multi-instance support ([58d7248](https://github.com/AgiFlow/aicode-toolkit/commit/58d7248))
- **one-mcp:** add prefetch command for pre-downloading MCP server packages ([13d5e55](https://github.com/AgiFlow/aicode-toolkit/commit/13d5e55))

### 🩹 Fixes

- **one-mcp:** use rejection sampling to avoid modulo bias in ID generation ([3b7521c](https://github.com/AgiFlow/aicode-toolkit/commit/3b7521c))
- **one-mcp:** use global install for prefetch and improve CLI output ([4262196](https://github.com/AgiFlow/aicode-toolkit/commit/4262196))
- **one-mcp:** add input validation to prevent command injection ([750982e](https://github.com/AgiFlow/aicode-toolkit/commit/750982e))
- **one-mcp:** skip disabled servers in prefetch package extraction ([803c21b](https://github.com/AgiFlow/aicode-toolkit/commit/803c21b))
- **one-mcp:** improve npx package extraction to handle --package flag patterns ([d810fb9](https://github.com/AgiFlow/aicode-toolkit/commit/d810fb9))
- **one-mcp:** increase connection timeout and make it configurable ([fccb102](https://github.com/AgiFlow/aicode-toolkit/commit/fccb102))

### 🔥 Performance

- **one-mcp:** parallelize sequential awaits in SkillService and describe-tools ([8463367](https://github.com/AgiFlow/aicode-toolkit/commit/8463367))
- **one-mcp:** parallelize sequential awaits in CLI commands and cache service ([1719339](https://github.com/AgiFlow/aicode-toolkit/commit/1719339))
- **one-mcp:** parallelize tool and skill lookups in DescribeToolsTool ([39caf9a](https://github.com/AgiFlow/aicode-toolkit/commit/39caf9a))

### 🧱 Updated Dependencies

- Updated @agiflowai/aicode-utils to 1.0.10

### ❤️ Thank You

- Vuong Ngo

## 0.3.2 (2025-12-26)

### 🧱 Updated Dependencies

- Updated @agiflowai/aicode-utils to 1.0.5

## 0.3.1 (2025-12-26)

### 🚀 Features

- **one-mcp:** add unique server identifier for multi-instance support ([58d7248](https://github.com/AgiFlow/aicode-toolkit/commit/58d7248))

### 🩹 Fixes

- **one-mcp:** use rejection sampling to avoid modulo bias in ID generation ([3b7521c](https://github.com/AgiFlow/aicode-toolkit/commit/3b7521c))

### ❤️ Thank You

- Vuong Ngo

## 0.3.0 (2025-12-19)

This was a version bump only for one-mcp to align it with other projects, there were no code changes.

## 0.2.7 (2025-12-12)

### 🚀 Features

- **one-mcp:** add file watcher for SKILL.md cache invalidation ([689041e](https://github.com/AgiFlow/aicode-toolkit/commit/689041e))
- **one-mcp:** auto-detect skills from prompt front-matter and unify toolkit description ([f1bbcca](https://github.com/AgiFlow/aicode-toolkit/commit/f1bbcca))
- **one-mcp:** add HTTP streamable transport support ([ecced5c](https://github.com/AgiFlow/aicode-toolkit/commit/ecced5c))

### 🩹 Fixes

- **one-mcp:** improve front-matter parser edge case handling ([44a4eae](https://github.com/AgiFlow/aicode-toolkit/commit/44a4eae))
- **one-mcp:** only prefix skills with skill__ when clashing with MCP tools ([a4944f2](https://github.com/AgiFlow/aicode-toolkit/commit/a4944f2))

### ❤️ Thank You

- Vuong Ngo

## 0.2.6 (2025-12-08)

### 🚀 Features

- **one-mcp:** add prompt-based skills support ([19d2fcd](https://github.com/AgiFlow/aicode-toolkit/commit/19d2fcd))
- **one-mcp:** add prompt aggregation support ([cf538ff](https://github.com/AgiFlow/aicode-toolkit/commit/cf538ff))

### 🧱 Updated Dependencies

- Updated @agiflowai/aicode-utils to 1.0.9

### ❤️ Thank You

- Vuong Ngo

## 0.2.5 (2025-12-07)

### 🚀 Features

- **one-mcp:** add skills support with liquid templates ([4c1a1b4](https://github.com/AgiFlow/aicode-toolkit/commit/4c1a1b4))

### 🧱 Updated Dependencies

- Updated @agiflowai/aicode-utils to 1.0.8

### ❤️ Thank You

- Vuong Ngo

## 0.2.4 (2025-12-05)

### 🚀 Features

- **aicode-toolkit:** add one-mcp support in MCP selection ([e731037](https://github.com/AgiFlow/aicode-toolkit/commit/e731037))

### 🧱 Updated Dependencies

- Updated @agiflowai/aicode-utils to 1.0.7

### ❤️ Thank You

- Vuong Ngo

## 0.2.3 (2025-12-04)

### 🚀 Features

- **hooks-adapter:** Refactor hooks and add ExecutionLogService improvements ([7a241a3](https://github.com/AgiFlow/aicode-toolkit/commit/7a241a3))

### 🩹 Fixes

- **architect-mcp:** hooks Fix multiple hooks running issue ([df6cbda](https://github.com/AgiFlow/aicode-toolkit/commit/df6cbda))

### 🧱 Updated Dependencies

- Updated @agiflowai/aicode-utils to 1.0.6

### ❤️ Thank You

- Vuong Ngo

## 0.2.2 (2025-11-28)

### 🚀 Features

- **one-mcp:** use prefixed tool names for clashing tools ([a8bca23](https://github.com/AgiFlow/aicode-toolkit/commit/a8bca23))
- **one-mcp:** add PROJECT_PATH support for config file discovery ([0669b13](https://github.com/AgiFlow/aicode-toolkit/commit/0669b13))

### 🧱 Updated Dependencies

- Updated @agiflowai/aicode-utils to 1.0.4

### ❤️ Thank You

- Vuong Ngo

## 0.2.1 (2025-11-16)

### 🚀 Features

- **one-mcp:** add remote config support with caching and merge strategies ([0d657ad](https://github.com/AgiFlow/aicode-toolkit/commit/0d657ad))

### 🩹 Fixes

- **one-mcp:** address critical security issues in remote config ([4dd0f69](https://github.com/AgiFlow/aicode-toolkit/commit/4dd0f69))

### ❤️ Thank You

- Vuong Ngo

## 0.2.0 (2025-11-15)

### 🚀 Features

- **one-mcp:** add omitToolDescription flag ([b429e1e](https://github.com/AgiFlow/aicode-toolkit/commit/b429e1e))
- **scaffold-mcp:** add toolBlacklist support to one-mcp ([7a277d4](https://github.com/AgiFlow/aicode-toolkit/commit/7a277d4))
- **scaffold-mcp:** remove configUrl support from one-mcp, keep only local file config ([cf55e4d](https://github.com/AgiFlow/aicode-toolkit/commit/cf55e4d))
- **scaffold-mcp:** add --no-cache option to one-mcp mcp-serve command ([c099559](https://github.com/AgiFlow/aicode-toolkit/commit/c099559))

### 🩹 Fixes

- **one-mcp:** add proper type checking for error in init command ([6119cb8](https://github.com/AgiFlow/aicode-toolkit/commit/6119cb8))
- **one-mcp:** resolve file system race condition in init command ([ae402c9](https://github.com/AgiFlow/aicode-toolkit/commit/ae402c9))

### ❤️ Thank You

- Vuong Ngo