---
screen: /file
selectors:
  - 'Show source'
  - 'Workspace changed'
  - 'Comments'
  - 'Clear selection'
tests:
  - apps/mobile/spec/file-screen.spec.ts
  - packages/client/src/features/files/queries/text.spec.ts
  - packages/client/src/features/files/queries/asset.spec.ts
  - apps/mobile/src/features/reviews/rules/document-comment.spec.ts
api:
  - GET /api/worktrees/:worktreeId/text
  - GET /api/worktrees/:worktreeId/asset
  - GET /api/worktrees/:worktreeId/comments
  - POST /api/worktrees/:worktreeId/comments
---

# files.preview

Files opens read-only source, document and image previews for the selected worktree. A known path reads directly through the text or asset endpoint; opening it does not depend on listing its parent folder. The server decides whether the path is safe and readable.

## How to get to it (user POV)

- Files tree or search → file. Native Back returns on phones; iPad uses document tabs.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. In Settings → General, choose Documents open as → Source. Open Markdown and HTML from Files/search: both start in Source. Choose Rendered and reopen: Markdown starts in Reader and HTML in Preview; code stays source in both cases. Open code, a raster image and a small SVG from Files/search. Expect filename/path and content; SVG shows literal source. Binary, oversized, symlink, submodule and unavailable files explain why unavailable without following disk links. Return by Back/swipe on phone or document tabs/narrow panel on iPad.
2. Switch workspace with a file open. Phone's old route says Workspace changed; iPad restores that worktree's document session. Neither displays another worktree's content.
3. From the compact path toolbar tap a source line, another to extend, Clear selection and reselect. Post/cancel through Comments with code visible. Read source fingerprint/range independently. Native Back guards unsent drafts.
4. General → Long lines → Scroll. Open text with a short first line and longer later line; drag horizontally and release: position stays within content, without springing to the start. Scroll vertically to another long line; horizontal range must not depend on the first visible row. Toggle iPad panel and repeat. Wrap reflows within current width.
5. Repeat scrolling/wrapping on Review and History diffs with gutters, merge parents, styled tokens, Unicode and tabs.
6. Seed a disposable `wide/` folder with 2,001 visible entries, including a small `target.txt` and decodable `target.png`. Confirm that listing `wide/` is refused while the individual text and asset reads succeed. Search for each exact path and open it, then repeat from a saved pin and a direct file link without expanding the folder. Expect content and native Back to the entry surface despite the directory limit. Repeat with a normal-size parent and an empty text file. Remove the target or replace it with a symlink, directory or submodule: reopen and expect the server's not-found or refusal reason, never the linked contents. Restore a regular file and retry; content recovers. Repeat light and dark.

Automated coverage: `file-screen.spec.ts` checks the screen's reader dependencies; `text.spec.ts` and `asset.spec.ts` cover the client reads and server refusals; `document-comment.spec.ts` covers comment targets. Device journeys prove rendering and navigation.

## Gotchas

- Files has no Edit action. Linked local HTML assets are not included; bitmap preview requires decodable raster data.
- iOS native geometry/gesture changes need a matching rebuilt client; compilation alone does not prove them.
