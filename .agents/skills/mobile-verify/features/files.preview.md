---
screen: /file
selectors:
  - 'Show source'
  - 'Timeline'
  - 'More actions'
  - 'Workspace changed'
  - 'Comments'
  - 'Clear selection'
tests:
  - packages/client/src/features/files/queries/text.spec.ts
  - packages/client/src/features/files/queries/asset.spec.ts
  - apps/mobile/src/features/workspace/rules/document-comment.spec.ts
api:
  - GET /api/worktrees/:worktreeId/text
  - GET /api/worktrees/:worktreeId/asset
  - GET /api/worktrees/:worktreeId/comments
  - POST /api/worktrees/:worktreeId/comments
---

# files.preview

Files opens read-only source, document and image previews for the selected worktree. A known path reads directly through the text or asset endpoint; opening it does not depend on listing its parent folder. The server decides whether the path is safe and readable.

## How to get to it (user POV)

- Worktrees → worktree → Files → tree or search → file. Native Back/swipe returns.

## Driving it with agent-device

The native top bar is the only header: it shows the file name with its folder and status on a smaller second line, and its right side holds the document actions as icons named by their accessibility labels. When more than three actions apply, the first two stay visible and the rest sit under More actions. On iOS the bar is opaque, content starts below it and nothing is drawn under the status bar; no second row of path or buttons sits beneath it.

Preconditions: [surface baseline](README.md).

1. In Settings → General, choose Documents open as → Source. Open Markdown and HTML from Files/search: both start in Source. Choose Rendered and reopen: Markdown starts in Reader and HTML in Preview; code stays source in both cases. Open code, a raster image and a small SVG from Files/search. Expect the file name as the title, its folder beneath it and the content below the bar; Show source / Show rendered (HTML: Show preview) is a top-bar action; SVG shows literal source. Binary, oversized, symlink, submodule and unavailable files explain why unavailable without following disk links. Return by Back/swipe.
2. Switch workspace with a file open (select another worktree from the Worktrees tab while the file stays in another stack). The old route says Workspace changed and never displays another worktree's content.
3. Tap a source line, another to extend, then Clear selection from the top bar (under More actions when four actions apply) and reselect. Post/cancel through the Comments top-bar action with code visible; Timeline opens the file timeline. Read source fingerprint/range independently. Native Back guards unsent drafts.
4. General → Long lines → Scroll. Open text with a short first line and longer later line; drag horizontally and release: position stays within content, without springing to the start. Scroll vertically to another long line; horizontal range must not depend on the first visible row. Rotate the tablet between landscape and portrait and repeat. Wrap reflows within current width.
5. Repeat scrolling/wrapping on Review and History diffs with gutters, merge parents, styled tokens, Unicode and tabs.
6. Seed a disposable `wide/` folder with 2,001 visible entries, including a small `target.txt` and decodable `target.png`. Confirm that listing `wide/` is refused while the individual text and asset reads succeed. Search for each exact path and open it, then repeat from a saved pin and a direct file link without expanding the folder. Expect content and native Back to the entry surface despite the directory limit. Repeat with a normal-size parent and an empty text file. Remove the target or replace it with a symlink, directory or submodule: reopen and expect the server's not-found or refusal reason, never the linked contents. Restore a regular file and retry; content recovers. Repeat light and dark.
7. Open a long plain code Files document and scroll to a named line. Close it, switch workspace and back, and reopen it: the plain code reader returns to the same reading line. Scroll positions belong to each workspace/path independently. Reopen after a content refresh and ensure the reading line is bounded by the current file. Markdown/HTML/image preview positions are outside this plain-code retention check.
8. On Android, repeat Files Markdown Reader → Source → Review file → History commit diff → Settings theme → Files → reopen Markdown for five cycles, moving between them through the Worktree screen. Include an image preview and empty source, then repeat after changing the system font scale. Each native renderer must draw after returning, preserve its assigned bounds and remain interactive. Retain per-cycle results and bounded logcat; `Cannot locate windowRecomposer` is a failure even if the app recovers.

Automated coverage: `text.spec.ts` and `asset.spec.ts` cover the client reads and server refusals; `document-comment.spec.ts` covers comment targets. Device journeys prove rendering and navigation.

## Gotchas

- Files has no Edit action. Linked local HTML assets are not included; bitmap preview requires decodable raster data.
- iOS native geometry/gesture changes need a matching rebuilt client; compilation alone does not prove them.
