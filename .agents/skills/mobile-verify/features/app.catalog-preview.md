---
screen: /component-preview
selectors:
  - "Add example"
  - "Disabled field"
tests: []
api: []
---

# app.catalog-preview

Development-only primitive samples reached through Settings, Component library. All catalog routes are protected by `__DEV__` and unavailable in release builds.

1. Open IconButton. Enabled examples increment Actions once; disabled and pending examples do not.
2. Return and open Input. Type into Name and confirm Value updates; multiline accepts multiple lines.
3. Inspect invalid and disabled fields. Disabled content cannot be edited.
4. Open CodeView and DiffView. Long press a line and extend the controlled selection to a second line. Clear selection, then select a new line; its range starts at that line. DiffView also switches unified/side-by-side layout and expands unchanged gaps.
5. Open MarkdownView. Inspect headings, nested emphasis, fenced code and links. Toggle source and return to rendered content; safe links return to the caller.
6. Open ImagePreview. Zoom, pan and reset the image; invalid data shows the readable failure state.
7. Open HtmlPreview. Scripts leave the disabled-script sentinel unchanged, and external images and styles do not load. Follow the safe link and confirm the caller receives it. Toggle source, then return to rendered content.
8. Return through the native stack to Component library and Settings.
