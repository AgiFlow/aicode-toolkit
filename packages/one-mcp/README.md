# @agiflowai/one-mcp

> MCP proxy server for progressive tool discovery and reduced token usage

Connect to multiple MCP servers through a single proxy that loads tools on-demand, reducing initial token usage by 90%+.

## The Problem

When connecting to multiple MCP servers directly, AI agents load ALL tools from ALL servers at startup:

```
10 MCP Servers:
  Server 1: 20 tools × 200 tokens = 4,000 tokens
  Server 2: 15 tools × 200 tokens = 3,000 tokens
  Server 3: 30 tools × 200 tokens = 6,000 tokens
  ...
  Total: ~40,000+ tokens consumed BEFORE you even start coding
```

This wastes context window on tool descriptions you may never use.

## The Solution

one-mcp acts as a smart proxy with progressive discovery:

```
Traditional (High Token Cost):          Progressive Discovery (Low Token Cost):
┌─────────────────┐                    ┌─────────────────┐
│  AI Agent       │ ← 40,000+ tokens   │  AI Agent       │ ← 400 tokens
├─────────────────┤                    ├─────────────────┤
│ Server 1 (20)   │                    │  one-mcp        │ ← 2 meta-tools
│ Server 2 (15)   │                    │  (proxy)        │
│ Server 3 (30)   │                    └────────┬────────┘
│ ...             │                             │ loads on-demand
└─────────────────┘                        ┌────┴────┬────────┐
                                           │ Srv 1   │ Srv 2  │ ...
                                           └─────────┴────────┘
```

1. **Initial**: Agent sees only 2 meta-tools (`describe_tools`, `use_tool`) - ~400 tokens
2. **Discovery**: Agent calls `describe_tools` for specific servers when needed
3. **Execution**: Agent calls `use_tool` to run tools through the proxy

**Result: 90%+ reduction in initial token usage**

---

## Quick Start

### 1. Create Configuration

```bash
npx @agiflowai/one-mcp init
```

This creates `mcp-config.yaml`:

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

  scaffold-mcp:
    command: npx
    args:
      - -y
      - "@agiflowai/scaffold-mcp"
      - "mcp-serve"
    config:
      instruction: "Scaffold projects and features"
```

### 2. Configure Your Agent

Add to your MCP config (`.mcp.json`, `.cursor/mcp.json`, etc.):

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

### 3. Start Using

Your agent now has access to all tools from all configured servers through one connection.

---

## Configuration

### Server Types

```yaml
mcpServers:
  # Stdio server (local command)
  local-server:
    command: npx
    args:
      - -y
      - "@modelcontextprotocol/server-example"
    env:
      API_KEY: "${MY_API_KEY}"
    config:
      instruction: "Description for the AI agent"

  # HTTP/SSE server (remote)
  remote-server:
    url: https://api.example.com/mcp
    type: sse  # or http
    headers:
      Authorization: "Bearer ${TOKEN}"
    config:
      instruction: "Remote server description"

  # Disabled server (skipped)
  disabled-server:
    command: node
    args: ["server.js"]
    disabled: true
```

### Environment Variables

Use `${VAR_NAME}` syntax:

```yaml
mcpServers:
  api-server:
    command: npx
    args:
      - "@mycompany/mcp-server"
      - "${HOME}/data"           # Expands to /Users/username/data
    env:
      API_KEY: "${MY_API_KEY}"   # Reads from environment
```

### Tool Blacklisting

Block specific tools from being listed or executed:

```yaml
mcpServers:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"]
    config:
      instruction: "File system access (read-only)"
      toolBlacklist:
        - write_file
        - create_directory
        - delete_file
```

Blacklisted tools:
- Won't appear in tool listings
- Return an error if called

### Compact Tool Descriptions

Reduce token usage by omitting verbose descriptions:

```yaml
mcpServers:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"]
    config:
      omitToolDescription: true  # Show only tool names
```

**Default output:**
```
filesystem:
  - read_file: Read contents of a file at the specified path...
  - list_directory: List all files and directories...
```

**With omitToolDescription:**
```
filesystem:
  read_file, list_directory, search_files
```

---

## MCP Tools

When running as an MCP server, one-mcp provides:

### `describe_tools`

Get information about available tools:

```json
{
  "toolNames": ["read_file", "write_file"],
  "serverName": "filesystem"  // optional
}
```

### `use_tool`

Execute a tool from any connected server:

```json
{
  "toolName": "read_file",
  "toolArgs": {
    "path": "/path/to/file"
  },
  "serverName": "filesystem"  // optional, auto-detected if unique
}
```

---

## CLI Commands

```bash
# Start MCP server (stdio, for Claude Code/Cursor)
npx @agiflowai/one-mcp mcp-serve --config ./mcp-config.yaml

# Start with HTTP transport
npx @agiflowai/one-mcp mcp-serve --config ./mcp-config.yaml --type http --port 3000

# Initialize config file
npx @agiflowai/one-mcp init --output mcp-config.yaml

# List all tools from configured servers
npx @agiflowai/one-mcp list-tools --config ./mcp-config.yaml

# Get tool details
npx @agiflowai/one-mcp describe-tools --config ./mcp-config.yaml --tools read_file,write_file

# Execute a tool directly
npx @agiflowai/one-mcp use-tool --config ./mcp-config.yaml --tool-name read_file --args '{"path": "/tmp/test.txt"}'
```

### Server Options

| Option | Description | Default |
|--------|-------------|---------|
| `-c, --config` | Path to config file (YAML or JSON) | Required |
| `-t, --type` | Transport: `stdio`, `http`, `sse` | `stdio` |
| `-p, --port` | Port for HTTP/SSE | `3000` |
| `--host` | Host for HTTP/SSE | `localhost` |
| `--no-cache` | Force reload config, bypass cache | `false` |

---

## Use Cases

### 1. Consolidate Multiple Servers

**Before (10 server configs):**
```json
{
  "mcpServers": {
    "filesystem": { "command": "npx", "args": ["..."] },
    "database": { "command": "npx", "args": ["..."] },
    "web-search": { "command": "npx", "args": ["..."] }
    // ... 7 more
  }
}
```

**After (1 config):**
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

### 2. Mix Local and Remote Servers

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

### 3. Environment-Specific Configs

```bash
# Development
npx @agiflowai/one-mcp mcp-serve --config ./mcp-dev.yaml

# Production
npx @agiflowai/one-mcp mcp-serve --config ./mcp-prod.yaml
```

---

## Architecture

```
┌─────────────────┐
│  AI Agent       │
│  (Claude/etc)   │
└────────┬────────┘
         │ Single MCP Connection (2 tools)
         │
┌────────▼────────────────────────────┐
│         @agiflowai/one-mcp          │
│                                     │
│  • Load configs (YAML/JSON)         │
│  • Environment interpolation        │
│  • Connect to servers on-demand     │
│  • Route tool calls                 │
│  • Apply blacklists                 │
└──────┬──────┬───────┬───────────────┘
       │      │       │
       │      │       │ Multiple MCP Connections
       │      │       │
   ┌───▼──┐ ┌─▼────┐ ┌▼─────────┐
   │ MCP  │ │ MCP  │ │   MCP    │
   │Server│ │Server│ │  Server  │
   │  1   │ │  2   │ │    3     │
   └──────┘ └──────┘ └──────────┘
```

---

## Related Packages

- [@agiflowai/scaffold-mcp](../scaffold-mcp) - Code scaffolding and templates
- [@agiflowai/architect-mcp](../architect-mcp) - Design patterns and code review
- [@agiflowai/aicode-toolkit](../../apps/aicode-toolkit) - Unified CLI toolkit

---

## License

AGPL-3.0 © AgiflowIO
