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

Live adapters implement the existing read and Git-action HTTP routes. In-memory API fixtures
remain for controlled renderer tests; they do not establish Git correctness.

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

## The sidebar dot (2026-09-20)

Each worktree shows a dot instead of a count of files to review. The server names the state by what
it means and the web decides how it looks, so the palette can change without touching the server:

- **`pending`** — published review layers with something in them still unreviewed. Filled yellow.
- **`reviewed`** — published layers where every file they name is marked: waiting for a commit.
  Filled green.
- **`replied`** — the agent answered a comment the owner has not read. Filled blue, and it wins
  over the other two: a reply is addressed to the owner and is newer than the handoff. A hue well
  away from the other two, because at eight pixels two neighbouring shades are one colour and here
  the hue carries the distinction alone.
- Nothing published, nothing to say: no dot.

Three filled dots is where this starts, not where it ends.

Both layer states end only when a commit archives the layers. `reviewed` means "everything marked,
as of when it was marked": it is read from marks alone, so it cannot notice the agent editing a file
that was already marked. Noticing would cost a status read per worktree, which is the cost this dot
replaced. The file watcher in step 6 gives that signal for free, and flipping `reviewed` back to
`pending` belongs there.

Both states come from one SQLite statement covering every worktree, returned with the worktree list,
so the sidebar costs no request of its own and no Git. The count it replaced cost a status read per
worktree, or a full evidence read once anything was marked.

Reading the discussion is what clears `replied`, and only reading it: the review index prefetches
comments and code documents list them, so the browser sends an explicit acknowledgement when the
discussion is on screen, carrying the highest thread revision it displayed. A reply that arrives
after that snapshot stays unread. Answering a reply also counts as reading it.

What the dot does not say is how much is left. That was the count's job, and it is visible inside
the worktree.
