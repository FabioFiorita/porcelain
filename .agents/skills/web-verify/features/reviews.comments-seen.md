---
route: /$projectId/$worktreeId
selectors:
  - "Review"
  - "Comments"
  - "Changes"
  - "Toggle Sidebar"
  - "Projects and worktrees"
  - "Agent replied"
tests:
  - apps/web/spec/integration/reviews-comments-seen.test.tsx
api:
  - POST /api/worktrees/:worktreeId/comments/seen
---

# reviews.comments-seen

Showing the comment list marks the agent's comments as seen and clears the worktree's "Agent replied" flag; an agent comment seen only inline in the code keeps the flag until the list shows it.

## Sub-features

- `reviews.comments-seen` — Seen state and unread comments.

## How to get to it (user POV)

- Review (phone; the right sidebar on desktop) → tab "Changes" → tab "Comments". The list marks comments seen once every filter that has threads ("open", and "resolved" when it has any) has been shown since the threads last changed.
- The flag is the dot with img name "Agent replied" on the worktree row in navigation "Projects and worktrees" (behind "Toggle Sidebar" at phone width).

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

The agent comments on README.md: `$C agent comment README.md "I added a line to the readme"`. `$C server project` reads the flag back: the main worktree's `"status": "replied"` while it is raised, and no `status` once cleared.

1. Navigate to `/`, then wait for 'I added a line to the readme'
   Expect: the comment inline under README.md, with the badge text "From the agent".
2. Click button `Toggle Sidebar`
   Expect: navigation "Projects and worktrees" with the main worktree row (button "main <repository path> repository Agent replied Main worktree") holding img "Agent replied". Then Press `Escape`.
3. Click button `Review`, then click tab `Changes`, then click tab `/^Comments/`
   Expect: dialog "Worktree review" with tab "Comments 1" selected; region "Comments" listing "I added a line to the readme" with "From the agent".
4. Inspect HTTP traffic
   Expect: `POST /api/worktrees/<id>/comments/seen` answered 200.
5. Press `Escape`, then click button `Toggle Sidebar`
   Expect: dialog "Worktree review" is gone; the worktree row no longer has img "Agent replied"; `$C server project` shows no `status` on the worktree. Then Press `Escape`.
6. `$C agent comment README.md "I also checked the other files"`, then wait for '/I also checked the other files/'
   Expect: the new comment inline under README.md; `$C server project` shows `"status": "replied"` again, and click button `Toggle Sidebar` shows img "Agent replied" back (seen only inline does not clear it). Then Press `Escape`.
7. Click button `Review`, then click tab `/^Comments/`
   Expect: tab "Comments 2" selected listing "I also checked the other files"; a newer `POST .../comments/seen` answered 200 in network log; `$C server project` shows no `status` again.

### Observable proof

Reload after viewing comments: Agent replied dot stays absent. Each seen POST answers 200; newer replies seen only inline restore the dot.

Automated coverage: `reviews-comments-seen.test.tsx`.

## Gotchas

- Seen POST may occur twice, both 200. With resolved threads, show both open/resolved filters before expecting seen state.
- At phone width close navigator with Escape before opening Review.
