/**
 * SkillService Tests
 *
 * TESTING PATTERNS:
 * - Unit tests with temporary directories for file system operations
 * - Test each method independently
 * - Cover success cases, edge cases, and error handling
 *
 * CODING STANDARDS:
 * - Use descriptive test names (should...)
 * - Arrange-Act-Assert pattern
 * - Use temporary directories for file system tests
 * - Test behavior, not implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SkillService } from '../../src/services/SkillService';

describe('SkillService', () => {
  let tempDir: string;
  let skillsDir: string;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    tempDir = join(
      tmpdir(),
      `skill-service-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    skillsDir = join(tempDir, 'skills');
    await mkdir(skillsDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temp directory
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('cache behavior', () => {
    it('should cache skills after first load', async () => {
      // Arrange: Create a skill file
      const skillDir = join(skillsDir, 'test-skill');
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        join(skillDir, 'SKILL.md'),
        `---
name: test-skill
description: A test skill
---
Test content`,
      );

      const service = new SkillService(tempDir, ['skills']);

      // Act: Load skills twice
      const firstLoad = await service.getSkills();
      const secondLoad = await service.getSkills();

      // Assert: Both should return same cached result
      expect(firstLoad).toHaveLength(1);
      expect(secondLoad).toBe(firstLoad); // Same reference (cached)
    });

    it('should clear cache when clearCache is called', async () => {
      // Arrange: Create a skill file
      const skillDir = join(skillsDir, 'test-skill');
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        join(skillDir, 'SKILL.md'),
        `---
name: test-skill
description: A test skill
---
Test content`,
      );

      const service = new SkillService(tempDir, ['skills']);

      // Act: Load skills, clear cache, load again
      const firstLoad = await service.getSkills();
      service.clearCache();
      const secondLoad = await service.getSkills();

      // Assert: Different references after cache clear
      expect(firstLoad).toHaveLength(1);
      expect(secondLoad).toHaveLength(1);
      expect(secondLoad).not.toBe(firstLoad); // Different reference (reloaded)
    });

    it('should call onCacheInvalidated callback when cache is cleared by file watcher', async () => {
      // Arrange
      const onCacheInvalidated = vi.fn();
      const skillDir = join(skillsDir, 'test-skill');
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        join(skillDir, 'SKILL.md'),
        `---
name: test-skill
description: A test skill
---
Test content`,
      );

      const service = new SkillService(tempDir, ['skills'], { onCacheInvalidated });

      // Pre-populate the cache
      await service.getSkills();

      // Act: Start watching and modify a SKILL.md file
      await service.startWatching();

      // Give the watcher time to initialize
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Modify the skill file to trigger the watcher
      await appendFile(join(skillDir, 'SKILL.md'), '\nModified content');

      // Wait for the file system event to be processed
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Stop watching
      service.stopWatching();

      // Assert: Callback should have been called
      expect(onCacheInvalidated).toHaveBeenCalled();
    });

    it('should not call onCacheInvalidated for non-SKILL.md files', async () => {
      // Arrange
      const onCacheInvalidated = vi.fn();
      const service = new SkillService(tempDir, ['skills'], { onCacheInvalidated });

      // Act: Start watching and create a non-SKILL.md file
      await service.startWatching();

      // Give the watcher time to initialize
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Create a non-skill file
      await writeFile(join(skillsDir, 'README.md'), 'Not a skill file');

      // Wait for the file system event to be processed
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Stop watching
      service.stopWatching();

      // Assert: Callback should not have been called
      expect(onCacheInvalidated).not.toHaveBeenCalled();
    });
  });

  describe('startWatching and stopWatching', () => {
    it('should start and stop without errors', async () => {
      // Arrange
      const service = new SkillService(tempDir, ['skills']);

      // Act & Assert: Should not throw
      await expect(service.startWatching()).resolves.not.toThrow();
      service.stopWatching();
    });

    it('should handle non-existent directories gracefully', async () => {
      // Arrange: Use a non-existent path
      const service = new SkillService(tempDir, ['non-existent-skills']);

      // Act & Assert: Should not throw
      await expect(service.startWatching()).resolves.not.toThrow();
      service.stopWatching();
    });

    it('should stop existing watchers when startWatching is called again', async () => {
      // Arrange
      const service = new SkillService(tempDir, ['skills']);

      // Act: Start watching twice
      await service.startWatching();
      await service.startWatching(); // Should stop first watcher

      // Assert: Should not throw and cleanup should work
      service.stopWatching();
    });
  });

  describe('getSkill', () => {
    it('should return skill by name after cache is populated', async () => {
      // Arrange: Create a skill file
      const skillDir = join(skillsDir, 'my-skill');
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        join(skillDir, 'SKILL.md'),
        `---
name: my-skill
description: My test skill
---
Skill content`,
      );

      const service = new SkillService(tempDir, ['skills']);

      // Act
      const skill = await service.getSkill('my-skill');

      // Assert
      expect(skill).toBeDefined();
      expect(skill?.name).toBe('my-skill');
      expect(skill?.description).toBe('My test skill');
    });

    it('should return undefined for non-existent skill', async () => {
      // Arrange
      const service = new SkillService(tempDir, ['skills']);

      // Act
      const skill = await service.getSkill('non-existent');

      // Assert
      expect(skill).toBeUndefined();
    });
  });
});
