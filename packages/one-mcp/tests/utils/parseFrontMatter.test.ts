import { describe, expect, it } from 'vitest';
import {
  parseFrontMatter,
  isValidSkillFrontMatter,
  extractSkillFrontMatter,
} from '../../src/utils/parseFrontMatter';

describe('parseFrontMatter', () => {
  describe('parseFrontMatter', () => {
    it('should parse valid front matter', () => {
      const content = `---
name: my-skill
description: A test skill
---
The actual content here`;

      const result = parseFrontMatter(content);

      expect(result.frontMatter).toEqual({
        name: 'my-skill',
        description: 'A test skill',
      });
      expect(result.content).toBe('The actual content here');
    });

    it('should return null frontMatter when no front matter present', () => {
      const content = 'Just some regular content without front matter';

      const result = parseFrontMatter(content);

      expect(result.frontMatter).toBeNull();
      expect(result.content).toBe(content);
    });

    it('should return null frontMatter when front matter is not closed', () => {
      const content = `---
name: my-skill
description: A test skill
No closing delimiter`;

      const result = parseFrontMatter(content);

      expect(result.frontMatter).toBeNull();
      expect(result.content).toBe(content);
    });

    it('should handle front matter with quoted values', () => {
      const content = `---
name: "my-skill"
description: 'A description with spaces'
---
Content`;

      const result = parseFrontMatter(content);

      expect(result.frontMatter).toEqual({
        name: 'my-skill',
        description: 'A description with spaces',
      });
    });

    it('should handle leading whitespace before front matter', () => {
      const content = `
---
name: my-skill
---
Content`;

      const result = parseFrontMatter(content);

      expect(result.frontMatter).toEqual({
        name: 'my-skill',
      });
      expect(result.content).toBe('Content');
    });

    it('should handle empty front matter block', () => {
      const content = `---
---
Content`;

      const result = parseFrontMatter(content);

      expect(result.frontMatter).toBeNull();
      expect(result.content).toBe(content);
    });

    it('should handle multi-line content after front matter', () => {
      const content = `---
name: test
---
Line 1
Line 2
Line 3`;

      const result = parseFrontMatter(content);

      expect(result.frontMatter).toEqual({ name: 'test' });
      expect(result.content).toBe('Line 1\nLine 2\nLine 3');
    });

    it('should parse literal block scalar (|) preserving newlines', () => {
      const content = `---
name: my-skill
description: |
  Line 1
  Line 2
  Line 3
---
Content`;

      const result = parseFrontMatter(content);

      expect(result.frontMatter).toEqual({
        name: 'my-skill',
        description: 'Line 1\nLine 2\nLine 3',
      });
      expect(result.content).toBe('Content');
    });

    it('should parse folded block scalar (>) joining lines with spaces', () => {
      const content = `---
name: my-skill
description: >
  This is a long
  description that
  spans multiple lines
---
Content`;

      const result = parseFrontMatter(content);

      expect(result.frontMatter).toEqual({
        name: 'my-skill',
        description: 'This is a long description that spans multiple lines',
      });
      expect(result.content).toBe('Content');
    });

    it('should handle |- variant (literal block without trailing newline)', () => {
      const content = `---
name: test
description: |-
  No trailing
  newline
---
Content`;

      const result = parseFrontMatter(content);

      expect(result.frontMatter?.description).toBe('No trailing\nnewline');
    });

    it('should handle >- variant (folded block without trailing newline)', () => {
      const content = `---
name: test
description: >-
  Folded without
  trailing newline
---
Content`;

      const result = parseFrontMatter(content);

      expect(result.frontMatter?.description).toBe('Folded without trailing newline');
    });

    it('should handle multiple multi-line fields', () => {
      const content = `---
name: complex-skill
description: |
  A multi-line
  description
other: simple value
---
Content`;

      const result = parseFrontMatter(content);

      expect(result.frontMatter).toEqual({
        name: 'complex-skill',
        description: 'A multi-line\ndescription',
        other: 'simple value',
      });
    });

    it('should preserve indentation in literal blocks', () => {
      const content = `---
name: test
description: |
  Normal line
    Indented line
  Normal again
---
Content`;

      const result = parseFrontMatter(content);

      expect(result.frontMatter?.description).toBe('Normal line\n  Indented line\nNormal again');
    });

    it('should terminate block when line has less indentation than base', () => {
      // Per YAML spec, a non-empty line with less indentation terminates the block
      const content = `---
name: test
description: |
  Line 1
  Line 2
 Less indented line
---
Content`;

      const result = parseFrontMatter(content);

      // The block should terminate at "Less indented line" (only 1 space vs base of 2)
      // The dedented line is discarded (not a valid key:value format)
      expect(result.frontMatter?.description).toBe('Line 1\nLine 2');
      expect(result.frontMatter?.name).toBe('test');
      // Verify the dedented line didn't create a spurious key
      expect(Object.keys(result.frontMatter || {})).toEqual(['name', 'description']);
      expect(result.content).toBe('Content');
    });

    it('should handle block scalar with no content lines', () => {
      // Edge case: block indicator followed immediately by closing delimiter
      const content = `---
name: test
description: |
---
Content`;

      const result = parseFrontMatter(content);

      // Empty block scalar should result in empty string or be omitted
      expect(result.frontMatter?.name).toBe('test');
      // description key exists but value is empty (no content lines)
      expect(result.frontMatter?.description).toBeUndefined();
    });

    it('should preserve empty lines within multi-line blocks', () => {
      const content = `---
name: test
description: |
  Line 1

  Line 3
---
Content`;

      const result = parseFrontMatter(content);

      expect(result.frontMatter?.description).toBe('Line 1\n\nLine 3');
    });
  });

  describe('isValidSkillFrontMatter', () => {
    it('should return true for valid skill front matter', () => {
      const frontMatter = {
        name: 'my-skill',
        description: 'A valid skill',
      };

      expect(isValidSkillFrontMatter(frontMatter)).toBe(true);
    });

    it('should return false for null front matter', () => {
      expect(isValidSkillFrontMatter(null)).toBe(false);
    });

    it('should return false when name is missing', () => {
      const frontMatter = {
        description: 'A description',
      };

      expect(isValidSkillFrontMatter(frontMatter)).toBe(false);
    });

    it('should return false when description is missing', () => {
      const frontMatter = {
        name: 'my-skill',
      };

      expect(isValidSkillFrontMatter(frontMatter)).toBe(false);
    });

    it('should return false when name is empty', () => {
      const frontMatter = {
        name: '',
        description: 'A description',
      };

      expect(isValidSkillFrontMatter(frontMatter)).toBe(false);
    });

    it('should return false when description is empty', () => {
      const frontMatter = {
        name: 'my-skill',
        description: '',
      };

      expect(isValidSkillFrontMatter(frontMatter)).toBe(false);
    });
  });

  describe('extractSkillFrontMatter', () => {
    it('should extract skill from valid front matter', () => {
      const content = `---
name: scaffold-feature
description: Add a new feature to an existing project
---
You are helping add a new feature...`;

      const result = extractSkillFrontMatter(content);

      expect(result).not.toBeNull();
      expect(result?.skill).toEqual({
        name: 'scaffold-feature',
        description: 'Add a new feature to an existing project',
      });
      expect(result?.content).toBe('You are helping add a new feature...');
    });

    it('should return null when no front matter', () => {
      const content = 'Just regular content';

      const result = extractSkillFrontMatter(content);

      expect(result).toBeNull();
    });

    it('should return null when front matter is missing required fields', () => {
      const content = `---
name: my-skill
---
Content without description field`;

      const result = extractSkillFrontMatter(content);

      expect(result).toBeNull();
    });

    it('should handle real-world skill front matter', () => {
      const content = `---
name: scaffold-feature
description: Add a new feature to an existing project such as service, route, page, component, or API endpoint. Use this skill when the user wants to add functionality to an existing codebase using predefined scaffolding templates.
---

You are helping add a new feature to an existing project.

## Workflow

1. First list available scaffolding methods
2. Then use the scaffold method`;

      const result = extractSkillFrontMatter(content);

      expect(result).not.toBeNull();
      expect(result?.skill.name).toBe('scaffold-feature');
      expect(result?.skill.description).toContain('Add a new feature');
      expect(result?.content).toContain('You are helping');
      expect(result?.content).toContain('## Workflow');
    });
  });
});
