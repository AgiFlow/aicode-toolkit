/**
 * TemplateFinder Tests
 *
 * TESTING PATTERNS:
 * - Test service logic and data processing
 * - Test error handling
 * - Mock dependencies appropriately
 *
 * CODING STANDARDS:
 * - Use descriptive test names (should...)
 * - Test both success and error paths
 * - Mock external dependencies
 * - Verify returned data structure
 */

import { describe, it, expect } from 'vitest';
import { TemplateFinder } from '../../../../src/services/TemplateFinder';

describe('TemplateFinder', () => {
  const service = new TemplateFinder();

  it('should be instantiable', () => {
    expect(service).toBeDefined();
  });

  it('should handle file not in project gracefully', async () => {
    const result = await service.findTemplateForFile('/non/existent/path.ts');

    // Should return null for files not in a project
    expect(result).toBeNull();
  });

  it('should clear cache', () => {
    expect(() => service.clearCache()).not.toThrow();
  });
});
