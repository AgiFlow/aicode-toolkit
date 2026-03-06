import type { FallbackConfigEntry } from '../types';

interface SingleFallbackShape {
  fallbackTool?: string;
  fallbackToolConfig?: Record<string, unknown>;
}

interface HookFallbackShape {
  'fallback-tool'?: string;
  'fallback-tool-config'?: Record<string, unknown>;
}

interface FallbackListShape {
  fallbacks?: FallbackConfigEntry[];
}

export interface ResolvedFallbackConfig {
  tool?: string;
  config?: Record<string, unknown>;
}

export function resolveFallbackConfig(
  config?: (SingleFallbackShape | HookFallbackShape) & FallbackListShape,
): ResolvedFallbackConfig {
  if (!config) {
    return {};
  }

  const tool =
    ('fallbackTool' in config ? config.fallbackTool : undefined) ??
    ('fallback-tool' in config ? config['fallback-tool'] : undefined);
  const fallbackConfig =
    ('fallbackToolConfig' in config ? config.fallbackToolConfig : undefined) ??
    ('fallback-tool-config' in config ? config['fallback-tool-config'] : undefined);

  if (tool) {
    return { tool, config: fallbackConfig };
  }

  const firstValidFallback = config.fallbacks?.find((entry) => isFallbackConfigEntry(entry));
  if (!firstValidFallback) {
    return {};
  }

  return {
    tool: firstValidFallback.tool,
    config: firstValidFallback.config,
  };
}

function isFallbackConfigEntry(
  entry: FallbackConfigEntry | undefined,
): entry is FallbackConfigEntry {
  return Boolean(entry?.tool && typeof entry.tool === 'string');
}
