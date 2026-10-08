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
api:
  - DELETE /api/worktrees/:worktreeId/reviewed
  - DELETE /api/worktrees/:worktreeId/reviewed-bulk
  - GET /api/worktrees/:worktreeId/reviewed
  - PUT /api/worktrees/:worktreeId/reviewed
  - PUT /api/worktrees/:worktreeId/reviewed-bulk
---

# reviews.layer-file-mark

## What it is

Walkthrough code is explicitly an excerpt. It cannot mark an entire file reviewed. Opening all changes in that file restores the ordinary file review control, persisted by the server.

## How a user reaches it

Review → Review tab → a walkthrough → Show all changes in this file.

## Driving it

`$C start`; pair a fresh browser using the card. `$C agent publish-review "Readme layer"`.

1. Open Review and its Review tab, then choose the button containing "Readme layer".
2. In region "Review layer Readme layer", inspect article "Step New line". The code says "Changed code · Excerpt · Line 3". There is no "Mark README.md as reviewed" button.
3. Click "Show all changes in this file". The file's complete changes open as a separate document.
4. Click "Mark README.md as reviewed". Expect "Unmark README.md as unreviewed" and `$C server reviewed-files` to include README.md. The PUT reviewed endpoint returns 200.
5. Click "Unmark README.md as unreviewed". The mark control returns and the server mark disappears. The DELETE reviewed endpoint returns 200.
6. Return to the walkthrough tab. The excerpt still has no whole-file mark control. At phone width, both the source scope and full-changes action remain reachable.

## What proves it works

The named integration spec checks that an excerpt has no file mark, then opens the complete changes and verifies both mark and unmark through server readbacks. Live driving additionally checks the phone layout and return path.

## Gotchas

Layer progress measures walkthroughs understood, independently of file marks and explanation coverage. `R` only marks a file in its ordinary complete changes document; it cannot mark a file from an excerpt.
