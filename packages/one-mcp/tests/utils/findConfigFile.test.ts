import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { findConfigFile } from '../../src/utils/findConfigFile';

// Mock fs module
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

describe('findConfigFile', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset mocks and environment
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore environment
    process.env = originalEnv;
  });

  it('should find config in PROJECT_PATH if set and file exists', () => {
    process.env.PROJECT_PATH = '/test/project';
    const mockExistsSync = existsSync as any;

    // Mock that config exists in PROJECT_PATH
    mockExistsSync.mockImplementation((path: string) => {
      return path === '/test/project/mcp-config.yaml';
    });

    const result = findConfigFile();

    expect(result).toBe('/test/project/mcp-config.yaml');
    expect(mockExistsSync).toHaveBeenCalledWith('/test/project/mcp-config.yaml');
  });

  it('should check yml extension if yaml not found in PROJECT_PATH', () => {
    process.env.PROJECT_PATH = '/test/project';
    const mockExistsSync = existsSync as any;

    // Mock that only .yml exists in PROJECT_PATH
    mockExistsSync.mockImplementation((path: string) => {
      return path === '/test/project/mcp-config.yml';
    });

    const result = findConfigFile();

    expect(result).toBe('/test/project/mcp-config.yml');
  });

  it('should check json if yaml and yml not found in PROJECT_PATH', () => {
    process.env.PROJECT_PATH = '/test/project';
    const mockExistsSync = existsSync as any;

    // Mock that only .json exists in PROJECT_PATH
    mockExistsSync.mockImplementation((path: string) => {
      return path === '/test/project/mcp-config.json';
    });

    const result = findConfigFile();

    expect(result).toBe('/test/project/mcp-config.json');
  });

  it('should fall back to cwd if PROJECT_PATH is not set', () => {
    delete process.env.PROJECT_PATH;
    const mockExistsSync = existsSync as any;
    const cwd = process.cwd();

    // Mock that config exists in cwd
    mockExistsSync.mockImplementation((path: string) => {
      return path === `${cwd}/mcp-config.yaml`;
    });

    const result = findConfigFile();

    expect(result).toBe(`${cwd}/mcp-config.yaml`);
  });

  it('should fall back to cwd if no config found in PROJECT_PATH', () => {
    process.env.PROJECT_PATH = '/test/project';
    const mockExistsSync = existsSync as any;
    const cwd = process.cwd();

    // Mock that config doesn't exist in PROJECT_PATH but exists in cwd
    mockExistsSync.mockImplementation((path: string) => {
      return path === `${cwd}/mcp-config.json`;
    });

    const result = findConfigFile();

    expect(result).toBe(`${cwd}/mcp-config.json`);
  });

  it('should return null if no config file found anywhere', () => {
    process.env.PROJECT_PATH = '/test/project';
    const mockExistsSync = existsSync as any;

    // Mock that no config exists anywhere
    mockExistsSync.mockReturnValue(false);

    const result = findConfigFile();

    expect(result).toBeNull();
  });

  it('should prioritize PROJECT_PATH over cwd when both have config', () => {
    process.env.PROJECT_PATH = '/test/project';
    const mockExistsSync = existsSync as any;

    // Mock that config exists in both locations
    mockExistsSync.mockImplementation((path: string) => {
      return path === '/test/project/mcp-config.yaml' || path.includes(process.cwd());
    });

    const result = findConfigFile();

    // Should return PROJECT_PATH version first
    expect(result).toBe('/test/project/mcp-config.yaml');
  });
});
