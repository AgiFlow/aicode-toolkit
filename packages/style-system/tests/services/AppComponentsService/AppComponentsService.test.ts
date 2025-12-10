/**
 * AppComponentsService Tests
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
vi.mock('node:fs', () => ({
  promises: {
    readFile: vi.fn(),
    access: vi.fn(),
  },
}));

vi.mock('glob', () => ({
  glob: vi.fn(),
}));

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

vi.mock('../../../src/services/StoriesIndexService', () => ({
  StoriesIndexService: vi.fn().mockImplementation(() => ({
    initialize: vi.fn(),
    getAllComponents: vi.fn().mockReturnValue([]),
  })),
}));

import { AppComponentsService } from '../../../src/services/AppComponentsService';
import type { ListAppComponentsInput } from '../../../src/services/AppComponentsService/types';

describe('AppComponentsService', () => {
  describe('input validation', () => {
    it('should throw error when appPath is empty', async () => {
      const service = new AppComponentsService();
      const input: ListAppComponentsInput = {
        appPath: '',
      };

      await expect(service.listComponents(input)).rejects.toThrow(
        'appPath is required and must be a non-empty string',
      );
    });

    it('should throw error when appPath is not a string', async () => {
      const service = new AppComponentsService();
      const input = {
        appPath: null,
      } as unknown as ListAppComponentsInput;

      await expect(service.listComponents(input)).rejects.toThrow(
        'appPath is required and must be a non-empty string',
      );
    });

    it('should throw error when appPath is undefined', async () => {
      const service = new AppComponentsService();
      const input = {
        appPath: undefined,
      } as unknown as ListAppComponentsInput;

      await expect(service.listComponents(input)).rejects.toThrow(
        'appPath is required and must be a non-empty string',
      );
    });

    it('should throw error when cursor is not a string', async () => {
      const service = new AppComponentsService();
      const input = {
        appPath: 'apps/test-app',
        cursor: 123,
      } as unknown as ListAppComponentsInput;

      await expect(service.listComponents(input)).rejects.toThrow('cursor must be a string');
    });
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      const service = new AppComponentsService();
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(AppComponentsService);
    });

    it('should create instance with custom config', () => {
      const service = new AppComponentsService({
        pageSize: 50,
      });
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(AppComponentsService);
    });
  });
});
