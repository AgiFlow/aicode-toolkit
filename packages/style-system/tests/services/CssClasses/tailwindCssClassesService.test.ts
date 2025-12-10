/**
 * TailwindCSSClassesService Tests
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

import { promises as fs } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TailwindCSSClassesService } from '../../../src/services/CssClasses/TailwindCSSClassesService';
import type { StyleSystemConfig } from '../../../src/services/CssClasses/types';

// Mock fs module
vi.mock('node:fs', () => ({
  promises: {
    access: vi.fn(),
    readFile: vi.fn(),
  },
}));

describe('TailwindCSSClassesService', () => {
  let service: TailwindCSSClassesService;
  const mockConfig: StyleSystemConfig = {
    cssFramework: 'tailwind',
    themePath: '/mock/theme.css',
  };

  beforeEach(() => {
    service = new TailwindCSSClassesService(mockConfig);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getFrameworkId', () => {
    it('should return tailwind as framework identifier', () => {
      expect(service.getFrameworkId()).toBe('tailwind');
    });
  });

  describe('extractClasses', () => {
    const mockThemePath = '/path/to/theme.css';

    it('should extract color classes from CSS variables', async () => {
      const mockCss = `
        :root {
          --color-primary: #3b82f6;
          --color-secondary: #10b981;
        }
      `;

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(mockCss);

      const result = await service.extractClasses('colors', mockThemePath);

      expect(result.category).toBe('colors');
      expect(result.classes.colors).toBeDefined();
      expect(result.classes.colors).toContainEqual({ class: 'bg-primary', value: '#3b82f6' });
      expect(result.classes.colors).toContainEqual({ class: 'text-primary', value: '#3b82f6' });
      expect(result.classes.colors).toContainEqual({ class: 'border-primary', value: '#3b82f6' });
      expect(result.classes.colors).toContainEqual({ class: 'ring-primary', value: '#3b82f6' });
    });

    it('should extract typography classes from CSS variables', async () => {
      const mockCss = `
        :root {
          --font-sans: ui-sans-serif, system-ui;
          --font-weight-bold: 700;
          --text-lg: 1.125rem;
        }
      `;

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(mockCss);

      const result = await service.extractClasses('typography', mockThemePath);

      expect(result.category).toBe('typography');
      expect(result.classes.typography).toBeDefined();
      expect(result.classes.typography).toContainEqual({ class: 'font-sans', value: 'ui-sans-serif, system-ui' });
      expect(result.classes.typography).toContainEqual({ class: 'text-lg', value: '1.125rem' });
    });

    it('should extract spacing classes from CSS variables', async () => {
      const mockCss = `
        :root {
          --space-4: 1rem;
          --space-8: 2rem;
          --spacing: 0.25rem;
        }
      `;

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(mockCss);

      const result = await service.extractClasses('spacing', mockThemePath);

      expect(result.category).toBe('spacing');
      expect(result.classes.spacing).toBeDefined();
      expect(result.classes.spacing).toContainEqual({ class: 'p-4', value: 'calc(var(--space-4) * 1)' });
      expect(result.classes.spacing).toContainEqual({ class: 'm-4', value: 'calc(var(--space-4) * 1)' });
      expect(result.classes.spacing).toContainEqual({ class: 'gap-4', value: 'calc(var(--space-4) * 1)' });
      expect(result.classes.spacing).toContainEqual({ class: 'space', value: '0.25rem' });
    });

    it('should extract effects classes from CSS variables', async () => {
      const mockCss = `
        :root {
          --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
          --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1);
        }
      `;

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(mockCss);

      const result = await service.extractClasses('effects', mockThemePath);

      expect(result.category).toBe('effects');
      expect(result.classes.effects).toBeDefined();
      expect(result.classes.effects).toContainEqual({ class: 'shadow-sm', value: '0 1px 2px rgba(0,0,0,0.05)' });
      expect(result.classes.effects).toContainEqual({ class: 'shadow-lg', value: '0 10px 15px -3px rgba(0,0,0,0.1)' });
    });

    it('should extract all categories when category is "all"', async () => {
      const mockCss = `
        :root {
          --color-primary: #3b82f6;
          --font-sans: ui-sans-serif;
          --space-4: 1rem;
          --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
        }
      `;

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(mockCss);

      const result = await service.extractClasses('all', mockThemePath);

      expect(result.category).toBe('all');
      expect(result.classes.colors).toBeDefined();
      expect(result.classes.typography).toBeDefined();
      expect(result.classes.spacing).toBeDefined();
      expect(result.classes.effects).toBeDefined();
    });

    it('should handle sidebar color variables', async () => {
      const mockCss = `
        :root {
          --sidebar-background: hsl(0 0% 98%);
          --sidebar-foreground: hsl(240 5% 10%);
        }
      `;

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(mockCss);

      const result = await service.extractClasses('colors', mockThemePath);

      expect(result.classes.colors).toContainEqual({ class: 'bg-sidebar-background', value: 'hsl(0 0% 98%)' });
      expect(result.classes.colors).toContainEqual({ class: 'text-sidebar-background', value: 'hsl(0 0% 98%)' });
    });

    it('should handle multi-line CSS values', async () => {
      const mockCss = `
        :root {
          --shadow-xl:
            0 20px 25px -5px rgba(0, 0, 0, 0.1),
            0 8px 10px -6px rgba(0, 0, 0, 0.1);
        }
      `;

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(mockCss);

      const result = await service.extractClasses('effects', mockThemePath);

      expect(result.classes.effects).toBeDefined();
      expect(result.classes.effects?.length).toBeGreaterThan(0);
      const shadowXl = result.classes.effects?.find((c) => c.class === 'shadow-xl');
      expect(shadowXl).toBeDefined();
    });

    it('should handle compressed CSS format', async () => {
      const mockCss = ':root{--color-primary:#3b82f6;--color-secondary:#10b981;}';

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(mockCss);

      const result = await service.extractClasses('colors', mockThemePath);

      expect(result.classes.colors).toContainEqual({ class: 'bg-primary', value: '#3b82f6' });
      expect(result.classes.colors).toContainEqual({ class: 'bg-secondary', value: '#10b981' });
    });

    it('should use first occurrence for duplicate variables (light mode priority)', async () => {
      const mockCss = `
        :root {
          --color-primary: #3b82f6;
        }
        .dark {
          --color-primary: #60a5fa;
        }
      `;

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(mockCss);

      const result = await service.extractClasses('colors', mockThemePath);

      // Should use the first (light mode) value
      expect(result.classes.colors).toContainEqual({ class: 'bg-primary', value: '#3b82f6' });
    });

    it('should throw error when theme file does not exist', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      await expect(service.extractClasses('colors', mockThemePath)).rejects.toThrow(
        /Failed to extract classes from theme file/,
      );
    });

    it('should throw error for invalid CSS content', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue('{ invalid css content without proper structure');

      await expect(service.extractClasses('colors', mockThemePath)).rejects.toThrow();
    });

    it('should return empty classes for unrecognized category', async () => {
      const mockCss = `
        :root {
          --color-primary: #3b82f6;
        }
      `;

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(mockCss);

      const result = await service.extractClasses('unknown-category', mockThemePath);

      expect(result.totalClasses).toBe(0);
    });

    it('should calculate totalClasses correctly', async () => {
      const mockCss = `
        :root {
          --color-primary: #3b82f6;
          --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
        }
      `;

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(mockCss);

      const result = await service.extractClasses('all', mockThemePath);

      // 4 color classes (bg, text, border, ring) + 1 effect class
      expect(result.totalClasses).toBe(5);
    });
  });
});
