/**
 * StopServerService constants.
 */

/** Maximum time in milliseconds to wait for a shutdown to complete. */
export const DEFAULT_STOP_TIMEOUT_MS = 5000;

/** Minimum timeout in milliseconds for individual health check requests. */
export const HEALTH_REQUEST_TIMEOUT_FLOOR_MS = 250;

/** Delay in milliseconds between shutdown polling attempts. */
export const SHUTDOWN_POLL_INTERVAL_MS = 200;

/** Path for the runtime health check endpoint. */
export const HEALTH_CHECK_PATH = '/health';

/** Path for the authenticated admin shutdown endpoint. */
export const ADMIN_SHUTDOWN_PATH = '/admin/shutdown';

/** HTTP GET method identifier. */
export const HTTP_METHOD_GET = 'GET';

/** HTTP POST method identifier. */
export const HTTP_METHOD_POST = 'POST';

/** HTTP header name for bearer token authorization. */
export const AUTHORIZATION_HEADER_NAME = 'Authorization';

/** Prefix for bearer token values in the Authorization header. */
export const BEARER_TOKEN_PREFIX = 'Bearer ';

/** HTTP protocol scheme prefix for URL construction. */
export const HTTP_PROTOCOL = 'http://';

/** Separator between host and port in URL construction. */
export const URL_PORT_SEPARATOR = ':';

/** Loopback hostname. */
export const LOOPBACK_HOST_LOCALHOST = 'localhost';

/** IPv4 loopback address. */
export const LOOPBACK_HOST_IPV4 = '127.0.0.1';

/** IPv6 loopback address. */
export const LOOPBACK_HOST_IPV6 = '::1';

/** Hosts that are safe to send admin requests to (loopback only). */
export const ALLOWED_HOSTS = new Set([
  LOOPBACK_HOST_LOCALHOST,
  LOOPBACK_HOST_IPV4,
  LOOPBACK_HOST_IPV6,
]);

/** Expected status value in a healthy runtime response. */
export const HEALTH_STATUS_OK = 'ok';

/** Expected transport value in a healthy runtime response. */
export const HEALTH_TRANSPORT_HTTP = 'http';

/** Property key for status field in health responses. */
export const KEY_STATUS = 'status';

/** Property key for transport field in health responses. */
export const KEY_TRANSPORT = 'transport';

/** Property key for serverId field in runtime responses. */
export const KEY_SERVER_ID = 'serverId';

/** Property key for ok field in shutdown responses. */
export const KEY_OK = 'ok';

/** Property key for message field in shutdown responses. */
export const KEY_MESSAGE = 'message';
