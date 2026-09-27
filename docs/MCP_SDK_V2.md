# MCP TypeScript SDK v2 migration

The MCP servers use the published `@modelcontextprotocol/{server,client,node,server-legacy}` 2.1.0 packages. This is an SDK upgrade, **not** a switch to a protocol version called `2`. Wire protocol versions remain date-based, negotiated with the client; existing stdio, Streamable HTTP (`/mcp`), and legacy SSE (`/sse`) interfaces remain available.

`architect-mcp`, `scaffold-mcp`, `style-system`, `one-mcp`, and the `typescript-mcp-package` generator use the split v2 APIs. `one-mcp` closes stdio children through the SDK client/transport API rather than the SDK-private `_process` field. Existing frontend HTTP sessions still own separate server instances; downstream services belong to the shared service owner.

## Observable SDK changes

- The v2 `Client.listTools`, `listResources`, and `listPrompts` helpers collect **all pages** when no cursor is passed. `one-mcp` uses those helpers, so it may expose definitions beyond the first page of a paginated downstream server. The proxy still does not expose pagination cursors in its own list responses. This differs from its v1 first-page behavior and should be reviewed before publishing if first-page parity is required.
- `one-mcp` sets `enforceStrictCapabilities: true` for its downstream and bridge clients to retain v1's unsupported-capability errors.
- SDK v2 stdio clients enforce a 10 MB read-buffer limit by default. Large images or proxy responses above that limit can close the connection; no unbounded override has been enabled.
- The stdio-to-HTTP bridge still forwards only the existing tools, resources, and prompts methods. It is not a general-purpose protocol tunnel.

## Validation

Workspace build, typecheck, tests, and lint; real v1 and v2 stdio-client handshakes against built CLIs; v2 HTTP and SSE handshakes; v2 Bun launch; an isolated v1 downstream stdio server through `one-mcp`; and generated stdio/HTTP variants were exercised on Node 24. Keep the real-client transport checks in release validation alongside the mocked unit suites.

**Node 20 release blocker:** the built CJS CLIs for style-system and architect fail on Node 20.9.0 with `ERR_REQUIRE_ESM`: `aicode-utils/dist/index.cjs` requires ESM-only `execa@9`. The style-system CLI works on Node 20.19.0. Fix CJS interop or revise supported Node engines before publishing; the current style-system `>=20.9.0` declaration is not met. Isolated packed-package checks and full bridge/downstream HTTP/SSE matrix remain release gates.

Do not enable modern protocol-era probing or remove SSE as part of this upgrade. Treat either as a separate compatibility change with its own fixtures and release plan.
