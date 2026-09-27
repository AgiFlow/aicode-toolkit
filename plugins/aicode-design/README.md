# aicode-design

Explore themes, classes and existing components with the [discover-design-system](skills/discover-design-system/SKILL.md) skill; preview selected components with [preview-component](skills/preview-component/SKILL.md). Backed by `@agiflowai/style-system` over stdio.

Use Node.js 22.12+ and run the MCP process in your **consumer workspace**, not the plugin cache. Component discovery and preview require appropriate `project.json` design configuration, available component/stories, and Chromium. Rendering executes consumer component code, bundlers and a browser: preview only trusted projects with approval. Do not enable `--dev` by default; HTTP/SSE transports are not supported.

**Release limitation:** the published style-system `0.2.0` ignores input arguments to `list_themes` and `list_shared_components`. This repository fixes dispatch, but a new npm release must contain that fix before the plugin pin can be updated. Until then, do not rely on filters or pagination for those two tools. See [compatibility status](https://github.com/AgiFlow/aicode-toolkit/tree/main/docs/plugins/compatibility.md).
