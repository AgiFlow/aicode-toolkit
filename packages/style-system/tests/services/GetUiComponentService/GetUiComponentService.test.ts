/**
 * GetUiComponentService Tests
 *
 * TESTING PATTERNS:
 * - Unit tests with mocked dependencies
 * - Test input validation independently
 * - Cover success cases, edge cases, and error handling
 *
 * CODING STANDARDS:
 * - Use descriptive test names (should...)
 * - Arrange-Act-Assert pattern
 * - Mock external dependencies
 * - Test behavior, not implementation
 */

import { describe, expect, it, vi } from 'vitest';

// Mock dependencies before importing the service
vi.mock('@agiflowai/aicode-utils', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  TemplatesManagerService: {
    getWorkspaceRootSync: vi.fn((): string => '/mock/workspace'),
  },
}));

vi.mock('../../../src/config', () => ({
  getAppDesignSystemConfig: vi.fn(),
}));

import { GetUiComponentService } from '../../../src/services/GetUiComponentService';
import type { GetUiComponentInput } from '../../../src/services/GetUiComponentService/types';

describe('GetUiComponentService', () => {
  describe('input validation', () => {
    it('should throw error when componentName is empty', async () => {
      const service = new GetUiComponentService();
      const input: GetUiComponentInput = {
        componentName: '',
        appPath: 'apps/test-app',
      };

      await expect(service.getComponent(input)).rejects.toThrow(
        'componentName is required and must be a non-empty string',
      );
    });

    it('should throw error when componentName is not a string', async () => {
      const service = new GetUiComponentService();
      const input = {
        componentName: 123,
        appPath: 'apps/test-app',
      } as unknown as GetUiComponentInput;

      await expect(service.getComponent(input)).rejects.toThrow(
        'componentName is required and must be a non-empty string',
      );
    });

    it('should throw error when appPath is empty', async () => {
      const service = new GetUiComponentService();
      const input: GetUiComponentInput = {
        componentName: 'Button',
        appPath: '',
      };

      await expect(service.getComponent(input)).rejects.toThrow(
        'appPath is required and must be a non-empty string',
      );
    });

    it('should throw error when appPath is not a string', async () => {
      const service = new GetUiComponentService();
      const input = {
        componentName: 'Button',
        appPath: null,
      } as unknown as GetUiComponentInput;

      await expect(service.getComponent(input)).rejects.toThrow(
        'appPath is required and must be a non-empty string',
      );
    });

    it('should throw error when storyName is not a string', async () => {
      const service = new GetUiComponentService();
      const input = {
        componentName: 'Button',
        appPath: 'apps/test-app',
        storyName: 123,
      } as unknown as GetUiComponentInput;

      await expect(service.getComponent(input)).rejects.toThrow('storyName must be a string');
    });

    it('should throw error when darkMode is not a boolean', async () => {
      const service = new GetUiComponentService();
      const input = {
        componentName: 'Button',
        appPath: 'apps/test-app',
        darkMode: 'true',
      } as unknown as GetUiComponentInput;

      await expect(service.getComponent(input)).rejects.toThrow('darkMode must be a boolean');
    });
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      const service = new GetUiComponentService();
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(GetUiComponentService);
    });

    it('should create instance with custom config', () => {
      const service = new GetUiComponentService({
        defaultStoryName: 'CustomStory',
        defaultDarkMode: true,
        defaultWidth: 1920,
        defaultHeight: 1080,
      });
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(GetUiComponentService);
    });
  });
});
