# Rules Overview

This document explains how the coding rules system works in architect-mcp, focusing on the **RULES.yaml** configuration and code review workflow.

## Purpose

While **architect.yaml** defines _what files should do_ (design patterns and architecture), **RULES.yaml** defines _how code should be written_ (coding standards and quality enforcement).

**Key distinction**:

- **Patterns** (architect.yaml): Architectural guidance - "What is this file's role?"
- **Rules** (RULES.yaml): Code quality standards - "Is this code well-written?"

## RULES.yaml Structure

### Basic Rule Definition

```yaml
version: '1.0'
template: typescript-mcp-package
rules:
  - pattern: src/services/**/*.ts
    description: Service implementation standards
    must_do:
      - rule: Use dependency injection
        codeExample: |
          // ✓ GOOD
          constructor(private repo: UserRepository) {}
    should_do:
      - rule: Add JSDoc comments for public methods
        codeExample: |
          // ✓ GOOD
          /** Fetches user by ID */
          async getUser(id: string) {}
    must_not_do:
      - rule: Never use static-only utility classes
        codeExample: |
          // ✗ BAD
          class Utils { static doStuff() {} }
```

### Rule Severity Levels

Rules are organized by severity to guide review focus:

1. **must_do**: Required patterns that code MUST follow
   - **Severity**: HIGH when violated
   - **Examples**: Error handling, type safety, dependency injection
   - **Review action**: Block or require fix

2. **should_do**: Best practices that code SHOULD follow
   - **Severity**: MEDIUM when missing
   - **Examples**: Documentation, consistent naming, performance optimizations
   - **Review action**: Suggest improvement

3. **must_not_do**: Anti-patterns that code MUST NOT contain
   - **Severity**: HIGH when violated
   - **Examples**: Default exports, hardcoded credentials, synchronous I/O
   - **Review action**: Block or require fix

### Rule Inheritance

Rules can inherit from other rules to avoid repetition and compose standards:

```yaml
# Global RULES.yaml
rules:
  - pattern: export-standards
    description: Standard export patterns
    must_do:
      - rule: Use named exports
        codeExample: |
          // ✓ GOOD
          export const myFunction = () => {};
          export class MyClass {}
    must_not_do:
      - rule: Never use default exports
        codeExample: |
          // ✗ BAD
          export default function() {}

  - pattern: error-handling
    description: Error handling standards
    must_do:
      - rule: Always use try-catch blocks
        codeExample: |
          // ✓ GOOD
          try {
            await riskyOperation();
          } catch (error) {
            logger.error(error);
          }
```

```yaml
# Template RULES.yaml
rules:
  - pattern: src/services/**/*.ts
    description: Service implementation standards
    inherits:
      - export-standards # Get all export rules
      - error-handling # Get all error handling rules
    must_do:
      - rule: Use dependency injection # Add service-specific rule
```

**Benefits of inheritance**:

- **DRY**: Don't repeat global rules in every template
- **Composition**: Build specific rules from general ones
- **Maintainability**: Update global rules once, apply everywhere
- **Layering**: Global → Template → Project specific rules

## How Code Review Works

### Rule Discovery Process

When reviewing a file, architect-mcp follows this process:

```
1. File Context Detection
   → Find project.json to identify project
   → Read sourceTemplate field

2. Load Rules
   → Load global RULES.yaml (workspace root)
   → Load template RULES.yaml (templates/{sourceTemplate}/)
   → Merge both rule sets

3. Pattern Matching
   → Match file path against rule patterns
   → Find all applicable rules

4. Resolve Inheritance
   → Follow "inherits" references
   → Recursively collect inherited rules
   → Build complete rule set

5. Apply Rules (Two Modes)
   → Mode A: Return rules for agent to review
   → Mode B: Use LLM to identify violations
```

### Example Review Flow

**File**: `packages/my-app/src/services/UserService.ts`

**Step 1: Find Rules**

```
Pattern match: src/services/**/*.ts
Found rule: Service implementation standards
```

**Step 2: Resolve Inheritance**

```
Base: export-standards (5 rules)
  ├─ Use named exports
  ├─ Export one main entity per file
  └─ ...

Base: error-handling (3 rules)
  ├─ Use try-catch blocks
  ├─ Log errors properly
  └─ ...

Specific: service rules (2 rules)
  ├─ Use dependency injection
  └─ Return typed results

Total: 10 applicable rules
```

**Step 3: Review (Two Modes)**

**Mode A: Agent Review (LLM disabled)**

```
architect-mcp returns:
  - All 10 rules with code examples
  - Severity levels

AI agent:
  - Reads the rules
  - Reviews code itself
  - Makes decisions
```

**Mode B: LLM Review (LLM enabled)**

```
architect-mcp:
  - Builds prompt with 10 rules + code
  - Asks LLM to identify violations
  - Parses structured response

Returns:
  - Specific violations found
  - Severity ratings
  - Actionable feedback
```

### Review Result Format

```typescript
{
  file_path: "packages/my-app/src/services/UserService.ts",
  project_name: "my-app",
  source_template: "typescript-mcp-package",
  review_feedback: "Found 2 violations",
  severity: "HIGH",
  issues_found: [
    {
      type: "must_not_do",
      rule: "Never use default exports",
      violation: "File uses default export on line 45"
    },
    {
      type: "must_do",
      rule: "Use try-catch blocks",
      violation: "Async function getUserById missing error handling"
    }
  ]
}
```

## Global vs Template Rules

### Global Rules

**Location**: `RULES.yaml` at workspace root

**Purpose**: Universal coding standards that apply to ALL projects

**Examples**:

- Export patterns (named exports, no defaults)
- Error handling standards
- TypeScript best practices
- Security patterns
- Performance guidelines

**When to use**:

- Organization-wide standards
- Language-specific best practices
- Cross-cutting concerns

### Template Rules

**Location**: `templates/{template-name}/RULES.yaml`

**Purpose**: Template-specific coding standards

**Examples**:

- MCP tool patterns (for typescript-mcp-package)
- Service layer patterns
- API endpoint standards
- Framework-specific patterns

**When to use**:

- Framework-specific standards
- Template architecture patterns
- Project type conventions

### Rule Resolution Order

```
1. Load global RULES.yaml
2. Load template RULES.yaml
3. For each matched rule:
   a. Collect direct rules (must_do, should_do, must_not_do)
   b. Resolve inherited patterns recursively
   c. Merge: Direct rules + Inherited rules
4. Return complete rule set
```

## Pattern Matching

Rules use glob patterns to match files:

```yaml
rules:
  # Match all TypeScript files in services
  - pattern: src/services/**/*.ts

  # Match specific file types
  - pattern: '**/*.test.ts'

  # Match MCP tools
  - pattern: src/tools/**/*Tool.ts

  # Match multiple patterns (inherit from this rule)
  - pattern: export-standards
```

**Special patterns** (for inheritance):

- Patterns without glob syntax (`export-standards`) are reference IDs
- Other rules can inherit from them using `inherits` field

## Code Examples in Rules

Each rule should include `codeExample` showing good vs bad patterns:

```yaml
must_do:
  - rule: Use dependency injection
    codeExample: |
      // ✓ GOOD - Dependencies injected via constructor
      export class UserService {
        constructor(private repo: UserRepository) {}
      }

      // ✗ BAD - Hard-coded dependency
      export class UserService {
        private repo = new UserRepository();
      }
```

**Benefits**:

- **Clarity**: Show exactly what's expected
- **Actionable**: Developers see how to fix
- **LLM-friendly**: AI can compare code against examples
- **Self-documenting**: Rules explain themselves

## Review Modes Compared

### Mode 1: Agent-Driven Review (Default)

**When**: `--review-tool` not set or not `claude-code`

**Process**:

```
architect-mcp → Returns all rules with examples
             ↓
AI Agent     → Reads rules
             → Reviews code itself
             → Identifies violations
             → Reports findings
```

**Pros**:

- No LLM API costs
- Fast (no external calls)
- Works offline
- Privacy (code stays local)

**Cons**:

- Agent does all the work
- May miss subtle issues
- Depends on agent's capability

### Mode 2: LLM-Enhanced Review

**When**: `--review-tool claude-code`

**Process**:

```
architect-mcp → Builds prompt with rules + code
             → Calls Claude Code CLI
             → Parses LLM response
             ↓
Returns      → Specific violations found
             → Severity per issue
             → Actionable feedback
```

**Pros**:

- Precise violation detection
- Context-aware analysis
- Detailed feedback
- Catches subtle issues

**Cons**:

- Requires LLM access
- API costs
- Slower (external call)
- Requires Claude Code CLI

## Best Practices

### Writing Good Rules

1. **Be Specific**: Vague rules are hard to enforce
   - ✓ "Use named exports for all public APIs"
   - ✗ "Follow good practices"

2. **Include Examples**: Show good and bad code
   - Always include `codeExample` field
   - Show both ✓ GOOD and ✗ BAD patterns

3. **Choose Right Severity**:
   - `must_do`: Critical patterns (security, correctness)
   - `should_do`: Optimization, documentation
   - `must_not_do`: Anti-patterns, known issues

4. **Use Inheritance**: Don't repeat common rules
   - Create reusable pattern references
   - Inherit in template-specific rules

5. **Match Scope to Pattern**: Use precise glob patterns
   - ✓ `src/services/**/*.ts` for service rules
   - ✗ `**/*.ts` for service rules (too broad)

### Organizing Rules

**Global RULES.yaml**:

```yaml
rules:
  # Define reusable patterns
  - pattern: export-standards
    description: ...

  - pattern: error-handling
    description: ...

  - pattern: type-safety
    description: ...
```

**Template RULES.yaml**:

```yaml
rules:
  # Inherit global + add specific
  - pattern: src/services/**/*.ts
    inherits:
      - export-standards
      - error-handling
    must_do:
      - rule: Use dependency injection

  - pattern: src/tools/**/*Tool.ts
    inherits:
      - export-standards
      - type-safety
    must_do:
      - rule: Implement Tool interface
```

## Integration with Design Patterns

Rules and patterns work together but serve different purposes:

| Aspect       | Design Patterns (architect.yaml)          | Coding Rules (RULES.yaml)          |
| ------------ | ----------------------------------------- | ---------------------------------- |
| **Question** | "What should this file do?"               | "How should this code be written?" |
| **Scope**    | Architecture, structure, responsibilities | Code quality, standards, style     |
| **Examples** | Service Layer Pattern, Repository Pattern | Named exports, error handling      |
| **When**     | During development (guidance)             | During review (validation)         |
| **Output**   | Design guidance, examples                 | Pass/fail with violations          |

**Workflow**:

1. Developer opens file → Gets design patterns (architect.yaml)
2. Developer writes code → Follows patterns
3. Developer reviews code → Checked against rules (RULES.yaml)
4. CI/CD validates → Automated rule enforcement

## Future Enhancements

### Short Term

- Rule templates for common patterns
- Auto-generate rules from code examples
- Visual rule editor

### Long Term

- **Rule Analytics**: "95% compliance with error-handling rules"
- **Auto-fix Suggestions**: Propose code changes to fix violations
- **Rule Evolution**: Track how rules change over time
- **CI/CD Integration**: Block PRs with HIGH severity violations
- **Custom Severity Levels**: Team-specific severity definitions

## Summary

The rules system in architect-mcp:

1. **Separates Concerns**: Architecture (patterns) vs Quality (rules)
2. **Three Severity Levels**: must_do, should_do, must_not_do
3. **Inheritance**: Compose rules from global and template-specific standards
4. **Two Review Modes**: Agent-driven (fast, private) or LLM-enhanced (precise)
5. **Pattern Matching**: Glob patterns define rule scope
6. **Code Examples**: Every rule includes good/bad examples
7. **Flexible**: Works without LLM, enhanced with LLM

The goal: Make code quality standards **explicit, enforceable, and easy to follow**.
