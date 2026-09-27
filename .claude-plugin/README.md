# Claude Code Plugin Marketplace

AICode Toolkit provides 4 focused plugins for Claude Code, organized by project maturity and purpose.

## Quick Start

### 1. Add the Marketplace

```bash
/plugin marketplace add https://github.com/AgiFlow/aicode-toolkit
```

### 2. Install Plugins

```bash
# For starting new projects
/plugin install aicode-bootstrap@aicode-toolkit

# For daily development
/plugin install aicode-develop@aicode-toolkit

# For code reviews
/plugin install aicode-review@aicode-toolkit

# For creating templates
/plugin install aicode-admin@aicode-toolkit
```

## Available Plugins

### aicode-bootstrap

**Purpose:** Create new projects from boilerplate templates
**When to use:** Week 1 - Starting new projects

**What you get:**

- `list-boilerplates` - Browse available project templates
- `use-boilerplate` - Create new projects from templates

**Example:**

```
Create a new Next.js application with Drizzle ORM
```

---

### aicode-develop

**Purpose:** Build features with design pattern guidance
**When to use:** Weeks 2-∞ - Daily feature development

**What you get:**

- `list-scaffolding-methods` - See available features to add
- `use-scaffold-method` - Generate pages, components, services
- `get-file-design-pattern` - Understand patterns for specific files
- `/edit-with-pattern` - Slash command for enforced quality workflow
- **3 specialized agents:**
  - `architecture-reviewer` - Evaluate architectural decisions
  - `test-coverage` - Generate comprehensive tests
  - `migration-assistant` - Guide framework/library upgrades

**Example:**

```
Add a new product page to my Next.js app
```

**Using agents:**

```
Task: architecture-reviewer
Prompt: Should I use WebSockets or Server-Sent Events for real-time notifications?
```

**Using slash commands:**

```
/edit-with-pattern
```

---

### aicode-review

**Purpose:** Enforce code quality and review standards
**When to use:** Week 4+ - Code reviews and quality assurance

**What you get:**

- `review-code-change` - Review code against rules and patterns

**Example:**

```
Review this component for code quality issues
```

---

### aicode-admin

**Purpose:** Create custom templates, patterns, and rules
**When to use:** As needed - Platform engineering, template creation

**What you get:**

- `generate-boilerplate` - Create new project templates
- `generate-feature-scaffold` - Create feature generators
- `generate-boilerplate-file` - Create template files
- `add-design-pattern` - Define architecture patterns
- `add_rule` - Create coding rules

**Example:**

```
Create a new boilerplate for our microservice template
```

## Using Specialized Agents

After installing `aicode-develop`, you can use specialized agents for complex tasks:

### Architecture Reviewer

Analyzes architectural decisions and provides trade-off analysis.

```
Task: architecture-reviewer
Prompt: I need to add real-time notifications to my Next.js app. Should I use WebSockets or Server-Sent Events?
```

### Test Coverage

Generates comprehensive test suites and identifies untested code.

```
Task: test-coverage
Prompt: Generate tests for src/components/ProductCard.tsx
```

### Migration Assistant

Guides framework/library upgrades with phased migration plans.

```
Task: migration-assistant
Prompt: Help me migrate from Next.js 12 to Next.js 15
```

## Using Slash Commands

After installing `aicode-develop`, use the `/edit-with-pattern` command to enforce quality workflow:

```
/edit-with-pattern
```

This ensures you:

1. Check design patterns before editing
2. Make your changes
3. Review code for violations
4. Fix any issues found

## Managing Plugins

### List Installed Plugins

```bash
/plugin
```

### Update Marketplace

```bash
/plugin marketplace update aicode-toolkit
```

### Uninstall Plugin

```bash
/plugin uninstall aicode-develop@aicode-toolkit
```

## Learn More

- **[Plugin Selection Guide](../docs/claude-code/PLUGIN_SELECTION_GUIDE.md)** - Choose the right plugins for your needs
- **[Full Marketplace Documentation](../docs/claude-code/MARKETPLACE.md)** - Complete guide and examples
- **[Official Claude Code Plugin Docs](https://docs.claude.com/en/docs/claude-code/plugin-marketplaces)** - Plugin marketplace specification

## Contributing

### Adding New Commands

1. Create command file in `configs/claude-code/commands/my-command.md`
2. Reference in `.claude-plugin/marketplace.json`:
   ```json
   {
     "commands": ["./configs/claude-code/commands/my-command.md"]
   }
   ```

### Adding New Agents

1. Create agent file in `configs/claude-code/agents/my-agent.md`
2. Follow the agent format with frontmatter:
   ```markdown
   ---
   name: my-agent
   description: Use this agent when... <example>...</example>
   color: blue
   ---

   You are a [Agent Name] specialized in...
   ```
3. Reference in `.claude-plugin/marketplace.json`:
   ```json
   {
     "agents": ["./configs/claude-code/agents/my-agent.md"]
   }
   ```

**Agent format requirements:**

- Frontmatter with `name`, `description` (with 3 examples), and `color`
- Examples with `Context:`, `user:`, `assistant:`, and `<commentary>`
- Colors: blue, green, purple, orange, red, yellow

## Package Documentation

- [scaffold-mcp Package](../packages/scaffold-mcp/README.md) - Scaffolding MCP server
- [architect-mcp Package](../packages/architect-mcp/README.md) - Architecture and rules MCP server
