/**
 * TemplatesManagerService Tests
 *
 * TESTING PATTERNS:
 * - Unit tests for each public method
 * - Test success cases, error cases, and edge cases
 * - Mock external dependencies
 * - Use descriptive test names that explain what is being tested
 *
 * CODING STANDARDS:
 * - Use Vitest testing framework
 * - Group related tests with describe blocks
 * - Use beforeEach for test setup
 * - Clear test names: 'should [expected behavior] when [condition]'
 * - Test both happy paths and error scenarios
 *
 * AVOID:
 * - Testing implementation details (test behavior, not internals)
 * - Shared state between tests (use beforeEach for clean setup)
 * - Overly complex test setup (keep tests simple and focused)
 */

import path from 'node:path';
import * as fs from 'node:fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import Chance from 'chance';
import type { ToolkitConfig } from '../../src/types';
import { TemplatesManagerService } from '../../src/services/TemplatesManagerService';
import * as fsHelpers from '../../src/utils/fsHelpers';

// ---------------------------------------------------------------------------
// Hoist mocks so they are available before vi.mock() factories run
// ---------------------------------------------------------------------------

const mockReadFileSync = vi.hoisted((): Mock => vi.fn());

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../src/utils/fsHelpers', (): { pathExists: Mock; pathExistsSync: Mock } => ({
  pathExists: vi.fn(),
  pathExistsSync: vi.fn(),
}));

vi.mock('node:fs/promises', (): { stat: Mock; readFile: Mock; mkdir: Mock; writeFile: Mock } => ({
  stat: vi.fn(),
  readFile: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock('node:fs', (): { readFileSync: Mock } => ({
  readFileSync: mockReadFileSync,
}));

// ---------------------------------------------------------------------------
// Seeded random generator — deterministic across runs
// ---------------------------------------------------------------------------

const chance = new Chance(42);

// ---------------------------------------------------------------------------
// Generated test data — avoids hardcoded strings while remaining reproducible
// ---------------------------------------------------------------------------

const MOCK_WORKSPACE = `/mock/${chance.word()}`;
const MOCK_STAT_TARGET = `/mock/${chance.word()}/target`;

// Derived path constants computed from the workspace root
const MOCK_GIT_PATH = path.join(MOCK_WORKSPACE, '.git');
const MOCK_TEMPLATES_PATH = path.join(MOCK_WORKSPACE, 'templates');
const MOCK_SETTINGS_PATH = path.join(MOCK_WORKSPACE, '.toolkit', 'settings.yaml');
const MOCK_SETTINGS_LOCAL_PATH = path.join(MOCK_WORKSPACE, '.toolkit', 'settings.local.yaml');
const MOCK_LEGACY_CONFIG_PATH = path.join(MOCK_WORKSPACE, 'toolkit.yaml');

// Generated values used inside YAML fixtures and test assertions
const BASE_FALLBACK_TOOL = chance.word();
const BASE_MODEL = chance.word();
const LOCAL_FALLBACK_TOOL = chance.word();
const LOCAL_MODEL = chance.word();
const LOCAL_VERSION = chance.word();
const BASE_AGENT_TOOL = chance.word();
const LOCAL_AGENT_TOOL = chance.word();

// ---------------------------------------------------------------------------
// YAML fixtures — values are generated above so assertions stay in sync
// ---------------------------------------------------------------------------

const BASE_YAML = `
scaffold-mcp:
  mcp-serve:
    fallbackTool: ${BASE_FALLBACK_TOOL}
    fallbackToolConfig:
      model: ${BASE_MODEL}
  hook:
    claude-code:
      preToolUse:
        llm-tool: ${BASE_AGENT_TOOL}
      postToolUse:
        llm-tool: ${BASE_AGENT_TOOL}
    gemini-cli:
      postToolUse:
        llm-tool: ${BASE_AGENT_TOOL}
architect-mcp:
  mcp-serve:
    fallbackTool: ${BASE_FALLBACK_TOOL}
`;

/** Overrides only scaffold-mcp.mcp-serve.fallbackTool — sibling keys must be preserved */
const LOCAL_PARTIAL_NESTED = `
scaffold-mcp:
  mcp-serve:
    fallbackTool: ${LOCAL_FALLBACK_TOOL}
`;

/** Overrides a top-level scalar only */
const LOCAL_SCALAR = `
version: ${LOCAL_VERSION}
`;

/** Overrides a top-level scalar AND deeply nested keys */
const LOCAL_MIXED = `
version: ${LOCAL_VERSION}
scaffold-mcp:
  mcp-serve:
    fallbackTool: ${LOCAL_FALLBACK_TOOL}
    fallbackToolConfig:
      model: ${LOCAL_MODEL}
`;

/** Provides a complete scaffold-mcp replacement (all sub-keys explicit) */
const LOCAL_FULL_BLOCK = `
scaffold-mcp:
  mcp-serve:
    fallbackTool: ${LOCAL_FALLBACK_TOOL}
  hook:
    claude-code:
      preToolUse:
        llm-tool: ${LOCAL_AGENT_TOOL}
`;

const LEGACY_YAML = `
projectType: monolith
templatesPath: ./templates
sourceTemplate: ${chance.word()}
`;

// ---------------------------------------------------------------------------
// Type guard — validates that an unknown value conforms to ToolkitConfig
// ---------------------------------------------------------------------------

function isToolkitConfig(value: unknown): value is ToolkitConfig {
  return typeof value === 'object' && value !== null;
}

// ---------------------------------------------------------------------------
// Stat mock factory
//
// StatLike mirrors the public API of fs.Stats. TypeScript's structural typing
// accepts StatLike values wherever Stats is expected, eliminating the need
// for unsafe type assertions.
// ---------------------------------------------------------------------------

interface StatLike {
  isFile(): boolean;
  isDirectory(): boolean;
  isBlockDevice(): boolean;
  isCharacterDevice(): boolean;
  isSymbolicLink(): boolean;
  isFIFO(): boolean;
  isSocket(): boolean;
  dev: number;
  ino: number;
  mode: number;
  nlink: number;
  uid: number;
  gid: number;
  rdev: number;
  size: number;
  blksize: number;
  blocks: number;
  atimeMs: number;
  mtimeMs: number;
  ctimeMs: number;
  birthtimeMs: number;
  atime: Date;
  mtime: Date;
  ctime: Date;
  birthtime: Date;
}

function makeStatResult(directory: boolean): StatLike {
  const now = new Date();
  return {
    isFile: (): boolean => !directory,
    isDirectory: (): boolean => directory,
    isBlockDevice: (): boolean => false,
    isCharacterDevice: (): boolean => false,
    isSymbolicLink: (): boolean => false,
    isFIFO: (): boolean => false,
    isSocket: (): boolean => false,
    dev: 0,
    ino: 0,
    mode: 0,
    nlink: 0,
    uid: 0,
    gid: 0,
    rdev: 0,
    size: 0,
    blksize: 0,
    blocks: 0,
    atimeMs: 0,
    mtimeMs: 0,
    ctimeMs: 0,
    birthtimeMs: 0,
    atime: now,
    mtime: now,
    ctime: now,
    birthtime: now,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TemplatesManagerService', (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Basic utility methods
  // -------------------------------------------------------------------------

  describe('getConfigFileName', (): void => {
    it('should return scaffold config file name', (): void => {
      expect(TemplatesManagerService.getConfigFileName()).toBe('scaffold.yaml');
    });
  });

  describe('getTemplatesFolderName', (): void => {
    it('should return templates folder name', (): void => {
      expect(TemplatesManagerService.getTemplatesFolderName()).toBe('templates');
    });
  });

  describe('isInitialized', (): void => {
    it('should return true when templates directory exists and is a directory', async (): Promise<void> => {
      vi.mocked(fsHelpers.pathExists).mockResolvedValue(true);
      vi.mocked(fs.stat).mockResolvedValue(makeStatResult(true));

      expect(await TemplatesManagerService.isInitialized(MOCK_STAT_TARGET)).toBe(true);
    });

    it('should return false when templates directory does not exist', async (): Promise<void> => {
      vi.mocked(fsHelpers.pathExists).mockResolvedValue(false);

      expect(await TemplatesManagerService.isInitialized(MOCK_STAT_TARGET)).toBe(false);
    });

    it('should return false when path exists but is not a directory', async (): Promise<void> => {
      vi.mocked(fsHelpers.pathExists).mockResolvedValue(true);
      vi.mocked(fs.stat).mockResolvedValue(makeStatResult(false));

      expect(await TemplatesManagerService.isInitialized(MOCK_STAT_TARGET)).toBe(false);
    });

    it('should propagate fs.stat errors', async (): Promise<void> => {
      vi.mocked(fsHelpers.pathExists).mockResolvedValue(true);
      vi.mocked(fs.stat).mockRejectedValue(new Error('Permission denied'));

      await expect(TemplatesManagerService.isInitialized(MOCK_STAT_TARGET)).rejects.toThrow(
        'Permission denied',
      );
    });
  });

  // -------------------------------------------------------------------------
  // findTemplatesPathSync
  // -------------------------------------------------------------------------

  describe('findTemplatesPathSync', (): void => {
    it('should find templates folder in workspace root', (): void => {
      vi.mocked(fsHelpers.pathExistsSync).mockImplementation((p: string): boolean => {
        if (p === MOCK_GIT_PATH) return true;
        if (p === MOCK_TEMPLATES_PATH) return true;
        return false;
      });

      expect(TemplatesManagerService.findTemplatesPathSync(MOCK_WORKSPACE)).toBe(
        MOCK_TEMPLATES_PATH,
      );
    });

    it('should return null when templates folder not found', (): void => {
      vi.mocked(fsHelpers.pathExistsSync).mockImplementation((p: string): boolean => {
        if (p === MOCK_GIT_PATH) return true;
        return false;
      });

      expect(TemplatesManagerService.findTemplatesPathSync(MOCK_WORKSPACE)).toBeNull();
    });

    it('should propagate pathExistsSync errors', (): void => {
      vi.mocked(fsHelpers.pathExistsSync).mockImplementation((): boolean => {
        throw new Error('Permission denied');
      });

      expect((): string | null =>
        TemplatesManagerService.findTemplatesPathSync(MOCK_WORKSPACE),
      ).toThrow('Permission denied');
    });
  });

  // -------------------------------------------------------------------------
  // findTemplatesPath (async)
  // -------------------------------------------------------------------------

  describe('findTemplatesPath', (): void => {
    it('should find templates folder in workspace root', async (): Promise<void> => {
      vi.mocked(fsHelpers.pathExists).mockImplementation(async (p: string): Promise<boolean> => {
        if (p === MOCK_GIT_PATH) return true;
        if (p === MOCK_TEMPLATES_PATH) return true;
        return false;
      });

      expect(await TemplatesManagerService.findTemplatesPath(MOCK_WORKSPACE)).toBe(
        MOCK_TEMPLATES_PATH,
      );
    });

    it('should return null when templates folder not found', async (): Promise<void> => {
      vi.mocked(fsHelpers.pathExists).mockImplementation(async (p: string): Promise<boolean> => {
        if (p === MOCK_GIT_PATH) return true;
        return false;
      });

      expect(await TemplatesManagerService.findTemplatesPath(MOCK_WORKSPACE)).toBeNull();
    });

    it('should propagate pathExists errors', async (): Promise<void> => {
      vi.mocked(fsHelpers.pathExists).mockRejectedValue(new Error('Permission denied'));

      await expect(TemplatesManagerService.findTemplatesPath(MOCK_WORKSPACE)).rejects.toThrow(
        'Permission denied',
      );
    });
  });

  // -------------------------------------------------------------------------
  // readToolkitConfig — async
  // -------------------------------------------------------------------------

  describe('readToolkitConfig', (): void => {
    it('should return null when neither settings.yaml nor toolkit.yaml exist', async (): Promise<void> => {
      vi.mocked(fsHelpers.pathExists).mockImplementation(async (p: string): Promise<boolean> => {
        if (p === MOCK_GIT_PATH) return true;
        return false;
      });

      expect(await TemplatesManagerService.readToolkitConfig(MOCK_WORKSPACE)).toBeNull();
    });

    it('should return base config when only settings.yaml exists', async (): Promise<void> => {
      vi.mocked(fsHelpers.pathExists).mockImplementation(async (p: string): Promise<boolean> => {
        if (p === MOCK_GIT_PATH) return true;
        if (p === MOCK_SETTINGS_PATH) return true;
        return false;
      });
      vi.mocked(fs.readFile).mockResolvedValue(BASE_YAML);

      const result = await TemplatesManagerService.readToolkitConfig(MOCK_WORKSPACE);

      expect(isToolkitConfig(result)).toBe(true);
      if (!isToolkitConfig(result)) return;

      expect(result['scaffold-mcp']?.['mcp-serve']?.fallbackTool).toBe(BASE_FALLBACK_TOOL);
      expect(result['scaffold-mcp']?.hook?.['claude-code']?.postToolUse?.['llm-tool']).toBe(
        BASE_AGENT_TOOL,
      );
      expect(result['architect-mcp']?.['mcp-serve']?.fallbackTool).toBe(BASE_FALLBACK_TOOL);
    });

    it('should fall back to legacy toolkit.yaml when .toolkit/settings.yaml is absent', async (): Promise<void> => {
      vi.mocked(fsHelpers.pathExists).mockImplementation(async (p: string): Promise<boolean> => {
        if (p === MOCK_GIT_PATH) return true;
        if (p === MOCK_SETTINGS_PATH) return false;
        if (p === MOCK_LEGACY_CONFIG_PATH) return true;
        return false;
      });
      vi.mocked(fs.readFile).mockResolvedValue(LEGACY_YAML);

      const result = await TemplatesManagerService.readToolkitConfig(MOCK_WORKSPACE);

      expect(isToolkitConfig(result)).toBe(true);
      if (!isToolkitConfig(result)) return;

      expect(result.projectType).toBe('monolith');
    });

    it('should propagate fs.readFile errors', async (): Promise<void> => {
      vi.mocked(fsHelpers.pathExists).mockImplementation(async (p: string): Promise<boolean> => {
        if (p === MOCK_GIT_PATH) return true;
        if (p === MOCK_SETTINGS_PATH) return true;
        return false;
      });
      vi.mocked(fs.readFile).mockRejectedValue(new Error('Permission denied'));

      await expect(TemplatesManagerService.readToolkitConfig(MOCK_WORKSPACE)).rejects.toThrow(
        'Permission denied',
      );
    });

    // -----------------------------------------------------------------------
    // Deep-merge scenarios — the main purpose of settings.local.yaml
    // -----------------------------------------------------------------------

    it('should override only a top-level scalar, preserving all nested keys', async (): Promise<void> => {
      vi.mocked(fsHelpers.pathExists).mockImplementation(async (p: string): Promise<boolean> => {
        if (p === MOCK_GIT_PATH) return true;
        if (p === MOCK_SETTINGS_PATH) return true;
        if (p === MOCK_SETTINGS_LOCAL_PATH) return true;
        return false;
      });
      vi.mocked(fs.readFile).mockResolvedValueOnce(BASE_YAML).mockResolvedValueOnce(LOCAL_SCALAR);

      const result = await TemplatesManagerService.readToolkitConfig(MOCK_WORKSPACE);

      expect(isToolkitConfig(result)).toBe(true);
      if (!isToolkitConfig(result)) return;

      // Local scalar overrides base
      expect(result.version).toBe(LOCAL_VERSION);
      // All nested keys from base are preserved
      expect(result['scaffold-mcp']?.['mcp-serve']?.fallbackTool).toBe(BASE_FALLBACK_TOOL);
      expect(result['architect-mcp']?.['mcp-serve']?.fallbackTool).toBe(BASE_FALLBACK_TOOL);
    });

    it('should deep-merge partial nested block without wiping sibling keys', async (): Promise<void> => {
      vi.mocked(fsHelpers.pathExists).mockImplementation(async (p: string): Promise<boolean> => {
        if (p === MOCK_GIT_PATH) return true;
        if (p === MOCK_SETTINGS_PATH) return true;
        if (p === MOCK_SETTINGS_LOCAL_PATH) return true;
        return false;
      });
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(BASE_YAML)
        .mockResolvedValueOnce(LOCAL_PARTIAL_NESTED);

      const result = await TemplatesManagerService.readToolkitConfig(MOCK_WORKSPACE);

      expect(isToolkitConfig(result)).toBe(true);
      if (!isToolkitConfig(result)) return;

      const scaffoldMcp = result['scaffold-mcp'];

      // Local override wins for the changed key
      expect(scaffoldMcp?.['mcp-serve']?.fallbackTool).toBe(LOCAL_FALLBACK_TOOL);
      // Sibling mcp-serve keys from base are preserved
      expect(scaffoldMcp?.['mcp-serve']?.fallbackToolConfig).toEqual({ model: BASE_MODEL });
      // hook block from base is fully preserved — NOT wiped by the partial local
      expect(scaffoldMcp?.hook?.['claude-code']?.preToolUse?.['llm-tool']).toBe(BASE_AGENT_TOOL);
      expect(scaffoldMcp?.hook?.['claude-code']?.postToolUse?.['llm-tool']).toBe(BASE_AGENT_TOOL);
      expect(scaffoldMcp?.hook?.['gemini-cli']?.postToolUse?.['llm-tool']).toBe(BASE_AGENT_TOOL);
      // architect-mcp from base preserved
      expect(result['architect-mcp']?.['mcp-serve']?.fallbackTool).toBe(BASE_FALLBACK_TOOL);
    });

    it('should deep-merge mixed scalar and nested overrides', async (): Promise<void> => {
      vi.mocked(fsHelpers.pathExists).mockImplementation(async (p: string): Promise<boolean> => {
        if (p === MOCK_GIT_PATH) return true;
        if (p === MOCK_SETTINGS_PATH) return true;
        if (p === MOCK_SETTINGS_LOCAL_PATH) return true;
        return false;
      });
      vi.mocked(fs.readFile).mockResolvedValueOnce(BASE_YAML).mockResolvedValueOnce(LOCAL_MIXED);

      const result = await TemplatesManagerService.readToolkitConfig(MOCK_WORKSPACE);

      expect(isToolkitConfig(result)).toBe(true);
      if (!isToolkitConfig(result)) return;

      const scaffoldMcp = result['scaffold-mcp'];

      expect(result.version).toBe(LOCAL_VERSION);
      expect(scaffoldMcp?.['mcp-serve']?.fallbackTool).toBe(LOCAL_FALLBACK_TOOL);
      expect(scaffoldMcp?.['mcp-serve']?.fallbackToolConfig).toEqual({ model: LOCAL_MODEL });
      // hook preserved from base
      expect(scaffoldMcp?.hook?.['claude-code']?.preToolUse?.['llm-tool']).toBe(BASE_AGENT_TOOL);
      expect(result['architect-mcp']?.['mcp-serve']?.fallbackTool).toBe(BASE_FALLBACK_TOOL);
    });

    it('should preserve all base keys not mentioned in local at every nesting level', async (): Promise<void> => {
      // LOCAL_FULL_BLOCK specifies scaffold-mcp.mcp-serve and scaffold-mcp.hook.claude-code.preToolUse
      // but omits claude-code.postToolUse and the entire gemini-cli block.
      // Deep merge preserves every unspecified sibling key from base at all depths.
      vi.mocked(fsHelpers.pathExists).mockImplementation(async (p: string): Promise<boolean> => {
        if (p === MOCK_GIT_PATH) return true;
        if (p === MOCK_SETTINGS_PATH) return true;
        if (p === MOCK_SETTINGS_LOCAL_PATH) return true;
        return false;
      });
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(BASE_YAML)
        .mockResolvedValueOnce(LOCAL_FULL_BLOCK);

      const result = await TemplatesManagerService.readToolkitConfig(MOCK_WORKSPACE);

      expect(isToolkitConfig(result)).toBe(true);
      if (!isToolkitConfig(result)) return;

      const scaffoldMcp = result['scaffold-mcp'];

      // Local value wins for the specified key
      expect(scaffoldMcp?.['mcp-serve']?.fallbackTool).toBe(LOCAL_FALLBACK_TOOL);
      expect(scaffoldMcp?.hook?.['claude-code']?.preToolUse?.['llm-tool']).toBe(LOCAL_AGENT_TOOL);
      // Sibling keys not mentioned in local are preserved from base
      expect(scaffoldMcp?.hook?.['claude-code']?.postToolUse?.['llm-tool']).toBe(BASE_AGENT_TOOL);
      expect(scaffoldMcp?.hook?.['gemini-cli']?.postToolUse?.['llm-tool']).toBe(BASE_AGENT_TOOL);
      // Top-level sibling not mentioned in local is preserved
      expect(result['architect-mcp']?.['mcp-serve']?.fallbackTool).toBe(BASE_FALLBACK_TOOL);
    });
  });

  // -------------------------------------------------------------------------
  // readToolkitConfigSync
  // -------------------------------------------------------------------------

  describe('readToolkitConfigSync', (): void => {
    it('should return null when neither settings.yaml nor toolkit.yaml exist', (): void => {
      vi.mocked(fsHelpers.pathExistsSync).mockImplementation((p: string): boolean => {
        if (p === MOCK_GIT_PATH) return true;
        return false;
      });

      expect(TemplatesManagerService.readToolkitConfigSync(MOCK_WORKSPACE)).toBeNull();
    });

    it('should return base config when only settings.yaml exists', (): void => {
      vi.mocked(fsHelpers.pathExistsSync).mockImplementation((p: string): boolean => {
        if (p === MOCK_GIT_PATH) return true;
        if (p === MOCK_SETTINGS_PATH) return true;
        return false;
      });
      mockReadFileSync.mockReturnValue(BASE_YAML);

      const result = TemplatesManagerService.readToolkitConfigSync(MOCK_WORKSPACE);

      expect(isToolkitConfig(result)).toBe(true);
      if (!isToolkitConfig(result)) return;

      expect(result['scaffold-mcp']?.['mcp-serve']?.fallbackTool).toBe(BASE_FALLBACK_TOOL);
      expect(result['architect-mcp']?.['mcp-serve']?.fallbackTool).toBe(BASE_FALLBACK_TOOL);
    });

    it('should fall back to legacy toolkit.yaml when .toolkit/settings.yaml is absent', (): void => {
      vi.mocked(fsHelpers.pathExistsSync).mockImplementation((p: string): boolean => {
        if (p === MOCK_GIT_PATH) return true;
        if (p === MOCK_SETTINGS_PATH) return false;
        if (p === MOCK_LEGACY_CONFIG_PATH) return true;
        return false;
      });
      mockReadFileSync.mockReturnValue(LEGACY_YAML);

      const result = TemplatesManagerService.readToolkitConfigSync(MOCK_WORKSPACE);

      expect(isToolkitConfig(result)).toBe(true);
      if (!isToolkitConfig(result)) return;

      expect(result.projectType).toBe('monolith');
    });

    it('should deep-merge partial nested block without wiping sibling keys (sync)', (): void => {
      vi.mocked(fsHelpers.pathExistsSync).mockImplementation((p: string): boolean => {
        if (p === MOCK_GIT_PATH) return true;
        if (p === MOCK_SETTINGS_PATH) return true;
        if (p === MOCK_SETTINGS_LOCAL_PATH) return true;
        return false;
      });
      mockReadFileSync.mockReturnValueOnce(BASE_YAML).mockReturnValueOnce(LOCAL_PARTIAL_NESTED);

      const result = TemplatesManagerService.readToolkitConfigSync(MOCK_WORKSPACE);

      expect(isToolkitConfig(result)).toBe(true);
      if (!isToolkitConfig(result)) return;

      const scaffoldMcp = result['scaffold-mcp'];

      expect(scaffoldMcp?.['mcp-serve']?.fallbackTool).toBe(LOCAL_FALLBACK_TOOL);
      expect(scaffoldMcp?.['mcp-serve']?.fallbackToolConfig).toEqual({ model: BASE_MODEL });
      // hook from base preserved
      expect(scaffoldMcp?.hook?.['claude-code']?.preToolUse?.['llm-tool']).toBe(BASE_AGENT_TOOL);
      expect(scaffoldMcp?.hook?.['gemini-cli']?.postToolUse?.['llm-tool']).toBe(BASE_AGENT_TOOL);
      // architect-mcp from base preserved
      expect(result['architect-mcp']?.['mcp-serve']?.fallbackTool).toBe(BASE_FALLBACK_TOOL);
    });

    it('should override only a top-level scalar, preserving nested keys (sync)', (): void => {
      vi.mocked(fsHelpers.pathExistsSync).mockImplementation((p: string): boolean => {
        if (p === MOCK_GIT_PATH) return true;
        if (p === MOCK_SETTINGS_PATH) return true;
        if (p === MOCK_SETTINGS_LOCAL_PATH) return true;
        return false;
      });
      mockReadFileSync.mockReturnValueOnce(BASE_YAML).mockReturnValueOnce(LOCAL_SCALAR);

      const result = TemplatesManagerService.readToolkitConfigSync(MOCK_WORKSPACE);

      expect(isToolkitConfig(result)).toBe(true);
      if (!isToolkitConfig(result)) return;

      expect(result.version).toBe(LOCAL_VERSION);
      expect(result['scaffold-mcp']?.['mcp-serve']?.fallbackTool).toBe(BASE_FALLBACK_TOOL);
      expect(result['architect-mcp']?.['mcp-serve']?.fallbackTool).toBe(BASE_FALLBACK_TOOL);
    });
  });
});
