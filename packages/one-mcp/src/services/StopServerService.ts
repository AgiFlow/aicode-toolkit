/**
 * StopServerService
 *
 * Resolves a running HTTP one-mcp runtime and requests cooperative shutdown
 * through the authenticated admin endpoint.
 */

import type {
  HttpTransportHealthResponse,
  HttpTransportShutdownResponse,
  RuntimeStateManager,
  RuntimeStateRecord,
} from '../types';
import { RuntimeStateService } from './RuntimeStateService';

/**
 * Stop request options.
 * @property serverId - Explicit one-mcp server identifier to stop
 * @property host - Host fallback for runtime lookup
 * @property port - Port fallback for runtime lookup
 * @property token - Optional shutdown token override
 * @property force - Skip server ID verification against /health when true
 * @property timeoutMs - Maximum time to wait for shutdown completion
 */
export interface StopServerRequest {
  serverId?: string;
  host?: string;
  port?: number;
  token?: string;
  force?: boolean;
  timeoutMs?: number;
}

/**
 * Stop command result payload.
 * @property ok - Whether the shutdown completed successfully
 * @property serverId - Stopped one-mcp server identifier
 * @property host - Host that served the runtime
 * @property port - Port that served the runtime
 * @property message - Human-readable shutdown result message
 */
export interface StopServerResult {
  ok: true;
  serverId: string;
  host: string;
  port: number;
  message: string;
}

interface HealthCheckResult {
  reachable: boolean;
  payload?: HttpTransportHealthResponse;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isHealthResponse(value: unknown): value is HttpTransportHealthResponse {
  return (
    isObject(value) &&
    value.status === 'ok' &&
    value.transport === 'http' &&
    (value.serverId === undefined || typeof value.serverId === 'string')
  );
}

function isShutdownResponse(value: unknown): value is HttpTransportShutdownResponse {
  return (
    isObject(value) &&
    typeof value.ok === 'boolean' &&
    typeof value.message === 'string' &&
    (value.serverId === undefined || typeof value.serverId === 'string')
  );
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

/**
 * Service for resolving runtime targets and stopping them safely.
 */
export class StopServerService {
  private runtimeStateService: RuntimeStateManager;

  constructor(runtimeStateService: RuntimeStateManager = new RuntimeStateService()) {
    this.runtimeStateService = runtimeStateService;
  }

  /**
   * Resolve a target runtime and stop it cooperatively.
   * @param request - Stop request options
   * @returns Stop result payload
   */
  async stop(request: StopServerRequest): Promise<StopServerResult> {
    const timeoutMs = request.timeoutMs ?? 5000;
    const runtime = await this.resolveRuntime(request);
    const health = await this.fetchHealth(runtime, timeoutMs);

    if (!health.reachable) {
      await this.runtimeStateService.remove(runtime.serverId);
      throw new Error(
        `Runtime '${runtime.serverId}' is not reachable at http://${runtime.host}:${runtime.port}. Removed stale runtime record.`,
      );
    }

    if (!request.force && health.payload?.serverId && health.payload.serverId !== runtime.serverId) {
      throw new Error(
        `Refusing to stop runtime at http://${runtime.host}:${runtime.port}: expected server ID '${runtime.serverId}' but health endpoint reported '${health.payload.serverId}'. Use --force to override.`,
      );
    }

    const shutdownToken = request.token ?? runtime.shutdownToken;
    if (!shutdownToken) {
      throw new Error(`No shutdown token available for runtime '${runtime.serverId}'.`);
    }

    const shutdownResponse = await this.requestShutdown(runtime, shutdownToken, timeoutMs);
    await this.waitForShutdown(runtime, timeoutMs);
    await this.runtimeStateService.remove(runtime.serverId);

    return {
      ok: true,
      serverId: runtime.serverId,
      host: runtime.host,
      port: runtime.port,
      message: shutdownResponse.message,
    };
  }

  /**
   * Resolve a runtime record from explicit ID or a unique host/port pair.
   * @param request - Stop request options
   * @returns Matching runtime record
   */
  private async resolveRuntime(request: StopServerRequest): Promise<RuntimeStateRecord> {
    if (request.serverId) {
      const runtime = await this.runtimeStateService.read(request.serverId);
      if (!runtime) {
        throw new Error(
          `No runtime record found for server ID '${request.serverId}'. Start the server with 'one-mcp mcp-serve --type http' first.`,
        );
      }
      return runtime;
    }

    if (request.host === undefined || request.port === undefined) {
      throw new Error('Provide --id or both --host and --port to select a runtime.');
    }

    const runtimes = await this.runtimeStateService.list();
    const matches = runtimes.filter(
      (runtime) => runtime.host === request.host && runtime.port === request.port,
    );

    if (matches.length === 0) {
      throw new Error(
        `No runtime record found for http://${request.host}:${request.port}. Start the server with 'one-mcp mcp-serve --type http' first.`,
      );
    }

    if (matches.length > 1) {
      throw new Error(
        `Multiple runtime records match http://${request.host}:${request.port}. Retry with --id to avoid stopping the wrong server.`,
      );
    }

    return matches[0];
  }

  /**
   * Read the runtime health payload.
   * @param runtime - Runtime to query
   * @param timeoutMs - Request timeout in milliseconds
   * @returns Reachability status and optional payload
   */
  private async fetchHealth(
    runtime: RuntimeStateRecord,
    timeoutMs: number,
  ): Promise<HealthCheckResult> {
    try {
      const response = await this.fetchWithTimeout(
        `http://${runtime.host}:${runtime.port}/health`,
        {
          method: 'GET',
        },
        timeoutMs,
      );

      if (!response.ok) {
        return { reachable: false };
      }

      const payload = (await response.json()) as unknown;
      if (!isHealthResponse(payload)) {
        throw new Error('Received invalid health response payload.');
      }

      return {
        reachable: true,
        payload,
      };
    } catch {
      return { reachable: false };
    }
  }

  /**
   * Send authenticated shutdown request to the admin endpoint.
   * @param runtime - Runtime to stop
   * @param shutdownToken - Bearer token for the admin endpoint
   * @param timeoutMs - Request timeout in milliseconds
   * @returns Parsed shutdown response payload
   */
  private async requestShutdown(
    runtime: RuntimeStateRecord,
    shutdownToken: string,
    timeoutMs: number,
  ): Promise<HttpTransportShutdownResponse> {
    const response = await this.fetchWithTimeout(
      `http://${runtime.host}:${runtime.port}/admin/shutdown`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${shutdownToken}`,
        },
      },
      timeoutMs,
    );

    const payload = (await response.json()) as unknown;
    if (!isShutdownResponse(payload)) {
      throw new Error('Received invalid shutdown response payload.');
    }

    if (!response.ok || !payload.ok) {
      throw new Error(payload.message);
    }

    return payload;
  }

  /**
   * Poll until the target runtime is no longer reachable.
   * @param runtime - Runtime expected to stop
   * @param timeoutMs - Maximum wait time in milliseconds
   * @returns Promise that resolves when shutdown is observed
   */
  private async waitForShutdown(runtime: RuntimeStateRecord, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const health = await this.fetchHealth(runtime, Math.max(250, deadline - Date.now()));
      if (!health.reachable) {
        return;
      }

      await sleep(200);
    }

    throw new Error(
      `Timed out waiting for runtime '${runtime.serverId}' to stop at http://${runtime.host}:${runtime.port}.`,
    );
  }

  /**
   * Perform a fetch with an abort timeout.
   * @param url - Target URL
   * @param init - Fetch options
   * @param timeoutMs - Timeout in milliseconds
   * @returns Fetch response
   */
  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
      });
    } catch (error) {
      throw new Error(`Request to '${url}' failed: ${toErrorMessage(error)}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
