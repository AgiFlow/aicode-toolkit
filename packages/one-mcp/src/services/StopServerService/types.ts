/**
 * StopServerService types and type guards.
 */

import type {
  HttpTransportHealthResponse,
  HttpTransportShutdownResponse,
} from '../../types';
import {
  HEALTH_STATUS_OK,
  HEALTH_TRANSPORT_HTTP,
  KEY_MESSAGE,
  KEY_OK,
  KEY_SERVER_ID,
  KEY_STATUS,
  KEY_TRANSPORT,
} from './constants';

/**
 * Safely cast a non-null object to a string-keyed record for property access.
 * @param value - Object value already verified as non-null
 * @returns The same value typed as a record
 */
function toRecord(value: object): Record<string, unknown> {
  return value as Record<string, unknown>;
}

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
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = toRecord(value);
  return (
    KEY_STATUS in record &&
    record[KEY_STATUS] === HEALTH_STATUS_OK &&
    KEY_TRANSPORT in record &&
    record[KEY_TRANSPORT] === HEALTH_TRANSPORT_HTTP &&
    (!(KEY_SERVER_ID in record) ||
      record[KEY_SERVER_ID] === undefined ||
      typeof record[KEY_SERVER_ID] === 'string')
  );
}

/**
 * Type guard for shutdown responses.
 * @param value - Candidate payload to validate
 * @returns True when payload matches shutdown response shape
 */
export function isShutdownResponse(value: unknown): value is HttpTransportShutdownResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = toRecord(value);
  return (
    KEY_OK in record &&
    typeof record[KEY_OK] === 'boolean' &&
    KEY_MESSAGE in record &&
    typeof record[KEY_MESSAGE] === 'string' &&
    (!(KEY_SERVER_ID in record) ||
      record[KEY_SERVER_ID] === undefined ||
      typeof record[KEY_SERVER_ID] === 'string')
  );
}
