---
route: /$projectId/$worktreeId
selectors:
  - "Review"
  - "Comments"
  - "Toggle Sidebar"
  - "Projects and worktrees"
  - "The agent replied"
tests:
  - apps/web/spec/integration/reviews-comments-seen.test.tsx
api:
  - POST /api/worktrees/:worktreeId/comments/seen
---

# reviews.comments-seen

## What it is

Showing the comment list marks the agent's comments as seen and clears the worktree's "The agent replied" flag; an agent comment seen only inline in the code keeps the flag until the list shows it.

## How a user reaches it

- Review (phone; the right sidebar on desktop) → tab "Comments". The list marks comments seen once every filter that has threads ("open", and "resolved" when it has any) has been shown since the threads last changed.
- The flag is the dot with img name "The agent replied" on the worktree row in navigation "Projects and worktrees" (behind "Toggle Sidebar" at phone width).

## Driving it

Start with `.agents/skills/web-verify/scripts/cli start`.

### Setup

Unreachable through the CLI: both agent comments need `cli agent comment README.md "I added a line to the readme"` (before step 1) and `cli agent comment README.md "I also checked the other files"` (at step 6). The reviewer's steps are below, written for when that gap is filled. Reading the flag back from the server needs `cli server project` (the main worktree's `status`), or use the navigator dot as below.

1. `.agents/skills/web-verify/scripts/cli open /`
   Look for: the text "I added a line to the readme" inline under README.md (badge "From the agent").
2. `.agents/skills/web-verify/scripts/cli click --role button --name "Toggle Sidebar"`
   Look for: navigation "Projects and worktrees" with the main worktree row (button starting "main") holding img "The agent replied". Then `.agents/skills/web-verify/scripts/cli press Escape`.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"` then `.agents/skills/web-verify/scripts/cli click --role tab --name "/^Comments/"`
   Look for: dialog "Worktree review" listing "I added a line to the readme"; tab "Comments 1".
4. `.agents/skills/web-verify/scripts/cli network`
   Look for: `POST /api/worktrees/<id>/comments/seen` answered 200.
5. `.agents/skills/web-verify/scripts/cli press Escape` then `.agents/skills/web-verify/scripts/cli click --role button --name "Toggle Sidebar"`
   Look for: dialog "Worktree review" is gone; the worktree row no longer has img "The agent replied". Then `.agents/skills/web-verify/scripts/cli press Escape`.
6. CLI gap: `cli agent comment README.md "I also checked the other files"`.
   Look for: the text "I also checked the other files" inline under README.md; "Toggle Sidebar" shows img "The agent replied" again (seen only inline does not clear it).
7. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"` then `.agents/skills/web-verify/scripts/cli click --role tab --name "/^Comments/"`
   Look for: the list shows "I also checked the other files"; a second `POST .../comments/seen` answered 200 in `network`; the navigator dot is gone again.

## What proves it works

- The navigator dot "The agent replied" disappears after the list shows the comments (steps 5 and 7) and comes back after a newer agent comment seen only inline (step 6); each list view sends a 200 `POST .../comments/seen`.
- Persistence: `open /` after step 5 still shows no "The agent replied" dot, since the server holds the seen revision.
- `apps/web/spec/integration/reviews-comments-seen.test.tsx`: after an agent comment `server.project()` reads worktree status `replied` and stays so while the comment shows only inline; showing Comments clears it to undefined; Escape closes the dialog; a second agent comment raises `replied` again until Comments shows it.

## Gotchas

- Unreachable through the CLI: agent comments need `cli agent comment <path> "<body>"`; without them there is no flag to clear and nothing to mark seen.
- With resolved threads present, the list marks seen only after both the "open" and the "resolved" filter were shown; click button `/^resolved/i` too.
- At phone width the navigator is a sheet behind "Toggle Sidebar"; close it with `Escape` before clicking "Review".
