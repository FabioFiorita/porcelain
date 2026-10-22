---
screen: /files
selectors:
  - 'Show inspector'
  - 'Hide inspector'
  - 'Files'
  - 'Review'
  - 'History'
  - 'Open documents'
  - 'Choose a document'
tests:
  - apps/mobile/src/shared/rules/workspace-documents.spec.ts
  - apps/mobile/src/shared/rules/document-tabs.spec.ts
  - apps/mobile/src/shared/rules/document-tab-layout.spec.ts
  - apps/mobile/src/shared/rules/workspace-session.spec.ts
api:
  - GET /api/inventory
---

# app.workspace

Each iPad worktree retains its central document tabs and inspector selection when the user leaves and returns.

## How to get to it (user POV)

- iPad workspace sidebar → worktree; Files, Review and History inspector modes → central document tabs.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. In iPad landscape open a Files document, Review changed file, History commit and commit diff. All use one central tab strip; reopening activates the existing tab. Close active/inactive tabs; selection follows the remaining document. Inspector mode switches preserve tabs, active document, search and expanded folders without pushing native routes.
2. Zero tabs shows No open tabs/Choose a document without a scroller. One/fitting tabs do not scroll. Open enough, including a long filename, to overflow: active tab scrolls into view, horizontal swipe reaches others and only its tab has the focus underline. Close below the threshold: scrolling stops. Toggle sidebar, rotate/resize and enlarge Dynamic Type: remeasured tabs keep selection visible and both pane controls reachable.
3. Open Uncommitted and Branch/base reviews: each tab retains its captured comparison when the inspector changes. Commit tabs retain parent; diffs distinguish commit, parent and path. Independently change files: stale marks/No longer changed appear without leaking another worktree's content.
4. Settings and back retain tabs, active document, inspector mode/comparison/visibility. Switch worktrees with different documents and back, then fully reload: each worktree restores its own saved session and pane selections.
5. Hide/show inspector. Wide shows it beside the document; narrow replaces center in place. Selecting a document or existing tab reveals content under the persistent header. Open/cancel comments with code visible; unsent/pending drafts guard tab changes/close, Settings and worktree switches. Read marks/anchors independently.
6. Files inspector's single-tap plus menu opens New file/New folder sheets; Cancel returns unchanged. Healthy iPad workspace/navigator has no routine refresh buttons; live updates work and errors retain recovery. Phones retain refresh controls.

Automated coverage: `workspace-documents.spec.ts`, `document-tabs.spec.ts`, `document-tab-layout.spec.ts`, `workspace-session.spec.ts`.

## Gotchas

- Files is read-only. This iPad map needs landscape, portrait/narrow and larger-type proof; phone navigation does not establish it.
- Use destination maps for fixtures, unsupported files, stale comments, merge parents and recovery. The header has no placeholder Git controls.
