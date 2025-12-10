/**
 * CSSClassesServiceFactory Tests
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

import { describe, expect, it } from 'vitest';
import { BaseCSSClassesService } from '../../../src/services/CssClasses/BaseCSSClassesService';
import { CSSClassesServiceFactory } from '../../../src/services/CssClasses/CSSClassesServiceFactory';
import { TailwindCSSClassesService } from '../../../src/services/CssClasses/TailwindCSSClassesService';

describe('CSSClassesServiceFactory', () => {
  describe('createService', () => {
    it('should create TailwindCSSClassesService by default', async () => {
      const factory = new CSSClassesServiceFactory();

      const service = await factory.createService();

      expect(service).toBeInstanceOf(TailwindCSSClassesService);
      expect(service).toBeInstanceOf(BaseCSSClassesService);
    });

    it('should create TailwindCSSClassesService when cssFramework is tailwind', async () => {
      const factory = new CSSClassesServiceFactory();

      const service = await factory.createService({ cssFramework: 'tailwind' });

      expect(service).toBeInstanceOf(TailwindCSSClassesService);
      expect(service.getFrameworkId()).toBe('tailwind');
    });

    it('should throw error for unsupported CSS framework', async () => {
      const factory = new CSSClassesServiceFactory();

      await expect(factory.createService({ cssFramework: 'bootstrap' })).rejects.toThrow(
        /Unsupported CSS framework: bootstrap/,
      );
    });

    it('should include helpful message about supported frameworks in error', async () => {
      const factory = new CSSClassesServiceFactory();

      await expect(factory.createService({ cssFramework: 'unknown' })).rejects.toThrow(
        /Supported frameworks: tailwind/,
      );
    });

    it('should suggest using customServicePath for unsupported frameworks', async () => {
      const factory = new CSSClassesServiceFactory();

      await expect(factory.createService({ cssFramework: 'custom' })).rejects.toThrow(
        /Use customServicePath to provide a custom implementation/,
      );
    });

    it('should use tailwind as default framework when only themePath is provided', async () => {
      const factory = new CSSClassesServiceFactory();

      const service = await factory.createService({
        themePath: '/custom/theme.css',
      });

      // Should create tailwind service (default framework) regardless of themePath
      expect(service).toBeInstanceOf(TailwindCSSClassesService);
      expect(service.getFrameworkId()).toBe('tailwind');
    });

    it('should throw error when custom service module cannot be loaded', async () => {
      const factory = new CSSClassesServiceFactory();

      // Test the public API behavior - providing a non-existent path should fail
      // Use a relative path within workspace to pass security validation
      await expect(
        factory.createService({
          customServicePath: './nonexistent/custom-service.ts',
        }),
      ).rejects.toThrow(/Failed to load custom CSS classes service/);
    });

    it('should throw security error when custom service path resolves outside workspace', async () => {
      const factory = new CSSClassesServiceFactory();

      // Test security validation - absolute paths outside workspace should be rejected
      await expect(
        factory.createService({
          customServicePath: '/nonexistent/custom-service.ts',
        }),
      ).rejects.toThrow(/Security error.*resolves outside workspace root/);
    });

    it('should throw error for invalid file extension', async () => {
      const factory = new CSSClassesServiceFactory();

      // Test file extension validation
      await expect(
        factory.createService({
          customServicePath: './custom-service.txt',
        }),
      ).rejects.toThrow(/Invalid file extension/);
    });

    it('should throw error when custom service path is invalid module', async () => {
      const factory = new CSSClassesServiceFactory();

      // Test with a path that doesn't resolve to a valid module
      await expect(
        factory.createService({
          customServicePath: './invalid-module-path.js',
        }),
      ).rejects.toThrow(/Failed to load custom CSS classes service/);
    });
  });
});
