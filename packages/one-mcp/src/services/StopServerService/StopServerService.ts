/**
 * StopServerService
 *
 * Resolves a running HTTP one-mcp runtime and requests cooperative shutdown
 * by signaling the recorded local process.
 */

import type { RuntimeStateManager, RuntimeStateRecord } from '../../types';
import { RuntimeStateService } from '../RuntimeStateService';
import {
  ALLOWED_HOSTS,
  DEFAULT_STOP_TIMEOUT_MS,
  HEALTH_CHECK_PATH,
  HEALTH_REQUEST_TIMEOUT_FLOOR_MS,
  HTTP_METHOD_GET,
  HTTP_PROTOCOL,
  SHUTDOWN_POLL_INTERVAL_MS,
  URL_PORT_SEPARATOR,
} from './constants';
import {
  isHealthResponse,
  type HealthCheckResult,
  type StopServerRequest,
  type StopServerResult,
} from './types';

/**
 * Format runtime endpoint URL after validating the host is a loopback address.
 * Rejects non-loopback hosts to prevent SSRF via tampered runtime state files.
 * @param runtime - Runtime record to format
 * @param path - Request path to append
 * @returns Full runtime URL
 */
function buildRuntimeUrl(runtime: RuntimeStateRecord, path: string): string {
  if (!ALLOWED_HOSTS.has(runtime.host)) {
    throw new Error(
      `Refusing to connect to non-loopback host '${runtime.host}'. Only ${Array.from(ALLOWED_HOSTS).join(', ')} are allowed.`,
    );
  }
  return `${HTTP_PROTOCOL}${runtime.host}${URL_PORT_SEPARATOR}${runtime.port}${path}`;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
    const timeoutMs = request.timeoutMs ?? DEFAULT_STOP_TIMEOUT_MS;
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

    this.requestLocalShutdown(runtime);
    await this.waitForShutdown(runtime, timeoutMs);
    await this.runtimeStateService.remove(runtime.serverId);

    return {
      ok: true,
      serverId: runtime.serverId,
      host: runtime.host,
      port: runtime.port,
      message: `Sent SIGTERM to local process ${runtime.pid} and the runtime stopped gracefully.`,
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
        buildRuntimeUrl(runtime, HEALTH_CHECK_PATH),
        {
          method: HTTP_METHOD_GET,
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

  private requestLocalShutdown(runtime: RuntimeStateRecord): void {
    try {
      process.kill(runtime.pid, 'SIGTERM');
    } catch (error) {
      if (isNodeError(error) && error.code === 'ESRCH') {
        throw new Error(
          `Runtime '${runtime.serverId}' is not running anymore (pid ${runtime.pid} does not exist).`,
        );
      }

      if (isNodeError(error) && error.code === 'EPERM') {
        throw new Error(
          `Permission denied when signaling runtime '${runtime.serverId}' (pid ${runtime.pid}).`,
        );
      }

      throw new Error(
        `Failed to signal runtime '${runtime.serverId}' (pid ${runtime.pid}): ${toErrorMessage(error)}`,
      );
    }
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
      const health = await this.fetchHealth(
        runtime,
        Math.max(HEALTH_REQUEST_TIMEOUT_FLOOR_MS, deadline - Date.now()),
      );
      if (!health.reachable) {
        return;
      }

      await sleep(SHUTDOWN_POLL_INTERVAL_MS);
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

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error;
}
