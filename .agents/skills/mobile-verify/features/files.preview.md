---
screen: /file
selectors:
  - 'Show source'
  - 'Timeline'
  - 'More actions'
  - 'Workspace changed'
tests:
  - apps/mobile/src/features/documents/adapters/code-highlighter.spec.ts
  - packages/client/src/features/files/queries/text.spec.ts
  - packages/client/src/features/files/queries/asset.spec.ts
api:
  - GET /api/worktrees/:worktreeId/text
  - GET /api/worktrees/:worktreeId/asset
---

# files.preview

Files opens read-only source, document and image previews for the selected worktree. A known path reads directly through the text or asset endpoint; opening it does not depend on listing its parent folder. The server decides whether the path is safe and readable.

## How to get to it (user POV)

- Worktrees → worktree → Files → tree or search → file. Native Back/swipe returns.
- On a tablet with at least 700 units of content width the file opens beside the tree in the Worktrees tab instead (see [Files](files.files.md) step 10); its title, folder and actions still sit in the native top bar. A file pushed while the screen was narrow returns to that layout when the screen widens, and a file shown beside the tree is pushed again (above its worktree) when the screen narrows below 700, keeping the reading line.
- A file link (`porcelain.dev://file?path=…&workspace=…` for the selected worktree) pushes the file on phones and narrow tablets; on a wide tablet it opens in the Worktrees tab beside the tree and leaves nothing pushed in Reviews. A file opened from another pushed screen (a review decision, a commit) stays pushed in its tab; only a file directly above a tab root or its worktree page moves to the split.

## Driving it with agent-device

Preconditions: [surface baseline](README.md).

Open the document from its worktree. Confirm the native top bar contains the document actions with no Comment or Comments controls. Read source and diffs in light and dark, return with Back and reopen to check the reading place. On tablets verify landscape and portrait. For changed files, mark reviewed and unmark, checking the persisted fingerprint through the server; change the fixture and confirm Changed since review. For staged plus unstaged content, the Comparison menu still switches the displayed diff.

Open an uncached syntax-heavy file. Literal source and line numbers appear before coloring finishes; coloring preserves the reading line and selection. Navigate away during highlighting, then return: unfinished work is cancelled when the screen loses focus, and completed colors remain available for five minutes. Compare minified production JavaScript on the same device and fixture when measuring first readable content separately from completed coloring.

## Gotchas

Walkthrough conversations are separate and remain on the Walkthrough page.
