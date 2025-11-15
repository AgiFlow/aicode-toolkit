import { describe, it, expect } from 'vitest';

describe('one-mcp package', () => {
  it('should export ConfigFetcherService', async () => {
    const { ConfigFetcherService } = await import('../src/services/ConfigFetcherService');
    expect(ConfigFetcherService).toBeDefined();
  });

  it('should export McpClientManagerService', async () => {
    const { McpClientManagerService } = await import('../src/services/McpClientManagerService');
    expect(McpClientManagerService).toBeDefined();
  });

  it('should export schema utilities', async () => {
    const {
      ClaudeCodeMcpConfigSchema,
      InternalMcpConfigSchema,
      transformClaudeCodeConfig,
      parseMcpConfig,
    } = await import('../src/utils/mcpConfigSchema');

    expect(ClaudeCodeMcpConfigSchema).toBeDefined();
    expect(InternalMcpConfigSchema).toBeDefined();
    expect(transformClaudeCodeConfig).toBeDefined();
    expect(parseMcpConfig).toBeDefined();
  });

  it('should export tools', async () => {
    const { DescribeToolsTool } = await import('../src/tools/DescribeToolsTool');
    const { UseToolTool } = await import('../src/tools/UseToolTool');

    expect(DescribeToolsTool).toBeDefined();
    expect(UseToolTool).toBeDefined();
  });
});
