# Clawdbot MCP Plugin - Installation Guide

## Correct Configuration Method

According to Clawdbot documentation, plugins should be configured in `clawdbot.json`, NOT in `config.yaml`.

### Plugin Manifest

The plugin defines its configuration schema in `clawdbot.plugin.json`:

```json
{
  "id": "clawdbot-mcp-plugin",
  "name": "MCP Server Bridge",
  "description": "Enables Model Context Protocol (MCP) server integration with progressive tool disclosure",
  "version": "0.1.0",
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "configFilePath": {
        "type": "string",
        "description": "Path to mcp-config.yaml file (supports one-mcp's YAML format)",
        "default": ".clawdbot/mcp-config.yaml"
      },
      "serverId": {
        "type": "string",
        "description": "Unique identifier for the toolkit",
        "default": "clawdbot-mcp"
      },
      "noCache": {
        "type": "boolean",
        "description": "Disable configuration caching",
        "default": false
      }
    }
  }
}
```

### Installation Steps

1. **Install the plugin** using the Clawdbot CLI:
   ```bash
   cd /Users/vuongngo/workspace/aicode-toolkit/packages/clawdbot-mcp-plugin
   pnpm build
   clawdbot plugins install <path-or-method>
   ```

2. **Configure in clawdbot.json** (`~/.clawdbot/clawdbot.json`):

   After installation, add configuration to the `plugins.entries` section.

   **CRITICAL**: Config values must be nested under a `"config"` key:

   ```json
   {
     "plugins": {
       "entries": {
         "clawdbot-mcp-plugin": {
           "enabled": true,
           "config": {
             "configFilePath": "/Users/vuongngo/.clawdbot/mcp-config.yaml",
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

### MCP Server Configuration

Create `~/.clawdbot/mcp-config.yaml`:

```yaml
mcpServers:
  memory:
    name: "Memory Storage"
    instruction: "Key-value storage"
    transport: "stdio"
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-memory"]

  filesystem:
    name: "Filesystem Operations"
    instruction: "File operations"
    transport: "stdio"
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/Users/vuongngo/workspace"]
```

**Note**: `command` and `args` are at top level, NOT nested under `config`.

### How Plugin Configuration Works

1. Plugin exports an **object** with `id`, `name`, `description`, `configSchema`, and `register()` method
2. Clawdbot reads the plugin manifest (`clawdbot.plugin.json`) during plugin discovery
3. Configuration is stored in `clawdbot.json` under `plugins.entries[pluginId].config` (nested!)
4. Plugin accesses config via `api.pluginConfig` (NOT `api.getConfig()`)
5. Configuration must match the schema defined in both the manifest and plugin code

### Key Points

- ❌ Do NOT use `config.yaml` for plugin configuration
- ✅ Use `clawdbot.json` for plugin configuration
- Plugin must be installed/discovered before adding configuration
- Configuration keys must match the `configSchema` in the manifest
- Plugin ID in config must match the `id` in `clawdbot.plugin.json`

### Verification

Check plugin status:
```bash
clawdbot plugins list | grep -A 3 "MCP Server"
```

Expected output:
```
│ MCP Server   │ clawdbot │ loaded   │ ...
│ Bridge       │ -mcp-    │          │ ...
│              │ plugin   │          │ ...
```

## TODO

- Document the exact installation command that works
- Verify plugin configuration is recognized after installation
- Test MCP server connections when gateway starts
