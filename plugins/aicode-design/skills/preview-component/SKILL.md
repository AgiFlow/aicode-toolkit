---
name: preview-component
description: 'Render and inspect a design-system component in a trusted project. Trigger for explicit visual component preview requests. Do not trigger for simple theme/class lookup or untrusted repositories.'
---

# Preview a component safely

1. Confirm the user trusts the consumer repository. `get_component_visual` can execute its components, Storybook/build tooling and browser processes; do not treat it as passive file inspection.
2. Check `project.json` design configuration, relevant stories/components and Chromium availability. If setup is absent, explain what is required rather than guessing or installing browser binaries silently.
3. Discover candidates with `list_shared_components` / `list_app_components`, inspect the actual `get_component_visual` input schema, then ask before rendering and run in the consumer workspace. The MCP server supports stdio; do not start it using HTTP/SSE or `--dev` by default.
4. Report the preview output and component path, rendering errors, any executed code and remaining manual verification. Never claim a visual check succeeded when browser setup or component rendering failed.
