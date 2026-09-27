import { type Mocked, vi } from 'vitest';
import type { ITemplateService } from '../../src/types/interfaces';

export const createMockTemplateService = (): Mocked<ITemplateService> => ({
  renderString: vi.fn().mockImplementation((template: string, variables?: Record<string, any>) => {
    // More realistic mock: replace variables with actual values if provided
    if (variables) {
      return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, varName) => {
        return variables[varName] !== undefined ? String(variables[varName]) : '';
      });
    }
    // Fallback to old behavior for backwards compatibility
    return template.replace(/\{\{(\w+)\}\}/g, 'value');
  }),
  containsTemplateVariables: vi.fn().mockReturnValue(false),
});
