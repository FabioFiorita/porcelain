---
route: /
selectors:
  - "Review"
  - "Review layer "
  - "as reviewed"
  - "as unreviewed"
tests:
  - apps/web/spec/integration/reviews-layer-file-mark.test.tsx
  - apps/web/spec/integration/reviews-layer-shortcuts.test.tsx
api:
  - DELETE /api/worktrees/:worktreeId/reviewed
  - DELETE /api/worktrees/:worktreeId/reviewed-bulk
  - GET /api/worktrees/:worktreeId/reviewed
  - PUT /api/worktrees/:worktreeId/reviewed
  - PUT /api/worktrees/:worktreeId/reviewed-bulk
---

# reviews.layer-file-mark

## What it is

A walkthrough's Code view is a continuous document of the full current changes in its files. Each file has its own reviewed control. Layer understanding is marked independently. Selecting a graph node opens its complete file in a dialog, where its individual reviewed control is available. Existing-context excerpts have no whole-file marks.

## Driving it

`$C start`; pair a fresh browser using the card. `$C agent publish-review "Readme layer"`.

1. Open Review → Review tab → Readme layer. In region "Review layer Readme layer", expect Code selected and the full README.md diff with "Mark README.md as reviewed".
2. Mark the file. Expect "Unmark README.md as unreviewed" and `$C server reviewed-files` includes README.md. The layer remains unmarked in `$C server reviewed-layers`.
3. Unmark the file. The server mark disappears.
4. Select Graph → New line. The New line dialog shows the complete README.md diff and its file mark. Merely selecting the node does not mark the file reviewed. Expand Agent note · New line: "A line is added" appears once, in the body.
5. Mark the selected file. The reviewed-files readback contains README.md and the layer remains unmarked. Close the dialog: Graph stays selected. Full layer diff restores every file in Code.
6. With `$C start --review-sample`, open Invite a teammate. Scroll through all six changed files, including the Specs boundary when the setting is on, and the existing actor context at the bottom. Collapse individual files, use Collapse all and Expand all, mark one file and then the layer. Repeat at phone width. At phone width, select the walkthrough inside the Worktree review dialog. Press J then R and wait for the next changed file’s Unmark control to become enabled before checking saved state: only that file is marked; context snippets register no shortcuts.

## What proves it works

The integration spec checks persisted individual marks independently of layer marks, and graph-dialog navigation. Live driving checks the multi-file document, notes and context footer.

## Gotchas

Layer progress measures walkthroughs understood independently of file marks and explanation coverage. Code shows every current change in a walkthrough's files; Graph shows authored code locations. Agent notes are collapsed and are explicitly stale if their source changed.
