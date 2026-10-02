---
route: /
selectors:
  - "Review"
  - "Files"
  - "README.md"
  - "Open file"
  - "Source"
  - "Changes"
tests:
  - apps/web/spec/integration/changes-live-update.test.tsx
api:
  - GET /api/live
  - GET /api/worktrees/:worktreeId/changes
  - GET /api/worktrees/:worktreeId/directory
  - GET /api/worktrees/:worktreeId/text
---

# changes.live-update

## What it is

While the page stays open, a file another writer rewrites, creates or removes on disk shows its new text, or appears in or leaves the file tree and the changes list, through the live-update socket and without a reload.

## How a user reaches it

- Review → Files → README.md → right-click → Open file, while another writer changes the worktree on disk

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### 1. An open file another writer rewrites on disk shows the new text without a reload

Before driving, on the instance (the sample repository and project home are in the instance file):

- write `README.md` in the sample repository

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "Files"`
   Look for: the treeitem “README.md” shows.
3. `.agents/skills/web-verify/scripts/cli click --role treeitem --name "README.md" --button right`
   Look for: the page settles; take a snapshot to read what it shows.
4. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "Open file"`
   Look for: the text “A change to review.” shows.
5. `.agents/skills/web-verify/scripts/cli click --role tab --name "Source"`
   Look for: the tab “Source” has aria-selected="true"; the text “Rewritten by another writer while the page is open.” shows; the text “A change to review.” is gone; the tab “Source” has aria-selected="true".

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

### 2. A file another writer creates on disk appears in the open file tree and changes list without a reload

Before driving, on the instance (the sample repository and project home are in the instance file):

- write `live-note.md` in the sample repository

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "Files"`
   Look for: the treeitem “README.md” shows; the treeitem “live-note.md” shows; the tab “Files” has aria-selected="true".
3. `.agents/skills/web-verify/scripts/cli click --role tab --name "Changes"`
   Look for: the page settles; take a snapshot to read what it shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

### 3. A file another writer removes from disk leaves the open changes list and file tree without a reload

Before driving, on the instance (the sample repository and project home are in the instance file):

- write `live-note.md` in the sample repository
- delete `live-note.md` from the sample repository

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "Changes"`
   Look for: the button “/^README\.md · /” shows.
3. `.agents/skills/web-verify/scripts/cli click --role tab --name "Files"`
   Look for: the treeitem “README.md” shows; the treeitem “live-note.md” is gone.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/changes-live-update.test.tsx` (Browser Mode integration): an open file another writer rewrites on disk shows the new text without a reload; a file another writer creates on disk appears in the open file tree and changes list without a reload; a file another writer removes from disk leaves the open changes list and file tree without a reload.
- The tests read back what the server kept through the kit: `server.changes()`, `server.text()`.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
