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

Open a file from Files or search. On phone, the native stack shows its filename, full path and back button. On iPad, the same file contents render in the active document tab without changing the native Files title or adding native Back, including in narrow windows. Source uses CodeView; Markdown, self-contained HTML and images use the existing native previews. Reader/source controls remain Porcelain controls. Binary, oversized, symlink, submodule and unavailable files have explicit notices; links are not followed on disk. Linked local HTML assets are not yet included.

Drive a code file, Markdown reader/source, an image and HTML preview/source. On phone, return with the native back button or swipe. On iPad, switch and close document tabs, or return to the directory in a narrow window. Select another workspace while a file is open: a stale phone route must say Workspace changed; iPad switches to that worktree’s document session. Neither layout may display contents from a different worktree.

Files are read-only on iPhone and iPad; there is no Edit action or editor route. SVG uses the source viewer; native bitmap previews are for decodable raster assets. Open a small SVG and confirm its literal source. On both devices, the compact path toolbar keeps Comments beside the code, including whole-file and source-line feedback. Long-press a source line, extend the selection, then post or cancel a comment without covering the code. Native Back on phone retains the unsent-draft discard confirmation. Verify the saved source fingerprint and range through the server.

In Appearance, select Long lines → Scroll. Open source with a short first line and a much longer later line. Drag horizontally past the document viewport and release: the position must stay within the scrolled content instead of springing back to the start. Open and close the iPad inspector and repeat; also scroll vertically to a later long line and confirm the horizontal range does not depend on the first visible row. Select Wrap and confirm every line reflows within the current document width. Repeat on a Review and History diff, with line numbers, merge comparison parents, styled tokens, Unicode and tabs. The shared iOS renderer sizes its lazy stack from all rendered row widths, including gutters, diff markers and gaps; native geometry and gestures require a matching rebuilt development client. Compilation alone does not prove these interactions.

Earlier Files phone evidence opens real source. The document-tab layout needs a fresh native walkthrough. iPad, Android and physical-device Local Network permission remain unproved until driven.
