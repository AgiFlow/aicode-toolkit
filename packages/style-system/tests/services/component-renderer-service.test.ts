/**
 * ComponentRendererService Tests
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
import { ComponentRendererService } from '../../src/services/ComponentRendererService';
import type { DesignSystemConfig } from '../../src/config';

describe('ComponentRendererService', () => {
  const mockConfig: DesignSystemConfig = {
    type: 'shadcn',
    themeProvider: './src/components/theme-provider',
    cssFiles: ['./src/styles/globals.css'],
    rootComponent: undefined,
  };

  describe('constructor', () => {
    it('should throw error when appPath is undefined', () => {
      expect(() => {
        new ComponentRendererService(mockConfig, undefined as unknown as string);
      }).toThrow();
    });

    it('should create instance with valid config and appPath', () => {
      const service = new ComponentRendererService(mockConfig, '/test/app/path');

      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(ComponentRendererService);
    });
  });

  describe('cleanup', () => {
    it('should handle cleanup when tmp directory does not exist', async () => {
      const service = new ComponentRendererService(mockConfig, '/nonexistent/path');

      await expect(service.cleanup()).resolves.not.toThrow();
    });

    it('should accept custom olderThanMs parameter', async () => {
      const service = new ComponentRendererService(mockConfig, '/test/path');

      await expect(service.cleanup(1000)).resolves.not.toThrow();
    });
  });

  describe('dispose', () => {
    it('should dispose without error', async () => {
      const service = new ComponentRendererService(mockConfig, '/test/path');

      await expect(service.dispose()).resolves.not.toThrow();
    });
  });
});
