# Migrating from the existing Claude marketplace

The `aicode-toolkit` marketplace and its four existing plugin identifiers (`aicode-bootstrap`, `aicode-develop`, `aicode-review`, `aicode-admin`) remain. `aicode-design` is new. The marketplace entries now point to self-contained `plugins/<name>` directories rather than npm-source entries. Plugin version `0.5.0` is independent of MCP package versions.

1. Back up user-owned Claude settings, template files and local project configuration.
2. Initialize the consumer workspace interactively with `npx -y @agiflowai/aicode-toolkit@2.0.0 init --skip-mcp` **before** activating scaffold-backed servers; verify templates and project `sourceTemplate`.
3. Update the marketplace with `/plugin marketplace update aicode-toolkit`, then update/reinstall the selected plugins and restart the agent so cached assets refresh. Confirm actual namespaced command names in the client.
4. Disable duplicate manually registered scaffold/architect/style servers or duplicate `one-mcp` downstream registrations. Do not delete user configuration automatically.
5. Check `.toolkit/settings.yaml` and local settings: admin tools and external backends can remain enabled even when plugin flags omit them. No hardcoded Claude pattern/review backend is shipped in the new defaults.
6. Confirm the `/edit-with-pattern` command exists in develop; the previously advertised architecture-reviewer, test-coverage and migration-assistant agents never existed at their listed paths and are no longer advertised. Use the focused skills instead.
7. Test a representative workflow and check that the MCP process runs in your project, not the plugin cache. For review, rules-only responses require host-agent review of actual changes.

To roll back, reinstall from a previously pinned marketplace Git revision and restore **only your own** backed-up configuration, after checking that plugin versions and package binaries are compatible. This migration never runs `aicode-toolkit sync` or overwrites settings automatically. See [client status](compatibility.md) for outstanding acceptance tests.
