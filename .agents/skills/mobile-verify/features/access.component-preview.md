---
screen: /component-preview
selectors:
  - "Add example"
  - "Disabled field"
tests:
  - apps/mobile/spec/e2e/component-library.e2e.ts
api: []
---

# access.component-preview

Development-only primitive samples reached through Settings, Component library. All catalog routes are protected by `__DEV__` and unavailable in release builds.

1. Open IconButton. Enabled examples increment Actions once; disabled and pending examples do not.
2. Return and open Input. Type into Name and confirm Value updates; multiline accepts multiple lines.
3. Inspect invalid and disabled fields. Disabled content cannot be edited.
4. Return through the native stack to Component library and Settings.

The catalog spec covers native navigation and file actions. Other primitive variants are driven manually on the development simulator.
