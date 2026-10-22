---
route: /
selectors:
  - "Review"
  - "All changes"
  - "The changes in this document could not be read."
  - "Load the changes again"
  - "Loading changes…"
tests:
  - apps/web/spec/integration/changes-diff-recovery.test.tsx
api:
  - GET /api/worktrees/:worktreeId/changes
  - POST /api/worktrees/:worktreeId/changes/diffs
---

# changes.diff-recovery

When a file changes on disk after the page read the change list but before its diff request reaches the server, the server refuses the diff with 409 (worktree changed); the page then refreshes the change list once and shows the new diff, never leaving "Loading changes…" or "The changes in this document could not be read." behind.

## How to get to it (user POV)

- Workspace → button "Review" → button "All changes" or a change row such as "README.md · unstaged", while another writer (an agent, an editor) rewrites the file at that moment. There is no control of its own; it is how every uncommitted diff document recovers.

## Driving it with browser

Preconditions: [surface baseline](README.md).

### Setup

A second tracked change makes the single-file README.md document a different diff request from the All changes one:

```sh
printf 'A second committed file.\n' > "$REPO/second.md"
git -C "$REPO" add --all && git -C "$REPO" commit -m "Add a second file"
printf 'A second changed file.\n' > "$REPO/second.md"
printf '# Sample repository\n\nAn earlier change to review.\n' > "$REPO/README.md"
```

The race needs the README.md diff request to reach the server only after the rewrite, and the page must not hear of the rewrite first: the HTTP hold keeps the diff requests waiting and the live outage keeps the live update away.

1. Navigate to `/`, then wait for '2 files'
   Expect: text "2 files".
2. Click button `Review`
   Expect: button "All changes"; rows "README.md · unstaged" and "second.md · unstaged".
3. Click button `All changes`
   Expect: the sheet closes; heading "Changes" (All changes is the document titled "Changes", the one the workspace opens on); code holding "An earlier change to review." and "A second changed file."; no "Loading changes…".
4. Click button `Review`, then hold matching `POST /api/worktrees/:worktreeId/changes/diffs` requests in the browser before they reach the server (see [routing recipes and per-map instructions](../references/failure-injection.md))
   Expect: rows "README.md · unstaged" and "second.md · unstaged" again; the browser gate is armed for the next diff POST.
5. Click button `README.md · unstaged`, then drop the live WebSocket and reject reconnects (see [routing recipes and per-map instructions](../references/failure-injection.md))
   Expect: the sheet closes; title "README.md — repository"; the URL contains `entry=change%3AREADME.md`; Inspect the accessibility tree shows "Loading changes…" while the diff request waits.
6. On disk: `printf '# Sample repository\n\nA newer change to review.\n' > "$REPO/README.md"`, then release the held HTTP requests
   Expect: the held diff request reaches the server after the rewrite.
7. Wait for text 'A newer change to review.', then inspect the accessibility tree
   Expect: code holding "A newer change to review."; "An earlier change to review.", "Loading changes…" and "The changes in this document could not be read." are absent (this happens with the live connection still down).
8. Inspect HTTP traffic
   Expect: after the release, one `POST /api/worktrees/<worktreeId>/changes/diffs` answered 409, then exactly one `GET /api/worktrees/<worktreeId>/changes` 200 and one `POST …/changes/diffs` 200 (the recovery). `[FAILED] net::ERR_ABORTED` diff lines are requests the page cancelled itself.
9. Restore the live WebSocket and wait for the app to reconnect (see [routing recipes and per-map instructions](../references/failure-injection.md))
   Expect: the live connection reconnects; the reconnect reads the list and the diff once more, both 200.

### Observable proof

New diff text appears with neither failure notice and no failed diff request left pending.

Automated coverage: `changes-diff-recovery.test.tsx`.

## Gotchas

- Hold both the diff read and live traffic; a diff-only hold can be cancelled by a live refresh. Release within 15 seconds to avoid proving timeout instead.
- “The changes in this document could not be read.”/Load the changes again after rewrite is a failure of this journey, even if retry works.
- add --all commits initial README; the later README is the deliberate rewrite.
