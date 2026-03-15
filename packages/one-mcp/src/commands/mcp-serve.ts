/**
 * MCP Serve Command
 *
 * DESIGN PATTERNS:
 * - Command pattern with Commander for CLI argument parsing
 * - Transport abstraction pattern for flexible deployment (stdio, HTTP, SSE)
 * - Factory pattern for creating transport handlers
 * - Graceful shutdown pattern with signal handling
 *
 * CODING STANDARDS:
 * - Use async/await for asynchronous operations
 * - Implement proper error handling with try-catch blocks
 * - Handle process signals for graceful shutdown
 * - Provide clear CLI options and help messages
 *
 * AVOID:
 * - Hardcoded configuration values (use CLI options or environment variables)
 * - Missing error handling for transport startup
 * - Not cleaning up resources on shutdown
 */

import { randomUUID } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Command } from 'commander';
import {
  ConfigFetcherService,
  type HttpTransportAdminOptions,
  HttpTransportHandler,
  RuntimeStateService,
  SseTransportHandler,
  StdioHttpTransportHandler,
  StdioTransportHandler,
  TRANSPORT_MODE,
  type RuntimeStateRecord,
  type ServerOptions,
  type TransportConfig,
  type TransportHandler,
  createServer,
  generateServerId,
} from '..';

const CONFIG_FILE_NAMES = ['mcp-config.yaml', 'mcp-config.yml', 'mcp-config.json'] as const;
const MCP_ENDPOINT_PATH = '/mcp';
const DEFAULT_PORT = 3000;
const DEFAULT_HOST = 'localhost';
const TRANSPORT_TYPE_STDIO = 'stdio';
const TRANSPORT_TYPE_HTTP = 'http';
const TRANSPORT_TYPE_SSE = 'sse';
const TRANSPORT_TYPE_STDIO_HTTP = 'stdio-http';
const RUNTIME_TRANSPORT: RuntimeStateRecord['transport'] = TRANSPORT_TYPE_HTTP;
const STDIO_HTTP_PROXY_STOP_LABEL = 'Failed stopping stdio-http proxy';
const INTERNAL_HTTP_STOP_LABEL = 'Failed stopping internal HTTP transport';

type ValidTransportType = 'stdio' | 'http' | 'sse' | 'stdio-http';

/**
 * Options for the mcp-serve command
 */
interface McpServeOptions {
  type: string;
  port: number;
  host: string;
  config?: string;
  cache: boolean;
  id?: string;
  definitionsCache?: string;
  clearDefinitionsCache: boolean;
  proxyMode: 'meta' | 'flat' | 'search';
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isValidTransportType(type: string): type is ValidTransportType {
  return (
    type === TRANSPORT_TYPE_STDIO ||
    type === TRANSPORT_TYPE_HTTP ||
    type === TRANSPORT_TYPE_SSE ||
    type === TRANSPORT_TYPE_STDIO_HTTP
  );
}

function isValidProxyMode(mode: string): mode is McpServeOptions['proxyMode'] {
  return mode === 'meta' || mode === 'flat' || mode === 'search';
}

function isAddressInUseError(error: unknown): boolean {
  if (error instanceof Error && error.message.includes('EADDRINUSE')) {
    return true;
  }

  if (typeof error !== 'object' || error === null) {
    return false;
  }

  if ('code' in error && error.code === 'EADDRINUSE') {
    return true;
  }

  if ('message' in error && typeof error.message === 'string' && error.message.includes('EADDRINUSE')) {
    return true;
  }

  return false;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function findConfigFileAsync(): Promise<string | null> {
  try {
    const projectPath = process.env.PROJECT_PATH;
    if (projectPath) {
      for (const fileName of CONFIG_FILE_NAMES) {
        const configPath = resolve(projectPath, fileName);
        if (await pathExists(configPath)) {
          return configPath;
        }
      }
    }

    const cwd = process.cwd();
    for (const fileName of CONFIG_FILE_NAMES) {
      const configPath = join(cwd, fileName);
      if (await pathExists(configPath)) {
        return configPath;
      }
    }

    return null;
  } catch (error) {
    throw new Error(`Failed to discover MCP config file: ${toErrorMessage(error)}`);
  }
}

async function resolveServerId(
  options: McpServeOptions,
  resolvedConfigPath?: string,
): Promise<string> {
  if (options.id) {
    return options.id;
  }

  if (resolvedConfigPath) {
    try {
      const configFetcherService = new ConfigFetcherService({
        configFilePath: resolvedConfigPath,
        useCache: options.cache !== false,
      });
      const config = await configFetcherService.fetchConfiguration(options.cache === false);
      if (config.id) {
        return config.id;
      }
    } catch (error) {
      throw new Error(
        `Failed to resolve server ID from config '${resolvedConfigPath}': ${toErrorMessage(error)}`,
      );
    }
  }

  return generateServerId();
}

function validateTransportType(type: string): ValidTransportType {
  if (!isValidTransportType(type)) {
    throw new Error(
      `Unknown transport type: '${type}'. Valid options: ${TRANSPORT_TYPE_STDIO}, ${TRANSPORT_TYPE_HTTP}, ${TRANSPORT_TYPE_SSE}, ${TRANSPORT_TYPE_STDIO_HTTP}`,
    );
  }

  return type;
}

function validateProxyMode(mode: McpServeOptions['proxyMode']): void {
  if (!isValidProxyMode(mode)) {
    throw new Error(`Unknown proxy mode: '${mode}'. Valid options: meta, flat, search`);
  }
}

function createTransportConfig(options: McpServeOptions, mode: TransportConfig['mode']): TransportConfig {
  return {
    mode,
    port: options.port || Number(process.env.MCP_PORT) || DEFAULT_PORT,
    host: options.host || process.env.MCP_HOST || DEFAULT_HOST,
  };
}

function createServerOptions(
  options: McpServeOptions,
  resolvedConfigPath: string | undefined,
  serverId: string,
): ServerOptions {
  return {
    configFilePath: resolvedConfigPath,
    noCache: options.cache === false,
    serverId,
    definitionsCachePath: options.definitionsCache,
    clearDefinitionsCache: options.clearDefinitionsCache,
    proxyMode: options.proxyMode,
  };
}

function formatStartError(type: ValidTransportType, host: string, port: number, error: unknown): string {
  const startErrorMessage = toErrorMessage(error);
  if (type === TRANSPORT_TYPE_STDIO) {
    return `Failed to start MCP server with transport '${type}': ${startErrorMessage}`;
  }

  return `Failed to start MCP server with transport '${type}' on ${host}:${port}: ${startErrorMessage}`;
}

function createRuntimeRecord(
  serverId: string,
  config: TransportConfig,
  shutdownToken: string,
  configPath?: string,
): RuntimeStateRecord {
  return {
    serverId,
    host: config.host ?? DEFAULT_HOST,
    port: config.port ?? DEFAULT_PORT,
    transport: RUNTIME_TRANSPORT,
    shutdownToken,
    startedAt: new Date().toISOString(),
    pid: process.pid,
    configPath,
  };
}

function createHttpAdminOptions(
  serverId: string,
  shutdownToken: string,
  onShutdownRequested: () => Promise<void>,
): HttpTransportAdminOptions {
  return {
    serverId,
    shutdownToken,
    onShutdownRequested,
  };
}

async function removeRuntimeRecord(
  runtimeStateService: RuntimeStateService,
  serverId: string,
): Promise<void> {
  try {
    await runtimeStateService.remove(serverId);
  } catch (error) {
    throw new Error(`Failed to remove runtime state for '${serverId}': ${toErrorMessage(error)}`);
  }
}

async function writeRuntimeRecord(
  runtimeStateService: RuntimeStateService,
  record: RuntimeStateRecord,
): Promise<void> {
  try {
    await runtimeStateService.write(record);
  } catch (error) {
    throw new Error(`Failed to persist runtime state for '${record.serverId}': ${toErrorMessage(error)}`);
  }
}

async function stopOwnedHttpTransport(
  handler: HttpTransportHandler,
  runtimeStateService: RuntimeStateService,
  serverId: string,
): Promise<void> {
  try {
    try {
      await handler.stop();
    } catch (error) {
      throw new Error(`Failed to stop owned HTTP transport '${serverId}': ${toErrorMessage(error)}`);
    }
  } finally {
    await removeRuntimeRecord(runtimeStateService, serverId);
  }
}

async function cleanupFailedRuntimeStartup(
  handler: HttpTransportHandler,
  runtimeStateService: RuntimeStateService,
  serverId: string,
): Promise<void> {
  try {
    try {
      await handler.stop();
    } catch (error) {
      throw new Error(
        `Failed to stop HTTP transport during cleanup for '${serverId}': ${toErrorMessage(error)}`,
      );
    }
  } finally {
    await removeRuntimeRecord(runtimeStateService, serverId);
  }
}

async function stopTransportWithContext(
  label: string,
  stopOperation: () => Promise<void>,
): Promise<void> {
  try {
    await stopOperation();
  } catch (error) {
    throw new Error(`${label}: ${toErrorMessage(error)}`);
  }
}

async function removeRuntimeRecordDuringStop(
  runtimeStateService: RuntimeStateService,
  serverId: string,
): Promise<void> {
  try {
    await removeRuntimeRecord(runtimeStateService, serverId);
  } catch (error) {
    throw new Error(
      `Failed to remove runtime state during HTTP stop callback for '${serverId}': ${toErrorMessage(error)}`,
    );
  }
}

function createStdioHttpInternalTransport(
  serverOptions: ServerOptions,
  config: TransportConfig,
  adminOptions?: HttpTransportAdminOptions,
): HttpTransportHandler {
  try {
    return new HttpTransportHandler(() => createServer(serverOptions), config, adminOptions);
  } catch (error) {
    throw new Error(
      `Failed to create internal HTTP transport for stdio-http proxy: ${toErrorMessage(error)}`,
    );
  }
}

/**
 * Start MCP server with given transport handler
 * @param handler - The transport handler to start
 * @param onStopped - Optional cleanup callback run after signal-based shutdown
 */
async function startServer(handler: TransportHandler, onStopped?: () => Promise<void>): Promise<void> {
  try {
    await handler.start();
  } catch (error) {
    throw new Error(`Failed to start transport handler: ${toErrorMessage(error)}`);
  }

  const shutdown = async (signal: string): Promise<void> => {
    console.error(`\nReceived ${signal}, shutting down gracefully...`);
    try {
      await handler.stop();
      if (onStopped) {
        await onStopped();
      }
      process.exit(0);
    } catch (error) {
      console.error(`Failed to gracefully stop transport during ${signal}: ${toErrorMessage(error)}`);
      process.exit(1);
    }
  };

  process.on('SIGINT', async (): Promise<void> => await shutdown('SIGINT'));
  process.on('SIGTERM', async (): Promise<void> => await shutdown('SIGTERM'));
}

async function createAndStartHttpRuntime(
  serverOptions: ServerOptions,
  config: TransportConfig,
  resolvedConfigPath: string | undefined,
): Promise<void> {
  const runtimeStateService = new RuntimeStateService();
  const shutdownToken = randomUUID();
  const runtimeRecord = createRuntimeRecord(
    serverOptions.serverId ?? generateServerId(),
    config,
    shutdownToken,
    resolvedConfigPath,
  );

  let handler: HttpTransportHandler;
  let isStopping = false;

  const stopHandler = async (): Promise<void> => {
    if (isStopping) {
      return;
    }

    isStopping = true;

    try {
      await stopOwnedHttpTransport(handler, runtimeStateService, runtimeRecord.serverId);
      process.exit(0);
    } catch (error) {
      throw new Error(
        `Failed to stop HTTP runtime '${runtimeRecord.serverId}' from admin shutdown: ${toErrorMessage(error)}`,
      );
    }
  };

  try {
    const adminOptions = createHttpAdminOptions(runtimeRecord.serverId, shutdownToken, stopHandler);
    handler = new HttpTransportHandler(() => createServer(serverOptions), config, adminOptions);
  } catch (error) {
    throw new Error(`Failed to create HTTP runtime server: ${toErrorMessage(error)}`);
  }

  try {
    await startServer(handler, async (): Promise<void> => {
      await removeRuntimeRecordDuringStop(runtimeStateService, runtimeRecord.serverId);
    });
    await writeRuntimeRecord(runtimeStateService, runtimeRecord);
  } catch (error) {
    await cleanupFailedRuntimeStartup(handler, runtimeStateService, runtimeRecord.serverId);
    throw new Error(`Failed to start HTTP runtime '${runtimeRecord.serverId}': ${toErrorMessage(error)}`);
  }

  console.error(`Runtime state: http://${runtimeRecord.host}:${runtimeRecord.port} (${runtimeRecord.serverId})`);
}

async function stopInternalHttpTransport(
  stdioHttpHandler: StdioHttpTransportHandler,
  httpHandler: HttpTransportHandler | null,
  ownsInternalHttpTransport: boolean,
): Promise<void> {
  try {
    const stopOperations: Array<Promise<void>> = [
      stopTransportWithContext(STDIO_HTTP_PROXY_STOP_LABEL, async (): Promise<void> => {
        await stdioHttpHandler.stop();
      }),
    ];

    if (ownsInternalHttpTransport && httpHandler) {
      stopOperations.push(
        stopTransportWithContext(INTERNAL_HTTP_STOP_LABEL, async (): Promise<void> => {
          await httpHandler.stop();
        }),
      );
    }

    await Promise.all(stopOperations);
  } catch (error) {
    throw new Error(`Failed to stop stdio-http transport: ${toErrorMessage(error)}`);
  }
}

async function startStdioTransport(serverOptions: ServerOptions): Promise<void> {
  try {
    const server = await createServer(serverOptions);
    const handler = new StdioTransportHandler(server);
    await startServer(handler);
  } catch (error) {
    throw new Error(`Failed to start stdio transport: ${toErrorMessage(error)}`);
  }
}

async function startSseTransport(
  serverOptions: ServerOptions,
  config: TransportConfig,
): Promise<void> {
  try {
    const server = await createServer(serverOptions);
    const handler = new SseTransportHandler(server, config);
    await startServer(handler);
  } catch (error) {
    throw new Error(`Failed to start SSE transport: ${toErrorMessage(error)}`);
  }
}

async function startStdioHttpTransport(
  serverOptions: ServerOptions,
  config: TransportConfig,
  resolvedConfigPath: string | undefined,
): Promise<void> {
  try {
    const endpoint = new URL(`http://${config.host}:${config.port}${MCP_ENDPOINT_PATH}`);
    const stdioHttpHandler = new StdioHttpTransportHandler({ endpoint });

    const runtimeStateService = new RuntimeStateService();
    const serverId = serverOptions.serverId ?? generateServerId();
    const shutdownToken = randomUUID();

    let httpHandler: HttpTransportHandler | null = null;
    let ownsInternalHttpTransport = false;
    let isStopping = false;

    const stopOwnedRuntime = async (): Promise<void> => {
      if (isStopping) {
        return;
      }

      isStopping = true;

      try {
        await Promise.all([
          stopInternalHttpTransport(stdioHttpHandler, httpHandler, ownsInternalHttpTransport),
          removeRuntimeRecord(runtimeStateService, serverId),
        ]);

        ownsInternalHttpTransport = false;
        process.exit(0);
      } catch (error) {
        console.error(`Unexpected error during admin shutdown: ${toErrorMessage(error)}`);
        process.exit(1);
      }
    };

    const adminOptions = createHttpAdminOptions(serverId, shutdownToken, stopOwnedRuntime);

    const handler: TransportHandler = {
      async start(): Promise<void> {
        let initialProxyConnectError: unknown;

        try {
          await stdioHttpHandler.start();
          return;
        } catch (error) {
          initialProxyConnectError = error;
        }

        try {
          httpHandler = createStdioHttpInternalTransport(serverOptions, config, adminOptions);
          await httpHandler.start();
          ownsInternalHttpTransport = true;
        } catch (error) {
          if (!isAddressInUseError(error)) {
            throw new Error(
              `Failed to start internal HTTP transport for stdio-http proxy: ${toErrorMessage(error)}`,
            );
          }
        }

        try {
          await stdioHttpHandler.start();
        } catch (error) {
          let rollbackStopErrorMessage = '';

          if (ownsInternalHttpTransport && httpHandler) {
            try {
              await httpHandler.stop();
            } catch (stopError) {
              rollbackStopErrorMessage = toErrorMessage(stopError);
            }
            ownsInternalHttpTransport = false;
          }

          const retryErrorMessage = toErrorMessage(error);
          const initialErrorMessage = toErrorMessage(initialProxyConnectError);
          const rollbackMessage = rollbackStopErrorMessage
            ? `; rollback stop failed: ${rollbackStopErrorMessage}`
            : '';

          throw new Error(
            `Failed to start stdio-http proxy bridge: initial connect failed (${initialErrorMessage}); retry failed (${retryErrorMessage})${rollbackMessage}`,
          );
        }

        if (ownsInternalHttpTransport) {
          try {
            const runtimeRecord = createRuntimeRecord(serverId, config, shutdownToken, resolvedConfigPath);
            await writeRuntimeRecord(runtimeStateService, runtimeRecord);
          } catch (error) {
            throw new Error(
              `Failed to persist runtime state for stdio-http server '${serverId}': ${toErrorMessage(error)}`,
            );
          }
        }
      },
      async stop(): Promise<void> {
        try {
          await Promise.all([
            stopInternalHttpTransport(stdioHttpHandler, httpHandler, ownsInternalHttpTransport),
            removeRuntimeRecord(runtimeStateService, serverId),
          ]);
          ownsInternalHttpTransport = false;
        } catch (error) {
          ownsInternalHttpTransport = false;
          throw new Error(
            `Failed during stdio-http shutdown for '${serverId}': ${toErrorMessage(error)}`,
          );
        }
      },
    };

    await startServer(handler);
  } catch (error) {
    throw new Error(`Failed to start stdio-http transport: ${toErrorMessage(error)}`);
  }
}

async function startTransport(
  transportType: ValidTransportType,
  options: McpServeOptions,
  resolvedConfigPath: string | undefined,
  serverOptions: ServerOptions,
): Promise<void> {
  try {
    if (transportType === TRANSPORT_TYPE_STDIO) {
      await startStdioTransport(serverOptions);
      return;
    }

    if (transportType === TRANSPORT_TYPE_HTTP) {
      const config = createTransportConfig(options, TRANSPORT_MODE.HTTP);
      await createAndStartHttpRuntime(serverOptions, config, resolvedConfigPath);
      return;
    }

    if (transportType === TRANSPORT_TYPE_SSE) {
      const config = createTransportConfig(options, TRANSPORT_MODE.SSE);
      await startSseTransport(serverOptions, config);
      return;
    }

    const config = createTransportConfig(options, TRANSPORT_MODE.HTTP);
    await startStdioHttpTransport(serverOptions, config, resolvedConfigPath);
  } catch (error) {
    throw new Error(`Failed to start transport '${transportType}': ${toErrorMessage(error)}`);
  }
}

/**
 * MCP Serve command
 */
export const mcpServeCommand = new Command('mcp-serve')
  .description('Start MCP server with specified transport')
  .option(
    '-t, --type <type>',
    `Transport type: ${TRANSPORT_TYPE_STDIO}, ${TRANSPORT_TYPE_HTTP}, ${TRANSPORT_TYPE_SSE}, or ${TRANSPORT_TYPE_STDIO_HTTP}`,
    TRANSPORT_TYPE_STDIO,
  )
  .option(
    '-p, --port <port>',
    'Port to listen on (http/sse/stdio-http internal HTTP)',
    (val: string): number => parseInt(val, 10),
    DEFAULT_PORT,
  )
  .option('--host <host>', 'Host to bind to (http/sse/stdio-http internal HTTP)', DEFAULT_HOST)
  .option('-c, --config <path>', 'Path to MCP server configuration file')
  .option('--no-cache', 'Disable configuration caching, always reload from config file')
  .option(
    '--definitions-cache <path>',
    'Path to prefetched tool/prompt/skill definitions cache file',
  )
  .option('--clear-definitions-cache', 'Delete definitions cache before startup', false)
  .option(
    '--proxy-mode <mode>',
    'How one-mcp exposes downstream tools: meta, flat, or search',
    'meta',
  )
  .option(
    '--id <id>',
    'Unique server identifier (overrides config file id, auto-generated if not provided)',
  )
  .action(async (options: McpServeOptions): Promise<void> => {
    try {
      const transportType = validateTransportType(options.type.toLowerCase());
      validateProxyMode(options.proxyMode);

      const resolvedConfigPath = options.config || (await findConfigFileAsync()) || undefined;
      const resolvedServerId = await resolveServerId(options, resolvedConfigPath);
      const serverOptions = createServerOptions(options, resolvedConfigPath, resolvedServerId);

      await startTransport(transportType, options, resolvedConfigPath, serverOptions);
    } catch (error) {
      const rawTransportType = options.type.toLowerCase();
      const transportType: ValidTransportType = isValidTransportType(rawTransportType)
        ? rawTransportType
        : TRANSPORT_TYPE_STDIO;
      console.error(formatStartError(transportType, options.host, options.port, error));
      process.exit(1);
    }
  });
