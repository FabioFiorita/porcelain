---
screen: /file
selectors:
  - 'Show source'
  - 'Workspace changed'
  - 'Comments'
  - 'Clear selection'
tests:
  - apps/mobile/src/features/reviews/rules/document-comment.spec.ts
api:
  - GET /api/worktrees/:worktreeId/directory
  - GET /api/worktrees/:worktreeId/text
  - GET /api/worktrees/:worktreeId/asset
  - GET /api/worktrees/:worktreeId/comments
  - POST /api/worktrees/:worktreeId/comments
---

# files.preview

Files opens read-only source, document and image previews for the selected worktree.

## Sub-features

- `files.preview` — Source, document and image previews.

## How to get to it (user POV)

- Files tree or search → file. Native Back returns on phones; iPad uses document tabs.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Open code, Markdown reader/source, HTML preview/source, a raster image and a small SVG from Files/search. Expect filename/path and content; SVG shows literal source. Binary, oversized, symlink, submodule and unavailable files explain why unavailable without following disk links. Return by Back/swipe on phone or document tabs/narrow inspector on iPad.
2. Switch workspace with a file open. Phone's old route says Workspace changed; iPad restores that worktree's document session. Neither displays another worktree's content.
3. From the compact path toolbar tap a source line, another to extend, Clear selection and reselect. Post/cancel through Comments with code visible. Read source fingerprint/range independently. Native Back guards unsent drafts.
4. General → Long lines → Scroll. Open text with a short first line and longer later line; drag horizontally and release: position stays within content, without springing to the start. Scroll vertically to another long line; horizontal range must not depend on the first visible row. Toggle iPad inspector and repeat. Wrap reflows within current width.
5. Repeat scrolling/wrapping on Review and History diffs with gutters, merge parents, styled tokens, Unicode and tabs.

Automated coverage: `document-comment.spec.ts`.

## Gotchas

- Files has no Edit action. Linked local HTML assets are not included; bitmap preview requires decodable raster data.
- iOS native geometry/gesture changes need a matching rebuilt client; compilation alone does not prove them.
