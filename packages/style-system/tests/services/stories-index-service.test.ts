/**
 * StoriesIndexService Tests
 *
 * TESTING PATTERNS:
 * - Unit tests with mocked dependencies
 * - Test each method independently
 * - Cover success cases, edge cases, and error handling
 *
 * CODING STANDARDS:
 * - Use descriptive test names (should...)
 * - Arrange-Act-Assert pattern
 * - Mock external dependencies
 * - Test behavior, not implementation
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { StoriesIndexService } from '../../src/services/StoriesIndexService';

describe('StoriesIndexService', () => {
  let service: StoriesIndexService;

  beforeEach(() => {
    service = new StoriesIndexService();
  });

  describe('getAllComponents', () => {
    it('should return empty array when no components indexed', () => {
      const result = service.getAllComponents();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
  });

  describe('getComponentByTitle', () => {
    it('should return undefined for non-existent component', () => {
      const result = service.getComponentByTitle('NonExistent/Component');

      expect(result).toBeUndefined();
    });

    it('should return undefined for empty title', () => {
      const result = service.getComponentByTitle('');

      expect(result).toBeUndefined();
    });
  });

  describe('findComponentByName', () => {
    it('should return undefined when no components match', () => {
      const result = service.findComponentByName('Button');

      expect(result).toBeUndefined();
    });

    it('should handle empty search string', () => {
      const result = service.findComponentByName('');

      expect(result).toBeUndefined();
    });

    it('should handle special characters in search', () => {
      const result = service.findComponentByName('Button@#$%');

      expect(result).toBeUndefined();
    });
  });

  describe('getComponentsByTags', () => {
    it('should return empty array when no components have matching tags', () => {
      const result = service.getComponentsByTags(['nonexistent-tag']);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it('should return all components when no tags filter provided', () => {
      const result = service.getComponentsByTags();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return all components when empty tags array provided', () => {
      const result = service.getComponentsByTags([]);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('clear', () => {
    it('should clear the component index', () => {
      service.clear();
      const result = service.getAllComponents();

      expect(result).toHaveLength(0);
    });
  });
});
