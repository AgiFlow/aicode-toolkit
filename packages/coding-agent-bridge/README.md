# @agiflowai/coding-agent-bridge

Bridge library for connecting coding agents (Claude Code, Cursor, Cline, etc.) with development tools via standardized interfaces.

## What It Does

Provides a unified API for:
- Detecting and configuring coding agents in workspaces
- Managing MCP (Model Context Protocol) server settings
- Invoking coding agents as pure LLMs (no tool execution)
- Standard interfaces for coding agents (3 implemented, 2 planned)

## Supported Coding Agents

**Currently Implemented**:
- **Claude Code** - Anthropic's CLI with direct codebase access
- **Codex** - OpenAI's code translation system
- **Gemini CLI** - Google's command-line coding interface

**Defined (Not Yet Implemented)**:
- **Cursor** - AI-first code editor (constants defined, service pending)
- **Cline** - CLI-based AI assistant (constants defined, service pending)

## Installation

```bash
pnpm add @agiflowai/coding-agent-bridge
```

## Quick Start

### 1. Detect Active Coding Agent

```typescript
import { ClaudeCodeService, CLAUDE_CODE } from '@agiflowai/coding-agent-bridge';

const service = new ClaudeCodeService({
  workspaceRoot: '/path/to/workspace',
});

const isEnabled = await service.isEnabled();
console.log(`Claude Code detected: ${isEnabled}`);
```

### 2. Configure MCP Servers

```typescript
await service.updateMcpSettings({
  servers: {
    'architect-mcp': {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@agiflowai/architect-mcp'],
      env: {
        WORKSPACE_ROOT: '/path/to/workspace',
      },
    },
  },
});
```

Writes configuration to `.mcp.json` in workspace root automatically.

### 3. Invoke as Pure LLM

```typescript
const response = await service.invokeAsLlm({
  prompt: 'Explain this function: async function foo() { ... }',
  model: 'claude-sonnet-4-20250514',
  maxTokens: 2000,
});

console.log(response.content);
console.log(`Tokens: ${response.usage.inputTokens} in, ${response.usage.outputTokens} out`);
```

**Key feature**: `invokeAsLlm` disables all built-in tools (Bash, Read, Write, etc.) for pure text generation.

## API Overview

### Constants

```typescript
import {
  CLAUDE_CODE,
  CODEX,
  GEMINI_CLI,
  CURSOR,
  CLINE,
  SupportedCodingAgents,
} from '@agiflowai/coding-agent-bridge';

// Get agent metadata
const agent = SupportedCodingAgents[CLAUDE_CODE];
console.log(agent.displayName); // 'Claude Code'
console.log(agent.description); // Full description
```

### Service Interface

All coding agent services implement:

```typescript
interface CodingAgentService {
  // Check if agent is configured in workspace
  isEnabled(): Promise<boolean>;

  // Configure MCP servers
  updateMcpSettings(settings: McpSettings): Promise<void>;

  // Update prompt configuration
  updatePrompt(config: PromptConfig): Promise<void>;

  // Invoke as LLM without tool execution
  invokeAsLlm(params: LlmInvocationParams): Promise<LlmInvocationResponse>;
}
```

### Type Definitions

```typescript
interface McpSettings {
  servers?: {
    [name: string]: McpServerConfig;
  };
}

interface McpServerConfig {
  type: 'stdio' | 'http' | 'sse';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  disabled?: boolean;
}

interface LlmInvocationParams {
  prompt: string;
  model?: string;
  maxTokens?: number;
}

interface LlmInvocationResponse {
  content: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}
```

## Service-Specific Features

### ClaudeCodeService

```typescript
const service = new ClaudeCodeService({
  workspaceRoot: '/path/to/workspace',
  claudePath: 'claude', // CLI command (default: 'claude')
  defaultTimeout: 60000, // ms (default: 60000)
  defaultModel: 'claude-sonnet-4-20250514',
  defaultEnv: {
    DISABLE_TELEMETRY: '1',
    IS_SANDBOX: '1',
  },
  toolConfig: {
    model: 'claude-sonnet-4-20250514',
    timeout: 120000,
  },
});
```

**Detection logic**: Checks for `.claude` folder or `CLAUDE.md` file in workspace root.

**Built-in tool disabling**: When using `invokeAsLlm`, automatically disables 15+ Claude Code built-in tools (Task, Bash, Read, Write, Edit, etc.) to ensure pure LLM responses.

**Output format**: Uses `--output-format stream-json` for parsing structured responses with token counts.

### CodexService

```typescript
const service = new CodexService({
  workspaceRoot: '/path/to/workspace',
  toolConfig: {
    model: 'gpt-5.2',
  },
});
```

### GeminiCliService

```typescript
const service = new GeminiCliService({
  workspaceRoot: '/path/to/workspace',
  toolConfig: {
    model: 'gemini-2.5-pro',
  },
});
```

## Use Cases

### 1. Multi-Agent Orchestration

Use this library to build systems that switch between different coding agents based on task requirements:

```typescript
const agents = {
  [CLAUDE_CODE]: new ClaudeCodeService({ workspaceRoot }),
  [GEMINI_CLI]: new GeminiCliService({ workspaceRoot }),
};

// Detect active agent
for (const [agentId, service] of Object.entries(agents)) {
  if (await service.isEnabled()) {
    console.log(`Using ${agentId}`);
    return service;
  }
}
```

### 2. MCP Server Configuration Tool

Automate MCP server setup across different coding agents:

```typescript
const mcpConfig = {
  servers: {
    'architect-mcp': { /* ... */ },
    'scaffold-mcp': { /* ... */ },
  },
};

// Apply to all detected agents
await service.updateMcpSettings(mcpConfig);
```

### 3. Pure LLM Evaluation

Test coding agent quality without tool execution:

```typescript
const testCases = [
  'Explain this code: ...',
  'Find bugs in: ...',
  'Suggest improvements: ...',
];

for (const prompt of testCases) {
  const response = await service.invokeAsLlm({ prompt, maxTokens: 1000 });
  console.log(`Tokens used: ${response.usage.outputTokens}`);
}
```

## Development

```bash
# Build
pnpm build

# Test
pnpm test

# Type check
pnpm typecheck
```

## Tool Configuration

All services support a `toolConfig` option that passes CLI arguments to the underlying coding agent. Configuration keys are converted from camelCase to kebab-case CLI flags:

```typescript
const service = new ClaudeCodeService({
  workspaceRoot: '/path/to/workspace',
  toolConfig: {
    model: 'claude-sonnet-4-20250514',  // becomes --model claude-sonnet-4-20250514
    maxTokens: 4000,                     // becomes --max-tokens 4000
    timeout: 120000,                     // becomes --timeout 120000
  },
});
```

This enables tool-specific customization like model selection, timeouts, and other CLI options without modifying the service code.

## Architecture

**Design patterns**:
- Interface-based abstraction for multiple coding agents
- Service class pattern with dependency injection
- Base class (`BaseCodingAgentService`) for shared functionality
- Standardized MCP configuration format
- Type-safe constants with `as const` assertions

**Dependencies**:
- `execa` - Process execution for CLI invocation
- `uuid` - Session ID generation

## Related Packages

- `@agiflowai/aicode-toolkit` - CLI tool that uses this bridge
- `@agiflowai/architect-mcp` - MCP server for code review
- `@agiflowai/scaffold-mcp` - MCP server for code scaffolding

## License

AGPL-3.0

## Links

- [GitHub](https://github.com/AgiFlow/aicode-toolkit)
- [Issues](https://github.com/AgiFlow/aicode-toolkit/issues)
