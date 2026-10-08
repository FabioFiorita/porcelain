---
route: /
selectors:
  - "Review"
  - "Review layer "
  - "as reviewed"
  - "as unreviewed"
  - "Show all changes in this file"
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

A walkthrough's Code view is a continuous document of the full current changes in its files. Each file has its own reviewed control. Layer understanding is marked independently. Graph-selected snippets remain explicitly scoped excerpts without whole-file marks.

## Driving it

`$C start`; pair a fresh browser using the card. `$C agent publish-review "Readme layer"`.

1. Open Review → Review tab → Readme layer. In region "Review layer Readme layer", expect Code selected and the full README.md diff with "Mark README.md as reviewed".
2. Mark the file. Expect "Unmark README.md as unreviewed" and `$C server reviewed-files` includes README.md. The layer remains unmarked in `$C server reviewed-layers`.
3. Unmark the file. The server mark disappears.
4. Select Graph → New line. Region "Selected step code" says "Changed code · Excerpt · Line 3" and has no whole-file mark. Expand Agent note: "A line is added" appears once, in the body.
5. Show all changes in this file opens its complete diff and restores the file mark. Return through the walkthrough tab. Code restores all files, not a single selected step.
6. With `$C start --review-sample`, open Invite a teammate. Scroll through all six changed files, including the Specs boundary when the setting is on, and the existing actor context at the bottom. Collapse individual files, use Collapse all and Expand all, mark one file and then the layer. Repeat at phone width. Press J then R: only the next changed file is marked; context snippets register no shortcuts.

## What proves it works

The integration spec checks persisted individual marks independently of layer marks, and graph excerpt scope. Live driving checks the multi-file document, notes and context footer.

## Gotchas

Layer progress measures walkthroughs understood independently of file marks and explanation coverage. Code shows every current change in a walkthrough's files; Graph shows authored code locations. Agent notes are collapsed and are explicitly stale if their source changed.
