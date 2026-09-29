---
name: discover-design-system
description: 'Discover existing project themes, supported CSS classes and reusable UI components. Trigger for frontend styling or component-selection requests. Do not trigger for unrelated backend changes or executing visual previews.'
---

# Discover the design system

1. Confirm the consumer workspace has suitable project design configuration. Inspect the actual available schemas for `list_themes`, `get_css_classes`, `list_shared_components` and `list_app_components` (snake_case names), rather than inventing arguments.
2. Look for existing shared and app components, then supported themes and classes before suggesting new markup or CSS. Pass the requested app path, tags and pagination cursor where supported. Until a style-system release with argument forwarding is published, `list_themes` and `list_shared_components` may ignore filters in the published `0.2.0`; check results manually.
3. Give the user concrete candidates with source paths, relevant classes and uncertainty. Do not execute `get_component_visual` without a trusted-workspace check: it runs consumer code and build tools.
