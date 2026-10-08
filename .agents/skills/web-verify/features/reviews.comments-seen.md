---
route: /$projectId/$worktreeId
selectors:
  - "Review"
  - "Comments"
  - "Changes"
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

- Review (phone; the right sidebar on desktop) → tab "Changes" → tab "Comments". The list marks comments seen once every filter that has threads ("open", and "resolved" when it has any) has been shown since the threads last changed.
- The flag is the dot with img name "The agent replied" on the worktree row in navigation "Projects and worktrees" (behind "Toggle Sidebar" at phone width).

## Driving it

`$C start`; pair your browser using the card’s pairing-link command.

### Setup

The agent comments on README.md: `$C agent comment README.md "I added a line to the readme"`. `$C server project` reads the flag back: the main worktree's `"status": "replied"` while it is raised, and no `status` once cleared.

1. Navigate to `/` on the card’s web URL (full page load), then wait for text 'I added a line to the readme' to be visible
   Look for: the comment inline under README.md, with the badge text "From the agent".
2. Click button named `Toggle Sidebar`
   Look for: navigation "Projects and worktrees" with the main worktree row (button "main <repository path> repository The agent replied Main worktree") holding img "The agent replied". Then Press `Escape`.
3. Click button named `Review`, then click tab named `Changes`, then click tab named `/^Comments/`
   Look for: dialog "Worktree review" with tab "Comments 1" selected; region "Comments" listing "I added a line to the readme" with "From the agent".
4. Inspect HTTP requests and responses
   Look for: `POST /api/worktrees/<id>/comments/seen` answered 200.
5. Press `Escape`, then click button named `Toggle Sidebar`
   Look for: dialog "Worktree review" is gone; the worktree row no longer has img "The agent replied"; `$C server project` shows no `status` on the worktree. Then Press `Escape`.
6. `$C agent comment README.md "I also checked the other files"`, then wait for text '/I also checked the other files/' to be visible
   Look for: the new comment inline under README.md; `$C server project` shows `"status": "replied"` again, and click button named `Toggle Sidebar` shows img "The agent replied" back (seen only inline does not clear it). Then Press `Escape`.
7. Click button named `Review`, then click tab named `/^Comments/`
   Look for: tab "Comments 2" selected listing "I also checked the other files"; a newer `POST .../comments/seen` answered 200 in the browser network log; `$C server project` shows no `status` again.

## What proves it works

- The navigator dot "The agent replied" disappears after the list shows the comments (steps 5 and 7) and comes back after a newer agent comment seen only inline (step 6); each list view sends a 200 `POST .../comments/seen`.
- Persistence: a full reload of `/` after step 5 still shows no "The agent replied" dot, since the server holds the seen revision.
- `apps/web/spec/integration/reviews-comments-seen.test.tsx`: after an agent comment `server.project()` reads worktree status `replied` and stays so while the comment shows only inline; showing Comments clears it to undefined; Escape closes the dialog; a second agent comment raises `replied` again until Comments shows it.

## Gotchas

- The list may send `POST .../comments/seen` twice per view; each answers 200.
- With resolved threads present, the list marks seen only after both the "open" and the "resolved" filter were shown; click button `/^resolved/i` too.
- At phone width the navigator is a sheet behind "Toggle Sidebar"; close it with `Escape` before clicking "Review".
