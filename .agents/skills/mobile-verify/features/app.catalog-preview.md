---
screen: /component-preview
selectors:
  - "Add example"
  - "Disabled field"
tests: []
api: []
---

# app.catalog-preview

Development preview samples exercise file renderers and primitive interactions.

## How to get to it (user POV)

- Phone: Settings → Component library → primitive sample.
- iPad: Settings → Development → component selector.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. IconButton: enabled increments Actions once; disabled/pending do not. Input: Name updates Value, multiline accepts lines, disabled cannot edit, invalid field shows its state.
2. CodeView/DiffView: long-press a line, extend to a second, clear/reselect: new range starts at the new line. DiffView switches unified/side-by-side and expands unchanged gaps.
3. MarkdownView: inspect headings/emphasis/fenced code/links; source and reader toggle; safe link returns to caller.
4. ImagePreview: zoom/pan/reset; invalid data shows readable failure. HtmlPreview: scripts leave sentinel unchanged; external images/styles do not load; safe link returns to caller; source/preview toggle.
5. Phone Back returns to catalog/Settings; iPad selects another sample/category.

Automated coverage: none named; retain the live action and readback evidence.

## Gotchas

- Development-only. Confirm sandbox absence through the sentinel/network observation, not only a screenshot.
