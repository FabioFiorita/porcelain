# Worktree review navigation

The right sidebar selects Files, Changes, History, Git actions and artifact metadata within the
left navigator’s selected worktree. Surface and entry live in the router search; choosing another
worktree removes the previous selection. Environment, project and worktree scope identify review
queries. Disconnect aborts outstanding reads and clears private client state.

The panel uses the existing shadcn vocabulary and a fixed compact desktop width with a collapse
control. Below the wide desktop breakpoint it moves into a right-hand Sheet so code remains readable.
Folders load on expansion. Changes follows stored layer and file order while retaining unassigned
changes. History pages through the existing snapshot cursor; inspection currently uses the first
parent. Artifact inspection displays stored metadata only: there is no executable HTML, asset loading
or sharing surface.

The first read-only viewers use TanStack Highlight’s token API with selective language imports.
React renders tokens as text, without inserting generated HTML. TanStack Virtual bounds mounted
code lines; tokenization retains whole-document context for multiline syntax. Unknown languages
fall back to plaintext. Editing, line annotations, file timelines and alternate merge-parent selection
remain separate work.

Git forms use the existing preparation and confirmation contract. Execution captures a request ID
before sending and retains it in the session query cache for explicit receipt checks. Uncertain
outcomes have no resubmit control. Receipts that require refresh invalidate project review queries,
including linked worktrees. Request identity currently survives navigation within the connection,
not page reload or disconnect; durable client-side recovery across those boundaries remains deferred.
The server continues to own its durable receipts and mutation safety.

Live adapters implement the existing read and Git-action HTTP routes. Explicit mock mode uses
in-memory fixtures; mock commit and stash creation update fixture state. Fetch/push simulate receipts
without contacting a remote. Stash apply/pop forms have live adapters but deliberately report an
unavailable simulation in the mock. Mock data proves presentation behavior, not Git correctness.

The implementations are owned by the [review view](../../apps/web/src/views/review/review-workspace.tsx),
[review queries](../../apps/web/src/query/review.ts), [Git lifecycle](../../apps/web/src/query/git-actions.ts),
and the portable [review](../../packages/client/src/review.ts) and
[Git-action](../../packages/client/src/git-actions.ts) clients.

## File discussion in the inspection header

Files and Changes expose a collapsed file discussion below the filename, with a count and
an explicit composer. The existing worktree comment contract remains authoritative; the
client uses a separate comments port and TanStack Query cache within the review scope.
Messages render as plain text. Existing replies and resolved state are readable; reply and
resolution controls, line anchors, and commit-specific discussions remain deferred.

New comments use exact file-path anchors without revision evidence. Files and Changes share
these discussions within a worktree; renames do not silently migrate anchors. Revision-bound
threads are excluded from this current-file discussion. Drafts remain local to the selected
file and survive submission failures, but navigation discards them. Writes are never retried
automatically; uncertain responses direct the reader to refresh before resubmitting.
