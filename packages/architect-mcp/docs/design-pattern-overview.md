# Design Pattern Overview

This document explains the high-level design pattern system and philosophy of the architect-mcp package.

## Vision: Codifying Software Architecture

### The Problem

When building software in teams, maintaining consistent architecture and coding standards is challenging:

1. **Knowledge Loss**: Design patterns exist in developers' heads, not in code
2. **Inconsistency**: Different files follow different patterns, even within the same project
3. **Onboarding**: New developers don't know which patterns to follow
4. **Evolution**: As projects grow, architectural decisions get forgotten
5. **Reviews**: Code reviews focus on syntax, not architectural alignment

### The Solution

architect-mcp makes architecture **explicit, discoverable, and enforceable** by:

1. **Codifying Patterns**: Design patterns live in `architect.yaml` files alongside code
2. **Context-Aware Guidance**: Tools detect which patterns apply to specific files
3. **Automated Review**: Rules in `RULES.yaml` define must/should/must-not coding standards
4. **Template Reuse**: Templates carry architecture knowledge across projects
5. **AI Integration**: LLM agents can understand and enforce architectural decisions

## Core Philosophy

### 1. Architecture as Configuration

**Principle**: Architecture should be declarative, not just in documentation.

**Implementation**:

- `architect.yaml` declares design patterns for file types
- `RULES.yaml` declares coding standards and rules
- Templates bundle both configuration and implementation

**Why it matters**:

- Patterns are version-controlled alongside code
- Changes to architecture are explicit in git history
- New team members discover patterns by reading config files

### 2. Context-Aware Guidance

**Principle**: Developers should get relevant guidance without searching docs.

**Thought Process**:

```
Developer opens: src/services/UserService.ts
  ↓
architect-mcp detects:
  - This is a service file (from path pattern)
  - Project uses "typescript-mcp-package" template
  - Service files follow "Service Layer Pattern"
  ↓
Returns specific guidance:
  - Use dependency injection
  - Delegate business logic to services
  - Return typed results
  - Examples of what to do/not do
```

**Why it matters**:

- Zero friction - guidance appears when needed
- Precise - only shows patterns relevant to current file
- Actionable - includes code examples

### 3. Template-Based Knowledge Transfer

**Principle**: Good architecture should be reusable across projects.

**Thought Process**:

```
Create Template:
  typescript-mcp-package/
    ├── architect.yaml      ← Design patterns
    ├── RULES.yaml          ← Coding standards
    └── scaffold.yaml       ← Boilerplate generators

Use Template:
  Project A (from template) → inherits patterns + rules
  Project B (from template) → inherits patterns + rules

Update Template:
  Fix pattern in template → all projects can adopt update
```

**Why it matters**:

- Consistency across projects
- Architecture improvements benefit all projects
- Knowledge captured once, applied everywhere

### 4. Progressive Enhancement with LLM

**Principle**: Provide value without LLM, enhance with LLM when available.

**Two Modes**:

**Mode 1: Agent-Driven (LLM disabled)**

```
architect-mcp returns:
  - All potential design patterns
  - All applicable rules with examples
  ↓
AI agent analyzes:
  - Reads patterns and rules
  - Reviews code itself
  - Makes decisions
```

**Mode 2: LLM-Enhanced (LLM enabled)**

```
architect-mcp:
  - Filters patterns based on file content
  - Reviews code against rules
  - Returns specific violations
  ↓
AI agent receives:
  - Only relevant patterns
  - Specific code smells identified
  - Actionable feedback
```

**Why this approach**:

- Works without requiring external LLM services
- Leverages LLM when available for precision
- AI agent always gets structured architectural context

## How Design Patterns Work

### Pattern Definition (architect.yaml)

**Concept**: Patterns map file paths to architectural guidance.

```yaml
features:
  - name: Service Layer
    design_pattern: Service classes with dependency injection
    includes:
      - src/services/**/*.ts # Files this pattern applies to
    description: |
      Services contain business logic and are injected
      into other components. They should be stateless
      and delegate to repositories for data access.
```

**Key Insight**: Glob patterns create **architectural zones** in your codebase.

### Pattern Discovery Flow

**High-Level Process**:

```
1. File Context Detection
   Question: Which project does this file belong to?
   Answer: Find project.json, read sourceTemplate

2. Pattern Loading
   Question: What patterns exist for this template?
   Answer: Load template's architect.yaml + global architect.yaml

3. Pattern Matching
   Question: Which patterns apply to this specific file?
   Answer: Match file path against pattern globs

4. Enrichment (Optional)
   Question: Which patterns are ACTUALLY relevant?
   Answer: Ask LLM to filter based on file content
```

**Example**:

```
File: packages/my-app/src/services/UserService.ts

Step 1: Project Detection
  → Found: packages/my-app/project.json
  → Template: typescript-mcp-package

Step 2: Load Patterns
  → Template patterns: Service Layer, Tool Pattern, CLI Pattern
  → Global patterns: TypeScript Standards, Export Standards

Step 3: Match Patterns
  → "src/services/**/*.ts" matches → Service Layer Pattern ✓
  → "src/tools/**/*.ts" doesn't match → Skip Tool Pattern
  → "**/*.ts" matches → TypeScript Standards ✓

Step 4: LLM Filter (if enabled)
  → Read UserService.ts content
  → Ask: "Is Service Layer Pattern relevant?" → Yes
  → Ask: "Is TypeScript Standards relevant?" → Yes
  → Return: 2 patterns (both relevant)

Result: Developer sees Service Layer + TypeScript Standards guidance
```

### Why Glob Patterns?

**Design Decision**: Use file paths as architectural boundaries.

**Rationale**:

- **Convention over Configuration**: File organization reflects architecture
- **Intuitive**: `src/services/` contains services, `src/tools/` contains tools
- **Scalable**: Add new patterns without changing existing code
- **Discoverable**: Developers can infer architecture from folder structure

## How Code Review Works

**Note**: For detailed information about the rules system, see [rules-overview.md](./rules-overview.md).

**High-Level Concept**: Code review validates that code follows defined coding standards (RULES.yaml).

**Two-Mode Operation**:

1. **Agent Review Mode** (LLM disabled):
   - Returns all applicable rules with examples
   - AI agent reviews code itself against rules
   - Fast, no external API calls

2. **LLM Review Mode** (LLM enabled):
   - Uses Claude Code CLI to analyze code
   - Returns specific violations found
   - Precise, context-aware feedback

**Process Overview**:

```
File → Find applicable rules → Review (agent or LLM) → Report violations
```

## Design Decisions Explained

### Why Separate Patterns from Rules?

**Patterns (architect.yaml)**:

- **Purpose**: Architectural guidance - "What should this file do?"
- **Scope**: High-level design decisions
- **Use Case**: Understanding system structure

**Rules (RULES.yaml)**:

- **Purpose**: Code quality enforcement - "How should this code be written?"
- **Scope**: Specific coding standards
- **Use Case**: Code review and validation

**Rationale**: Separation of concerns - architecture vs. implementation quality.

### Why Optional LLM Tools?

**Philosophy**: AI assistance should enhance, not require.

**Benefits of Optional LLM**:

1. **Flexibility**: Works in any environment (with or without LLM access)
2. **Speed**: When disabled, instant response (no API calls)
3. **Cost**: No LLM costs when running in agent mode
4. **Privacy**: Code never leaves local environment when disabled
5. **Reliability**: Graceful degradation if LLM service unavailable
6. **Focus**: Agent can focus on high-level decisions while LLM handles detailed analysis
7. **Multi-LLM**: Combine power of different LLMs - use best tool for each task

### Why Use Claude Code CLI Instead of SDK?

**Problem**: Anthropic SDK doesn't easily support Vertex AI authentication.

**Solution**: Wrap Claude Code CLI which handles auth automatically.

**Trade-off**:

- ✓ Works with Vertex AI out of the box
- ✓ Simple `execa` wrapper
- ✗ Requires Claude Code CLI installed
- ✗ Slightly slower than direct SDK calls

**Decision**: Prioritize compatibility over performance.

### Why Template-Based Architecture?

**Observation**: Good architecture gets created once, then copy-pasted.

**Problem**: Copy-paste loses connection to original - no updates flow through.

**Solution**: Templates with sourceTemplate reference.

```
Template:
  typescript-mcp-package/
    ├── architect.yaml     ← Canonical patterns
    └── RULES.yaml         ← Canonical rules

Projects (reference template):
  packages/my-app/project.json:
    { "sourceTemplate": "typescript-mcp-package" }

architect-mcp:
  → Reads sourceTemplate
  → Loads patterns + rules from template
  → Applies to project
```

**Benefits**:

- **Single source of truth**: Template is canonical
- **Update propagation**: Improve template → all projects benefit
- **Consistency**: All template projects follow same patterns
- **Discoverability**: New project? Check the template

## Mental Model

### Think of architect-mcp as:

**"Architecture Configuration System"**

Just as:

- `tsconfig.json` configures TypeScript
- `package.json` configures dependencies
- `.eslintrc` configures linting

architect-mcp uses:

- `architect.yaml` to configure architecture patterns
- `RULES.yaml` to configure coding standards
- `project.json` to link projects to templates

### Think of patterns as:

**"Architectural Zones"**

```
Your Codebase:
  src/
    services/     ← Service Layer Zone (DI, business logic)
    tools/        ← Tool Pattern Zone (MCP tools)
    cli/          ← CLI Zone (Commander.js)
    types/        ← Type Definition Zone
```

Each zone has:

- Expected patterns
- Coding rules
- Examples

### Think of templates as:

**"Architectural Blueprints"**

When you scaffold from a template, you get:

- Code structure (from boilerplate)
- Patterns (from architect.yaml)
- Rules (from RULES.yaml)
- Consistency (all projects from template match)

## Value Proposition

### For Individual Developers

**Before architect-mcp**:

```
Developer: "How should I structure this service?"
  → Search docs (if they exist)
  → Ask senior dev
  → Guess from existing code
  → Hope code review catches issues
```

**With architect-mcp**:

```
Developer: Opens file
  → Gets relevant patterns automatically
  → Sees code examples
  → Reviews code before commit
  → Fixes issues early
```

### For Teams

**Before**:

- Architecture knowledge in senior devs' heads
- Inconsistent patterns across codebase
- Code reviews focus on obvious issues
- New developers learn by osmosis

**With**:

- Architecture codified in version control
- Consistent patterns enforced by tools
- Automated first-pass review
- New developers guided by system

### For Organizations

**Before**:

- Each team invents own patterns
- Knowledge doesn't transfer between teams
- Architectural drift over time
- Hard to maintain standards at scale

**With**:

- Shared templates across organization
- Knowledge captured in templates
- Automated consistency checking
- Standards scale naturally

## Future Vision

### Short Term

- More LLM provider support (not just Claude Code CLI)
- Pattern suggestion based on file content
- Auto-generate rules from code examples

### Long Term

- **Living Architecture Documentation**: Patterns update as code evolves
- **Cross-Project Insights**: "This pattern works well across 10 projects"
- **Automated Migration**: "Template updated? Migrate all projects"
- **CI/CD Integration**: Block PRs that violate architectural rules
- **Architectural Metrics**: "80% of service files follow Service Layer Pattern"

## Summary

architect-mcp embodies these principles:

1. **Architecture as Code**: Patterns and rules live in configuration
2. **Context-Aware**: Right guidance at the right time
3. **Template-Based**: Reuse good architecture
4. **AI-Ready**: Structured data for AI agents
5. **Progressive**: Works without LLM, better with LLM
6. **Flexible**: Adapt to any architectural style

The goal: Make good architecture **easy to follow** and **hard to violate**.
