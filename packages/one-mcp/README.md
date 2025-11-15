# @agiflowai/one-mcp

A unified MCP (Model Context Protocol) proxy server that enables **progressive tool discovery** to dramatically reduce token usage when working with multiple MCP servers.

## The Problem: MCP Token Bloat

When connecting to multiple MCP servers directly, AI agents must load ALL tools from ALL servers into their context window at startup. This creates massive token overhead:

**Example: 10 MCP Servers**
```
Server 1: 20 tools × 200 tokens = 4,000 tokens
Server 2: 15 tools × 200 tokens = 3,000 tokens
Server 3: 30 tools × 200 tokens = 6,000 tokens
...
Total: ~40,000+ tokens consumed BEFORE you even start coding
```

This consumes a significant portion of your context window with tool descriptions you may never use in that session.

## The Solution: Progressive Discovery

one-mcp acts as a **smart proxy** that only loads tool descriptions when needed:

1. **Initial Connection**: Agent sees only 2 meta-tools (`describe_tools` and `use_tool`)
   - Token cost: ~400 tokens (vs 40,000+ tokens)

2. **Discovery on Demand**: Agent calls `describe_tools` only for servers/tools it needs
   - Example: `describe_tools(["filesystem"])` loads only filesystem server tools
   - Token cost: ~4,000 tokens (only what you need, when you need it)

3. **Tool Execution**: Agent calls `use_tool` to execute tools through the proxy
   - one-mcp routes the call to the correct server
   - No token overhead - just execution

**Result: 90%+ reduction in initial token usage**

## How It Works

```
Traditional Approach (High Token Cost):
┌─────────────────┐
│  AI Agent       │ ← Loads ALL tools from ALL servers (40,000+ tokens)
├─────────────────┤
│ MCP Server 1    │ → 20 tools
│ MCP Server 2    │ → 15 tools
│ MCP Server 3    │ → 30 tools
│ ...             │
└─────────────────┘

Progressive Discovery (Low Token Cost):
┌─────────────────┐
│  AI Agent       │ ← Loads only 2 meta-tools (400 tokens)
├─────────────────┤
│  one-mcp        │ ← Proxies to servers on-demand
│  (2 tools)      │
└────────┬────────┘
         │ Connects to servers as needed
    ┌────┴─────┬──────────┬─────────┐
    │ Server 1 │ Server 2 │ Server 3│
    └──────────┴──────────┴─────────┘
```

## Key Benefits

- **Massive Token Savings** - 90%+ reduction in initial context usage
- **Faster Startup** - Agent ready in milliseconds, not seconds
- **Scale Infinitely** - Add 100+ MCP servers without bloating context
- **Pay-as-you-go** - Only load tools when actually needed
- **Better Context Budget** - Save tokens for actual code and conversation
- **Centralized Config** - Manage all servers from one YAML/JSON file

## Installation

```bash
npm install -g @agiflowai/one-mcp
# or
pnpm add -g @agiflowai/one-mcp
# or
yarn global add @agiflowai/one-mcp
```

## Quick Start

### 1. Initialize Configuration

Create an MCP configuration file:

```bash
npx @agiflowai/one-mcp init
```

This creates a `mcp-config.yaml` file with example servers:

```yaml
mcpServers:
  filesystem:
    command: npx
    args:
      - -y
      - "@modelcontextprotocol/server-filesystem"
      - "${HOME}/Documents"
    config:
      instruction: "Access files in the Documents folder"

  web-search:
    url: https://example.com/mcp/search
    type: sse
    headers:
      Authorization: "Bearer ${API_KEY}"
    config:
      instruction: "Search the web for information"
```

### 2. Configure Your Agent

Add one-mcp to your AI coding tool's MCP configuration:

**For Claude Code:**

```json
{
  "mcpServers": {
    "one-mcp": {
      "command": "npx",
      "args": ["-y", "@agiflowai/one-mcp", "mcp-serve", "--config", "./mcp-config.yaml"]
    }
  }
}
```

**For Cursor:**

```json
{
  "mcpServers": {
    "one-mcp": {
      "command": "npx",
      "args": ["-y", "@agiflowai/one-mcp", "mcp-serve", "--config", "./mcp-config.yaml"]
    }
  }
}
```

### 3. Start Using Tools

Your agent now has access to all tools from all configured servers through the single one-mcp connection!

## Configuration

### Config File Format

one-mcp supports the standard Claude Code MCP configuration format:

```yaml
mcpServers:
  # Stdio server (local command)
  server-name:
    command: npx
    args:
      - -y
      - "@modelcontextprotocol/server-example"
    env:
      API_KEY: "${MY_API_KEY}"
    config:
      instruction: "Custom instruction for this server"

  # HTTP/SSE server (remote)
  remote-server:
    url: https://api.example.com/mcp
    type: sse  # or http
    headers:
      Authorization: "Bearer ${TOKEN}"
    config:
      instruction: "Remote server instruction"

  # Disabled server (will be skipped)
  disabled-server:
    command: node
    args: ["server.js"]
    disabled: true
```

### Environment Variable Interpolation

Use `${VAR_NAME}` syntax to interpolate environment variables:

```yaml
mcpServers:
  api-server:
    command: npx
    args:
      - "@mycompany/mcp-server"
      - "${HOME}/data"  # Expands to /Users/username/data
    env:
      API_KEY: "${MY_API_KEY}"  # Reads from environment
```

### Remote Configuration

Load configuration from a remote URL:

```bash
npx @agiflowai/one-mcp mcp-serve --config-url https://example.com/mcp-config.yaml
```

Merge local and remote configs:

```bash
npx @agiflowai/one-mcp mcp-serve \
  --config ./local-config.yaml \
  --config-url https://example.com/remote-config.yaml \
  --merge-strategy local-priority
```

**Merge Strategies:**
- `local-priority` (default) - Local servers override remote servers
- `remote-priority` - Remote servers override local servers
- `merge-deep` - Deep merge both configs (local values take precedence)

## CLI Commands

### `mcp-serve`

Start the MCP server:

```bash
npx @agiflowai/one-mcp mcp-serve [options]

Options:
  --config <path>              Path to local config file (YAML or JSON)
  --config-url <url>           URL to remote config file
  --merge-strategy <strategy>  How to merge configs (local-priority|remote-priority|merge-deep)
  --cache-ttl <ms>             Cache TTL for remote config in milliseconds (default: 60000)
  --transport <type>           Transport mode: stdio (default), http, sse
  --port <number>              Port for HTTP/SSE transport (default: 3000)
```

### `init`

Initialize an MCP configuration file:

```bash
npx @agiflowai/one-mcp init [options]

Options:
  -o, --output <path>  Output file path (default: mcp-config.yaml)
  --json              Generate JSON config instead of YAML
  -f, --force         Overwrite existing config file
```

### `list-tools`

List all available tools from configured servers:

```bash
npx @agiflowai/one-mcp list-tools --config ./mcp-config.yaml
```

### `describe-tools`

Get detailed information about specific tools:

```bash
npx @agiflowai/one-mcp describe-tools \
  --config ./mcp-config.yaml \
  --tools tool1,tool2
```

### `use-tool`

Execute a tool directly from CLI:

```bash
npx @agiflowai/one-mcp use-tool \
  --config ./mcp-config.yaml \
  --tool-name read_file \
  --args '{"path": "/path/to/file"}'
```

## MCP Tools

When running as an MCP server, one-mcp provides these tools:

### `mcp__one-mcp__describe_tools`

Get detailed information about available tools from connected servers.

**Input:**
```json
{
  "toolNames": ["tool1", "tool2"],
  "serverName": "optional-server-name"
}
```

### `mcp__one-mcp__use_tool`

Execute a tool from any connected server.

**Input:**
```json
{
  "toolName": "read_file",
  "toolArgs": {
    "path": "/path/to/file"
  },
  "serverName": "optional-server-name"
}
```

## Use Cases

### 1. Simplify Multi-Server Setup

Instead of configuring 10+ MCP servers individually in your agent:

**Before:**
```json
{
  "mcpServers": {
    "filesystem": { "command": "npx", "args": ["..."] },
    "database": { "command": "npx", "args": ["..."] },
    "web-search": { "command": "npx", "args": ["..."] },
    // ... 7 more servers
  }
}
```

**After:**
```json
{
  "mcpServers": {
    "one-mcp": {
      "command": "npx",
      "args": ["-y", "@agiflowai/one-mcp", "mcp-serve", "--config", "./mcp-config.yaml"]
    }
  }
}
```

### 2. Centralized Configuration Management

Manage all MCP servers from a single YAML/JSON file that can be:
- Version controlled
- Shared across teams
- Hosted remotely
- Environment-specific

### 3. Mix Local and Remote Servers

```yaml
mcpServers:
  # Local development tools
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "${HOME}/dev"]

  # Company-wide remote tools
  company-apis:
    url: https://mcp.company.com/api
    type: sse
    headers:
      Authorization: "Bearer ${COMPANY_TOKEN}"
```

### 4. Dynamic Configuration

Load different configs based on environment:

```bash
# Development
npx @agiflowai/one-mcp mcp-serve --config ./mcp-dev.yaml

# Production
npx @agiflowai/one-mcp mcp-serve --config ./mcp-prod.yaml
```

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Run in development mode
pnpm dev
```

## Architecture

```
┌─────────────────┐
│  AI Agent       │
│  (Claude/etc)   │
└────────┬────────┘
         │ Single MCP Connection
         │
┌────────▼────────────────────────────┐
│                                     │
│         @agiflowai/one-mcp          │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  ConfigFetcherService       │   │
│  │  - Load YAML/JSON configs   │   │
│  │  - Merge strategies         │   │
│  │  - Environment interpolation│   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  McpClientManagerService    │   │
│  │  - Connect to MCP servers   │   │
│  │  - Manage connections       │   │
│  │  - Route tool calls         │   │
│  └─────────────────────────────┘   │
│                                     │
└──────┬──────┬───────┬──────────────┘
       │      │       │
       │      │       │ Multiple MCP Connections
       │      │       │
   ┌───▼──┐ ┌─▼────┐ ┌▼─────────┐
   │ MCP  │ │ MCP  │ │   MCP    │
   │Server│ │Server│ │  Server  │
   │  1   │ │  2   │ │    3     │
   └──────┘ └──────┘ └──────────┘
```

## License

AGPL-3.0 © AgiflowIO

## Related Packages

- [@agiflowai/scaffold-mcp](../scaffold-mcp) - Scaffolding and templates
- [@agiflowai/architect-mcp](../architect-mcp) - Architecture patterns and code review
- [@agiflowai/aicode-toolkit](../../apps/aicode-toolkit) - Unified CLI toolkit