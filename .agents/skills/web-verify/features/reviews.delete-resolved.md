---
route: /$projectId/$worktreeId
selectors:
  - "Review"
  - "Comments"
  - "Comment on the whole change"
  - "Comment"
  - "Resolve"
  - "Delete resolved"
  - "Cancel"
  - "Delete"
  - "Nothing resolved yet."
  - "the agent started"
tests:
  - apps/web/spec/integration/reviews-delete-resolved.test.tsx
api:
  - GET /api/worktrees/:worktreeId/comments
  - POST /api/worktrees/:worktreeId/comments
  - POST /api/worktrees/:worktreeId/comments/:threadId/replies
  - POST /api/worktrees/:worktreeId/comments/resolved/deletion
  - PUT /api/worktrees/:worktreeId/comments/:threadId/resolution
---

# reviews.delete-resolved

## What it is

After confirming, the reviewer deletes every resolved thread they started, for them and for the agent; a resolved thread the agent started stays, and the confirmation says so beforehand.

## How a user reaches it

- Review (phone; the right sidebar on desktop) → tab "Comments" → filter button "resolved N" → button "Delete resolved" → alertdialog → "Delete" (or "Cancel").
- "Delete resolved" shows only on the "resolved" filter with at least one resolved thread, and is disabled when every resolved thread was started by the agent.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start`.

### Setup

The agent starts a thread on README.md: `$C agent comment README.md "I kept the old heading in the changelog"`.

1. `$C open /`, then `$C click --role button --name "Review"`
   Look for: dialog "Worktree review" with tab "Comments".
2. `$C click --role tab --name "/^Comments/"`
   Look for: button "Comment on the whole change"; article "Comment thread" with "I kept the old heading in the changelog" and "From the agent".
3. `$C click --role button --name "Comment on the whole change"`, `$C fill --role textbox --name "Comment" "Split this into two commits"`, then `$C click --role button --name "Comment"`
   Look for: region "Comments" holding two articles "Comment thread", the agent's first and then yours with "Split this into two commits" and "Waiting for the agent", each with a button "Resolve".
4. `$C click --within-role region --within-name "Comments" --role button --name "Resolve" --nth 0`, then `$C click --within-role region --within-name "Comments" --role button --name "Resolve"`
   Look for: text "No open comments yet."; buttons "open 0" and "resolved 2".
5. `$C click --role button --name "/^resolved/i"`
   Look for: two articles "Resolved comment thread"; button "Delete resolved" enabled.
6. `$C click --role button --name "Delete resolved"`
   Look for: alertdialog "Delete 1 resolved thread?" with the paragraph "This deletes the resolved threads you started, with the agent's replies in them, for you and for the agent. 1 resolved thread the agent started stays, since you cannot delete what the agent wrote on its own."; buttons "Cancel" and "Delete".
7. `$C click --role button --name "Cancel"`
   Look for: the alertdialog is gone; both resolved threads still listed.
8. `$C click --role button --name "Delete resolved"`, then `$C click --role button --name "Delete"`
   Look for: the alertdialog is gone; buttons "open 0" and "resolved 1"; button "Delete resolved" [disabled]; the one article "Resolved comment thread" left holds "I kept the old heading in the changelog". `$C server comment-threads` lists only the agent's thread, `"resolved": true`.
9. `$C network`
   Look for: one `POST /api/worktrees/<id>/comments/resolved/deletion` answered 200 (step 8 only; Cancel sends nothing).

## What proves it works

- Step 8's list with only the agent's thread, the disabled "Delete resolved", the server's thread list and step 9's single 200 deletion request.
- Persistence: `$C open /`, "Review", tab `/^Comments/`, button `/^resolved/i` still lists only the agent's thread.
- `apps/web/spec/integration/reviews-delete-resolved.test.tsx`: with an agent thread and a reviewer thread both resolved, the dialog reads "Delete 1 resolved thread?" and "1 resolved thread the agent started stays"; Cancel keeps everything; Delete removes only the reviewer thread, `server.commentThreads()` keeps only the agent thread, and "Delete resolved" is disabled.

## Gotchas

- "Delete" (in the alertdialog) and "Delete resolved" are different exact names; "Delete" exists only while the alertdialog is open.
- With both threads open, `--name "Resolve"` alone matches two buttons and the click is refused (strict mode); step 4 scopes it to region "Comments" and picks the first with `--nth 0`, after which one is left. The agent thread's inline copy under README.md is behind the modal sheet and not addressable while it is open.
- Threads left by other features make "Resolve" ambiguous too. `stop` and `start` for a clean instance.
