# @agiflowai/clawdbot-mcp-plugin

Clawdbot plugin for integrating Model Context Protocol (MCP) servers with progressive tool disclosure.

## Overview

This plugin bridges the `@agiflowai/one-mcp` package to enable MCP server support in Clawdbot. It exposes only two tools (`mcp__describe_tools` and `mcp__use_tool`) using progressive disclosure, allowing agents to discover and use MCP tools on-demand without cluttering the tool list.

## Features

- **Progressive Disclosure**: Only 2 tools registered (`mcp__describe_tools`, `mcp__use_tool`)
- **Dynamic Tool Discovery**: Tools are described on-demand, not pre-registered
- **Multiple MCP Servers**: Connect to multiple MCP servers simultaneously
- **Skill Support**: Integrate skills from file-based or prompt-based sources
- **Clean Separation**: Reuses one-mcp as a library dependency (no code duplication)

## Installation

```bash
npm install @agiflowai/clawdbot-mcp-plugin
# or
pnpm add @agiflowai/clawdbot-mcp-plugin
```

## Configuration

### Clawdbot Gateway Config

Add the plugin to your Clawdbot configuration (`~/.clawdbot/clawdbot.json`):

```json
{
  "plugins": {
    "entries": {
      "clawdbot-mcp-plugin": {
        "enabled": true,
        "config": {
          "configFilePath": "/Users/username/.clawdbot/mcp-config.yaml",
          "serverId": "clawdbot-toolkit",
          "noCache": false
        }
      }
    }
  },
  "agents": {
    "list": [
      {
        "id": "main",
        "tools": {
          "allow": [
            "mcp__describe_tools",
            "mcp__use_tool"
          ]
        }
      }
    ]
  }
}
```

**Important**:
- Plugin config must be nested under `"config"` key
- Plugin ID in `entries` must match the plugin manifest ID: `"clawdbot-mcp-plugin"`
- Use absolute path for `configFilePath` to avoid path resolution issues

### MCP Server Config

Create `.clawdbot/mcp-config.yaml`:

```yaml
mcpServers:
  memory:
    name: "Memory Storage"
    instruction: "Simple key-value storage"
    transport: "stdio"
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-memory"]

  filesystem:
    name: "Filesystem Operations"
    instruction: "File operations"
    transport: "stdio"
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/Users/username/workspace"]
```

**Note**: `command` and `args` are at top level, NOT nested under `config`.

## Usage

Agents use two tools to access MCP servers:

```typescript
// 1. Discover tools
mcp__describe_tools({ toolNames: ["read_file", "write_file"] })

// 2. Execute tools
mcp__use_tool({
  toolName: "read_file",
  toolArgs: { path: "/path/to/file.txt" }
})
```

## Architecture

### Plugin Structure

The plugin exports an object (not a function) with the following structure:

```typescript
const mcpBridgePlugin = {
  id: 'clawdbot-mcp-plugin',
  name: 'MCP Server Bridge',
  description: 'Enables MCP server integration...',
  configSchema: Type.Object({
    // TypeBox schema for config validation
  }),
  register(api: ClawdbotPluginApi) {
    // Register services and tools
    api.registerService({ id: 'mcp-server', start() {...}, stop() {...} });
    api.registerTool({ name: 'mcp__describe_tools', ... }, { name: 'mcp__describe_tools' });
    api.registerTool({ name: 'mcp__use_tool', ... }, { name: 'mcp__use_tool' });
  }
};

export default mcpBridgePlugin;
```

### Plugin Lifecycle

1. **Discovery & Loading**: Gateway scans plugin directories and loads manifests
2. **Registration**: Gateway calls `plugin.register(api)` with Clawdbot API
3. **Service Start**: Gateway calls all registered service `start()` methods (async initialization happens here)
4. **Runtime**: Tools execute and forward requests to one-mcp
5. **Service Stop**: Gateway calls service `stop()` methods on shutdown

### Progressive Disclosure Pattern

- **Minimal Surface Area**: Only 2 tools exposed to agents
- **On-Demand Discovery**: Tools are described when requested via `mcp__describe_tools`
- **Dynamic Description**: Toolkit description generated after MCP servers connect
- **No Tool Bloat**: Avoid registering hundreds of individual MCP tools

### Key Implementation Details

- **Plugin Object**: Exports object with `register()` method, not a plain function
- **Tool Registration**: Second parameter must be `{ name: 'tool_name' }`, not `{ optional: false }`
- **Service Registration**: Use `id:` property, not `name:`
- **API Access**: Use `api.pluginConfig` (not `api.getConfig()`), `api.logger` (not `api.log`), `api.registerTool`, `api.registerService`
- **Async Work**: Do all async initialization in `service.start()`, not in `register()` function

## Development

```bash
# Install dependencies
pnpm install

# Build the package
pnpm build

# Type check
pnpm typecheck

# Run tests
pnpm test
```

## Configuration Schema

The plugin accepts the following configuration options:

- `configFilePath` (string): Path to mcp-config.yaml file (default: `.clawdbot/mcp-config.yaml`)
- `serverId` (string): Unique identifier for the toolkit (default: `clawdbot-mcp`)
- `noCache` (boolean): Disable configuration caching (default: `false`)

## Error Handling

- **Connection Failures**: Logged but don't crash the plugin
- **Tool Execution Errors**: Returned as structured error responses
- **Configuration Errors**: Validated against JSON schema, fail fast

## License

AGPL-3.0

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for development guidelines.
