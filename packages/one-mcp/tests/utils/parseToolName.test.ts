import { describe, it, expect } from 'vitest';
import { parseToolName } from '../../src/utils/parseToolName';

describe('parseToolName', () => {
  it('should return actualToolName only for plain tool names', () => {
    const result = parseToolName('my_tool');
    expect(result).toEqual({ actualToolName: 'my_tool' });
    expect(result.serverName).toBeUndefined();
  });

  it('should parse serverName and actualToolName from prefixed format', () => {
    const result = parseToolName('server__my_tool');
    expect(result).toEqual({
      serverName: 'server',
      actualToolName: 'my_tool',
    });
  });

  it('should handle tool names with underscores correctly', () => {
    const result = parseToolName('my_server__my_cool_tool');
    expect(result).toEqual({
      serverName: 'my_server',
      actualToolName: 'my_cool_tool',
    });
  });

  it('should handle multiple double underscores - use first occurrence', () => {
    const result = parseToolName('server__tool__extra');
    expect(result).toEqual({
      serverName: 'server',
      actualToolName: 'tool__extra',
    });
  });

  it('should not parse if separator is at the start', () => {
    const result = parseToolName('__tool');
    expect(result).toEqual({ actualToolName: '__tool' });
    expect(result.serverName).toBeUndefined();
  });

  it('should handle empty string', () => {
    const result = parseToolName('');
    expect(result).toEqual({ actualToolName: '' });
    expect(result.serverName).toBeUndefined();
  });

  it('should handle single underscore (not a separator)', () => {
    const result = parseToolName('my_tool_name');
    expect(result).toEqual({ actualToolName: 'my_tool_name' });
    expect(result.serverName).toBeUndefined();
  });

  it('should handle server name with hyphens', () => {
    const result = parseToolName('my-server__my_tool');
    expect(result).toEqual({
      serverName: 'my-server',
      actualToolName: 'my_tool',
    });
  });
});
