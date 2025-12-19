/**
 * PrefetchService Constants
 *
 * Constants for package manager commands and process configuration.
 */

// Transport types
/** Transport type for stdio-based MCP servers */
export const TRANSPORT_STDIO = 'stdio';

// Command names
/** npx command name */
export const COMMAND_NPX = 'npx';

/** pnpx command name (pnpm's npx equivalent) */
export const COMMAND_PNPX = 'pnpx';

/** uvx command name */
export const COMMAND_UVX = 'uvx';

/** uv command name */
export const COMMAND_UV = 'uv';

// Path suffixes
/** Path suffix for npx command */
export const COMMAND_NPX_SUFFIX = '/npx';

/** Path suffix for pnpx command */
export const COMMAND_PNPX_SUFFIX = '/pnpx';

/** Path suffix for uvx command */
export const COMMAND_UVX_SUFFIX = '/uvx';

/** Path suffix for uv command */
export const COMMAND_UV_SUFFIX = '/uv';

// Command arguments
/** Run subcommand for uv */
export const ARG_RUN = 'run';

/** Yes flag for npx to skip confirmation */
export const ARG_YES = '--yes';

/** Tool subcommand for uv */
export const ARG_TOOL = 'tool';

/** Install subcommand for uv tool */
export const ARG_INSTALL = 'install';

// Command flags
/** Flag prefix for command arguments */
export const FLAG_PREFIX = '-';

/** npx --package flag (long form) */
export const FLAG_PACKAGE_LONG = '--package';

/** npx -p flag (short form) */
export const FLAG_PACKAGE_SHORT = '-p';

/** Equals delimiter used in flag=value patterns */
export const EQUALS_DELIMITER = '=';

// Platform identifiers
/** Windows platform identifier */
export const PLATFORM_WIN32 = 'win32';

// Process configuration
/** Success exit code */
export const EXIT_CODE_SUCCESS = 0;

/** Stdio option to ignore stream */
export const STDIO_IGNORE = 'ignore';

/** Stdio option to pipe stream */
export const STDIO_PIPE = 'pipe';
