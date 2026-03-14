/**
 * StopServerService types and constants.
 */

import type {
  HttpTransportHealthResponse,
  HttpTransportShutdownResponse,
  RuntimeStateRecord,
} from '../../types';

export const DEFAULT_STOP_TIMEOUT_MS = 5000;
export const HEALTH_REQUEST_TIMEOUT_FLOOR_MS = 250;
export const SHUTDOWN_POLL_INTERVAL_MS = 200;
export const HEALTH_CHECK_PATH = '/health';
export const ADMIN_SHUTDOWN_PATH = '/admin/shutdown';
export const HTTP_METHOD_GET = 'GET';
export const HTTP_METHOD_POST = 'POST';
export const AUTHORIZATION_HEADER_NAME = 'Authorization';
export const BEARER_TOKEN_PREFIX = 'Bearer ';

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

/**
 * Health check query result.
 * @property reachable - Whether the target runtime responded successfully
 * @property payload - Optional parsed health payload for successful responses
 */
export interface HealthCheckResult {
  reachable: boolean;
  payload?: HttpTransportHealthResponse;
}

/**
 * Type guard for health responses.
 * @param value - Candidate payload to validate
 * @returns True when payload matches health response shape
 */
export function isHealthResponse(value: unknown): value is HttpTransportHealthResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    value.status === 'ok' &&
    'transport' in value &&
    value.transport === 'http' &&
    (!('serverId' in value) || value.serverId === undefined || typeof value.serverId === 'string')
  );
}

/**
 * Type guard for shutdown responses.
 * @param value - Candidate payload to validate
 * @returns True when payload matches shutdown response shape
 */
export function isShutdownResponse(value: unknown): value is HttpTransportShutdownResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    typeof value.ok === 'boolean' &&
    'message' in value &&
    typeof value.message === 'string' &&
    (!('serverId' in value) || value.serverId === undefined || typeof value.serverId === 'string')
  );
}

/**
 * Format runtime endpoint URL.
 * @param runtime - Runtime record to format
 * @param path - Request path to append
 * @returns Full runtime URL
 */
export function buildRuntimeUrl(runtime: RuntimeStateRecord, path: string): string {
  return `http://${runtime.host}:${runtime.port}${path}`;
}
