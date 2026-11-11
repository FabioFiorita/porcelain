---
screen: /history/commit/[oid]
selectors:
  - 'Root commit'
  - 'No changed files'
  - 'Compare parent'
  - "Couldn't load commit"
  - 'Files'
  - 'Loading diff…'
  - 'Large diff'
tests:
  - apps/mobile/src/features/workspace/rules/diff-page.spec.ts
api:
  - GET /api/worktrees/:worktreeId/commits/:oid/files
  - POST /api/worktrees/:worktreeId/commits/:oid/diffs
---

# history.commit

A commit reads as one scrolling page: its message and metadata, then every changed file's diff in order, each under a file heading that sticks to the top while its diff scrolls.

## How to get to it (user POV)

- History → commit row; direct commit route. Native Back returns to History.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

1. Open a commit. The native title is the short OID with `n files changed` beneath. Verify subject, body, author/time, selectable full OID, refs and comparison against independent server reads. The timestamp remains complete even though list rows show relative ages. Same-named branch and tag badges retain their `Branch` and `Tag` labels; remote refs say `Remote branch`.
2. Scroll from the message through every file without tapping. Each heading shows the file name, folder, status (`renamed from <old path>` for renames) and `+added −removed`, sticks under the opaque bar while its diff scrolls, and gives way to the next file's heading. Diffs appear before they reach the screen; nothing blinks or jumps. With General → Long lines → Scroll a horizontal drag pans only that diff and a vertical drag starting on code scrolls the page; with Wrap nothing pans sideways. Verify lines against the server patch. Files are requested twenty at a time.
3. Binary, omitted (`Too large to show`), metadata-only and submodule changes, and diffs above 1,000 rows, are one compact row (`Large diff · n lines`) that opens [the single-file diff](history.diff.md). A refused patch read shows Couldn't load diff with Retry.
4. Tap a heading: the single-file diff opens; Back returns to the same scroll place. iPhone: the Files top-bar menu lists up to 100 files by name, adding the folder only when two names collide; choosing one scrolls there, and the pinned heading names the file being read. iPad landscape: the file list stays on the left, marks the file at the top of the page and scrolls the page to a tapped file; portrait (content narrower than 700) falls back to the iPhone layout. Rotate with the page open.
5. Open a root commit: Root commit compares with the empty tree. Empty file list says No changed files; read failure offers Retry. Merge commits offer in-content Compare parent; choose each: the page reads that parent's diffs and stays on the file that was at the top.
6. Choose a merge parent, open a file and return: parent stays. Open and close Settings: the commit stays. Verify tablets in landscape and portrait.
7. Change workspace while old commit detail remains: it asks to return to History, never reading that OID against the new worktree.

Automated coverage: `diff-page.spec.ts` covers compact rows, counts, heading order and request groups; the page itself needs live evidence.

## Gotchas

- Direct commit routes keep their navigation behavior. Parent selection must not replace the commit title.
