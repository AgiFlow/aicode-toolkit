# @agiflowai/hooks-adapter

Hook adapters for normalizing AI agent hook formats (Claude Code, Gemini, etc.). This library provides a unified interface for handling hooks from different AI coding agents.

## Installation

```bash
pnpm add @agiflowai/hooks-adapter
```

## Usage

### Basic Hook Execution

```typescript
import { AdapterProxyService, PRE_TOOL_USE, POST_TOOL_USE } from '@agiflowai/hooks-adapter';
import { CLAUDE_CODE } from '@agiflowai/coding-agent-bridge';

// Define your hook callback
const myPreToolUseHook = async (context) => {
  console.log('Tool:', context.toolName);
  console.log('File:', context.filePath);

  return {
    decision: 'allow',
    message: 'Proceeding with operation',
  };
};

// Execute the hook
await AdapterProxyService.execute(CLAUDE_CODE, PRE_TOOL_USE, myPreToolUseHook);
```

### Hook Types

The library exports two hook type constants:

- `PRE_TOOL_USE` - Hook that runs before a tool is executed
- `POST_TOOL_USE` - Hook that runs after a tool is executed

### Hook Context

The normalized `HookContext` passed to callbacks includes:

```typescript
interface HookContext {
  toolName: string;        // Name of the tool (e.g., "Read", "Write", "Edit")
  toolInput: Record<string, any>;  // Input parameters
  filePath?: string;       // File path for file operations
  operation?: 'read' | 'write' | 'edit';  // Operation type
  cwd: string;             // Current working directory
  sessionId: string;       // Unique session identifier
  llmTool?: string;        // Optional LLM tool identifier
}
```

### Hook Response

Callbacks should return a `HookResponse`:

```typescript
interface HookResponse {
  decision: 'allow' | 'deny' | 'ask' | 'skip';  // Permission decision
  message: string;         // Message for the LLM
  userMessage?: string;    // Optional message for the user only
  updatedInput?: Record<string, any>;  // Optional updated input parameters
}
```

### Decision Types

- `allow` - Allow the operation to proceed
- `deny` - Block the operation
- `ask` - Ask the user for confirmation
- `skip` - Skip the hook silently (no output)

## Adapters

### ClaudeCodeAdapter

Unified adapter for both Claude Code PreToolUse and PostToolUse hooks. Automatically detects the hook event type from the input and formats responses accordingly.

The adapter stores the `hook_event_name` during parsing and morphs its output format based on whether it's handling a PreToolUse or PostToolUse event.

### BaseAdapter

Abstract base class for creating custom adapters. Implements the Template Method pattern for hook execution flow.

## Services

### AdapterProxyService

Routes hook execution to the appropriate adapter based on agent and hook type.

```typescript
AdapterProxyService.execute(agentName, hookType, callback);
```

### ExecutionLogService

Tracks hook executions to prevent duplicate actions within a session.

```typescript
// Check if already executed
const executed = await ExecutionLogService.hasExecuted(sessionId, filePath, decision);

// Log an execution
await ExecutionLogService.logExecution({
  sessionId,
  filePath,
  operation: 'read',
  decision: 'allow',
});

// Check if file has changed since last execution
const changed = await ExecutionLogService.hasFileChanged(sessionId, filePath, decision);
```

## License

AGPL-3.0
