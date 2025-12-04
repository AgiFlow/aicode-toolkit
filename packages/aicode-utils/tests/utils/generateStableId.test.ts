/**
 * Tests for generateStableId utility
 */

import { describe, it, expect } from 'vitest';
import Chance from 'chance';
import { generateStableId } from '../../src/utils/generateStableId';

/** Seeded random generator for reproducible tests */
const chance = new Chance(12345);

/** Valid character set used by generateStableId */
const VALID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Default ID length */
const DEFAULT_LENGTH = 8;

/**
 * Fixed iteration count for statistical distribution tests.
 * Using a constant ensures reproducible statistical analysis.
 */
const DISTRIBUTION_TEST_ITERATIONS = 1000;

/** Character frequency count map for distribution testing */
interface CharacterCountMap {
  [char: string]: number;
}

describe('generateStableId', () => {
  describe('default behavior', () => {
    it('should generate ID with default length of 8', () => {
      const id = generateStableId();

      expect(id).toHaveLength(DEFAULT_LENGTH);
    });

    it('should generate lowercase alphanumeric characters only', () => {
      const id = generateStableId();

      expect(id).toMatch(/^[a-z0-9]+$/);
    });

    it('should generate different IDs on multiple calls', () => {
      const ids = new Set<string>();
      const iterations = chance.integer({ min: 50, max: 100 });

      for (let i = 0; i < iterations; i++) {
        ids.add(generateStableId());
      }

      // Should have at least 95% unique IDs (allowing for very rare collisions)
      expect(ids.size).toBeGreaterThanOrEqual(Math.floor(iterations * 0.95));
    });
  });

  describe('custom length', () => {
    it('should generate ID with specified short length', () => {
      const length = chance.integer({ min: 1, max: 5 });
      const id = generateStableId(length);

      expect(id).toHaveLength(length);
    });

    it('should generate ID with specified medium length', () => {
      const length = chance.integer({ min: 10, max: 20 });
      const id = generateStableId(length);

      expect(id).toHaveLength(length);
    });

    it('should generate ID with length of 1', () => {
      const id = generateStableId(1);

      expect(id).toHaveLength(1);
      expect(id).toMatch(/^[a-z0-9]$/);
    });

    it('should generate empty string with length of 0', () => {
      const id = generateStableId(0);

      expect(id).toBe('');
    });
  });

  describe('character distribution', () => {
    it('should use only characters from the valid character set', () => {
      const iterations = chance.integer({ min: 50, max: 100 });
      const length = chance.integer({ min: 16, max: 32 });

      for (let i = 0; i < iterations; i++) {
        const id = generateStableId(length);

        for (const char of id) {
          expect(VALID_CHARS).toContain(char);
        }
      }
    });

    it('should produce reasonable character distribution over many IDs', () => {
      const charCounts: CharacterCountMap = {};
      const iterations = DISTRIBUTION_TEST_ITERATIONS;
      const idLength = VALID_CHARS.length; // Use length equal to charset size

      for (let i = 0; i < iterations; i++) {
        const id = generateStableId(idLength);

        for (const char of id) {
          charCounts[char] = (charCounts[char] || 0) + 1;
        }
      }

      const totalChars = iterations * idLength;
      const expectedPerChar = totalChars / VALID_CHARS.length;

      for (const char of VALID_CHARS) {
        // Allow for some variance - each char should appear at least 50% of expected
        expect(charCounts[char] || 0).toBeGreaterThan(expectedPerChar * 0.5);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle large length values', () => {
      const largeLength = chance.integer({ min: 500, max: 1000 });
      const id = generateStableId(largeLength);

      expect(id).toHaveLength(largeLength);
      expect(id).toMatch(/^[a-z0-9]+$/);
    });

    it('should not throw error for negative length', () => {
      expect(() => generateStableId(-1)).not.toThrow();
      const id = generateStableId(-1);

      // Function returns empty string for negative length (graceful handling)
      expect(id).toBe('');
    });

    it('should not throw error for non-integer length input', () => {
      expect(() => generateStableId(5.7)).not.toThrow();
      const id = generateStableId(5.7);

      // Should truncate to integer behavior
      expect(id.length).toBeLessThanOrEqual(6);
      expect(id).toMatch(/^[a-z0-9]*$/);
    });
  });
});
