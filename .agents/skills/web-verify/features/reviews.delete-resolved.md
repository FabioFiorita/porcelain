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

After confirming, the reviewer deletes every resolved thread they started, for them and for the agent; a resolved thread the agent started stays, and the confirmation says so beforehand.

## How to get to it (user POV)

- Review (phone; the right sidebar on desktop) → tab "Comments" → filter button "resolved N" → button "Delete resolved" → alertdialog → "Delete" (or "Cancel").
- "Delete resolved" shows only on the "resolved" filter with at least one resolved thread, and is disabled when every resolved thread was started by the agent.

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

The agent starts a thread on README.md: `$C agent comment README.md "I kept the old heading in the changelog"`.

1. Navigate to `/`, then click button `Review`
   Expect: dialog "Worktree review" with tab "Comments".
2. Click tab `/^Comments/`
   Expect: button "Comment on the whole change"; article "Comment thread" with "I kept the old heading in the changelog" and "From the agent".
3. Click button `Comment on the whole change`, replace the contents of textbox named `Comment` with 'Split this into two commits', then click button `Comment`
   Expect: region "Comments" holding two articles "Comment thread", the agent's first and then yours with "Split this into two commits" and "Waiting for the agent", each with a button "Resolve".
4. Click button `Resolve` within region named `Comments` (match 1, in document order), then click button `Resolve` within region named `Comments`
   Expect: text "No open comments yet."; buttons "open 0" and "resolved 2".
5. Click button `/^resolved/i`
   Expect: two articles "Resolved comment thread"; button "Delete resolved" enabled.
6. Click button `Delete resolved`
   Expect: alertdialog "Delete 1 resolved thread?" with the paragraph "This deletes the resolved threads you started, with the agent's replies in them, for you and for the agent. 1 resolved thread the agent started stays, since you cannot delete what the agent wrote on its own."; buttons "Cancel" and "Delete".
7. Click button `Cancel`
   Expect: the alertdialog is gone; both resolved threads still listed.
8. Click button `Delete resolved`, then click button `Delete`
   Expect: the alertdialog is gone; buttons "open 0" and "resolved 1"; button "Delete resolved" [disabled]; the one article "Resolved comment thread" left holds "I kept the old heading in the changelog". `$C server comment-threads` lists only the agent's thread, `"resolved": true`.
9. Inspect HTTP traffic
   Expect: one `POST /api/worktrees/<id>/comments/resolved/deletion` answered 200 (step 8 only; Cancel sends nothing).

### Observable proof

Reload resolved filter and independent threads: only the agent thread remains; Delete resolved is disabled; one deletion POST/200.

Automated coverage: `reviews-delete-resolved.test.tsx`.

## Gotchas

- Delete is the confirmation action; Delete resolved opens it. Scope Resolve to Comments/first thread when both are open; the inline copy is hidden by the phone sheet.
- Use a clean thread fixture for predictable counts/handles.
