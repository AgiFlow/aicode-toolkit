# @agiflowai/one-mcp

MCP proxy for aggregating multiple MCP servers behind one endpoint.

`one-mcp` supports three proxy modes:

- `meta`: expose `describe_tools` and `use_tool`
- `flat`: expose proxied tools and resources directly
- `search`: expose `describe_tools`, `list_tools`, and `use_tool`

Use this when:
- you want one MCP entry instead of many
- you want cached startup metadata across multiple downstream servers
- you want to choose between meta-tool routing and direct flat exposure

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

To change proxy behavior, set `--proxy-mode`:

```json
{
  "mcpServers": {
    "one-mcp": {
      "command": "npx",
      "args": ["-y", "@agiflowai/one-mcp", "mcp-serve", "--proxy-mode", "search", "--config", "./mcp-config.yaml"]
    }
  }
}
```

### 3. Start Using

`one-mcp` now fronts the configured downstream servers through one MCP server.

---

## Configuration

### Proxy Modes

Use `mcp-serve --proxy-mode <mode>` to control how one-mcp exposes downstream tools.

`meta` mode:
- Default mode
- Exposes `describe_tools` and `use_tool`
- `describe_tools` includes the proxied capability catalog in its description

`flat` mode:
- Exposes proxied tools directly in `tools/list`
- Exposes proxied resources directly in `resources/list`
- Name clashes are prefixed as `serverName__toolName` or `serverName__resourceUri`
- `describe_tools` is still exposed when file-based skills or prompt-based skills exist

`search` mode:
- Exposes `describe_tools`, `list_tools`, and `use_tool`
- `describe_tools` stays compact and is used for schemas and skill instructions
- `list_tools` shows server capability summaries and can filter results by capability or server

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

  # Custom timeout for slow servers
  slow-server:
    command: npx
    args: ["-y", "@heavy/mcp-package"]
    timeout: 60000  # 60 seconds (default: 30000)
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

Prevent specific downstream tools from being listed or executed:

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

Omit downstream tool descriptions from capability listings:

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

### Skills

File-based skills are loaded from `SKILL.md` files and exposed through `describe_tools`.

#### Configuration

Enable file-based skills by adding a `skills` section:

```yaml
mcpServers:
  # ... your MCP servers

skills:
  paths:
    - ".claude/skills"           # Relative to config file
    - "/absolute/path/to/skills" # Absolute paths also supported
```

#### Skill File Structure

Example:
```
.claude/skills/
├── pdf/
│   └── SKILL.md
└── data-analysis/
    └── SKILL.md
```

`SKILL.md` format:
```markdown
---
name: pdf
description: Create and manipulate PDF documents
---

# PDF Skill

This skill helps you work with PDF files...

## Usage
...
```

#### Required Frontmatter

Each `SKILL.md` must define:
- `name`: Unique identifier for the skill
- `description`: Brief description shown to clients

#### Precedence

When multiple paths are configured, skills from earlier paths take precedence over skills with the same name from later paths.

### Prompt-Based Skills

You can also expose MCP prompts as skills.

#### Auto-Detection From Frontmatter

If prompt content contains YAML frontmatter with `name` and `description`, `one-mcp` can expose it as a skill.

Prompt content example:
```markdown
---
name: code-reviewer
description: Review code for best practices and potential issues
---

# Code Review Instructions

When reviewing code, follow these guidelines...
```

Some servers, such as `@agiflowai/scaffold-mcp`, support `--prompt-as-skill` and can emit that frontmatter automatically:

```yaml
mcpServers:
  scaffold-mcp:
    command: npx
    args:
      - -y
      - "@agiflowai/scaffold-mcp"
      - "mcp-serve"
      - "--prompt-as-skill"  # Enables front-matter in prompts
```

Multi-line descriptions are supported:

```markdown
---
name: complex-skill
description: |
  A skill that does multiple things:
  - First capability
  - Second capability
  - Third capability
---
```

#### Explicit Configuration

You can also configure prompt-to-skill mappings explicitly:

```yaml
mcpServers:
  my-server:
    command: npx
    args:
      - -y
      - "@mycompany/mcp-server"
    config:
      instruction: "My MCP server"
      prompts:
        code-review:
          skill:
            name: code-reviewer
            description: "Review code for best practices and potential issues"
            folder: "./prompts/code-review"  # Optional: resource folder
        documentation:
          skill:
            name: doc-generator
            description: "Generate documentation from code"
```

#### Skill Configuration Fields (Explicit Config)

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique skill identifier shown to clients |
| `description` | Yes | Brief description of what the skill does |
| `folder` | No | Optional folder path for skill resources |

#### Skill Naming and Precedence

- **File-based skills** take precedence over prompt-based skills with the same name
- Skills are only prefixed with `skill__` when they clash with MCP tool names
- Skills that only clash with other skills are deduplicated (first one wins, no prefix)

## MCP Tools

The MCP tools exposed by `one-mcp` depend on `--proxy-mode`.

### `describe_tools`

Returns detailed tool schemas and skill instructions.

```json
{
  "toolNames": ["read_file", "write_file"]
}
```

### `use_tool`

Executes a proxied tool in `meta` and `search` modes.

```json
{
  "toolName": "read_file",
  "toolArgs": {
    "path": "/path/to/file"
  }
}
```

### `list_tools`

Only available in `search` mode. Returns tool names grouped by proxied server, with server capability summaries and optional filtering.

```json
{
  "capability": "review",
  "serverName": "architect-mcp"
}
```

---

## CLI Commands

```bash
# Start MCP server (stdio, for Claude Code/Cursor)
npx @agiflowai/one-mcp mcp-serve --config ./mcp-config.yaml

# Start and clear the cached definitions first
npx @agiflowai/one-mcp mcp-serve --config ./mcp-config.yaml --clear-definitions-cache

# Start with HTTP transport
npx @agiflowai/one-mcp mcp-serve --config ./mcp-config.yaml --type http --port 3000

# Initialize config file
npx @agiflowai/one-mcp init --output mcp-config.yaml

# Pre-download packages for faster startup
npx @agiflowai/one-mcp prefetch --config ./mcp-config.yaml

# Pre-download packages and build a definitions cache for faster discovery
npx @agiflowai/one-mcp prefetch --config ./mcp-config.yaml --definitions-out ./.cache/one-mcp-definitions.json

# Search tools across configured servers
npx @agiflowai/one-mcp search-tools --config ./mcp-config.yaml

# Search tools as JSON
npx @agiflowai/one-mcp search-tools --config ./mcp-config.yaml --json

# Filter tools by capability or server
npx @agiflowai/one-mcp search-tools --config ./mcp-config.yaml --capability review
npx @agiflowai/one-mcp search-tools --config ./mcp-config.yaml --server filesystem

# Get tool details
npx @agiflowai/one-mcp describe-tools --config ./mcp-config.yaml --tools read_file,write_file

# Execute a tool directly
npx @agiflowai/one-mcp use-tool --config ./mcp-config.yaml --tool-name read_file --args '{"path": "/tmp/test.txt"}'

# List all resources from configured servers
npx @agiflowai/one-mcp list-resources --config ./mcp-config.yaml

# Filter resources by server
npx @agiflowai/one-mcp list-resources --config ./mcp-config.yaml --server my-server

# Read a resource by URI
npx @agiflowai/one-mcp read-resource --config ./mcp-config.yaml file:///readme.md

# Read from a specific server
npx @agiflowai/one-mcp read-resource --config ./mcp-config.yaml --server my-server file:///readme.md

# List prompts from configured servers
npx @agiflowai/one-mcp list-prompts --config ./mcp-config.yaml

# Get a prompt by name
npx @agiflowai/one-mcp get-prompt --config ./mcp-config.yaml scaffold-feature

# Get a prompt from a specific server with arguments
npx @agiflowai/one-mcp get-prompt --config ./mcp-config.yaml --server scaffold-mcp --args '{"projectPath":"apps/web"}' scaffold-feature
```

### Prefetch Command

Pre-download packages used by MCP servers (npx, pnpx, uvx, uv) and optionally build a cached definitions file for faster tool/prompt discovery during `mcp-serve` startup:

```bash
# Prefetch all packages
npx @agiflowai/one-mcp prefetch --config ./mcp-config.yaml

# Prefetch packages and write a definitions cache
npx @agiflowai/one-mcp prefetch --config ./mcp-config.yaml --definitions-out ./.cache/one-mcp-definitions.json

# Build only the definitions cache
npx @agiflowai/one-mcp prefetch --config ./mcp-config.yaml --definitions-out ./.cache/one-mcp-definitions.yaml --skip-packages

# Clear the default definitions cache
npx @agiflowai/one-mcp prefetch --config ./mcp-config.yaml --clear-definitions-cache --skip-packages

# Dry run - see what would be prefetched
npx @agiflowai/one-mcp prefetch --config ./mcp-config.yaml --dry-run

# Run prefetch in parallel (faster)
npx @agiflowai/one-mcp prefetch --config ./mcp-config.yaml --parallel

# Filter by package manager
npx @agiflowai/one-mcp prefetch --config ./mcp-config.yaml --filter npx
```

| Option | Description |
|--------|-------------|
| `-c, --config` | Path to config file |
| `-p, --parallel` | Run prefetch commands in parallel |
| `-d, --dry-run` | Show what would be prefetched without executing |
| `-f, --filter` | Filter by package manager: `npx`, `pnpx`, `uvx`, or `uv` |
| `--definitions-out` | Write a JSON or YAML definitions cache file for `mcp-serve` |
| `--skip-packages` | Skip package prefetch and only write the definitions cache |
| `--clear-definitions-cache` | Delete the effective definitions cache file before continuing |

### Definitions Cache Workflow

For installations with many MCP servers, especially stdio-backed servers, `mcp-serve` now tries to use a definitions cache automatically. The default cache path is under `~/.aicode-toolkit/`, and the filename is derived from the sanitized absolute config path. For example, `/tmp/project/mcp-config.yaml` becomes `~/.aicode-toolkit/tmp_project_mcp-config.yaml.definitions-cache.json`.

If that cache file exists and matches the current config, `one-mcp` starts from cached tool/prompt metadata and connects to downstream MCP servers on demand. If the cache is missing or stale, `one-mcp` keeps the current eager startup behavior and writes a fresh cache in the background for the next run.

You can still prebuild the cache explicitly:

```bash
# Step 1: Warm packages and cache definitions
npx @agiflowai/one-mcp prefetch --config ./mcp-config.yaml --definitions-out ./.cache/one-mcp-definitions.json

# Step 2: Start one-mcp using the prefetched definitions
npx @agiflowai/one-mcp mcp-serve --config ./mcp-config.yaml --definitions-cache ./.cache/one-mcp-definitions.json
```

The definitions cache stores tool schemas, prompt metadata, and prompt-based skill metadata. Use `--clear-definitions-cache` on `mcp-serve` or `prefetch` to delete the cache and force a cold start.

### Server Options

| Option | Description | Default |
|--------|-------------|---------|
| `-c, --config` | Path to config file (YAML or JSON) | Required |
| `-t, --type` | Transport: `stdio`, `http`, `sse` | `stdio` |
| `-p, --port` | Port for HTTP/SSE | `3000` |
| `--host` | Host for HTTP/SSE | `localhost` |
| `--no-cache` | Force reload config, bypass cache | `false` |
| `--definitions-cache` | Read tool/prompt/skill definitions from a specific JSON or YAML cache file | Auto-derived from config path |
| `--clear-definitions-cache` | Delete the effective definitions cache file before startup | `false` |

## Notes

- `one-mcp` reads YAML or JSON config files
- environment variables use `${VAR_NAME}` interpolation
- downstream stdio/http/sse servers can be mixed in one config
- definitions cache is keyed by config content and one-mcp version

## Related Packages

- [@agiflowai/scaffold-mcp](../scaffold-mcp) - Code scaffolding and templates
- [@agiflowai/architect-mcp](../architect-mcp) - Design patterns and code review
- [@agiflowai/aicode-toolkit](../../apps/aicode-toolkit) - Unified CLI toolkit

---

## License

AGPL-3.0 © AgiflowIO
