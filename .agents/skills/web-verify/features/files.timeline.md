---
route: /
selectors:
  - "Review"
  - "Files"
  - "guide.md"
  - "Timeline"
  - "Renamed from README.md"
  - "Added as README.md"
  - "Start of this file’s history."
  - "Show timeline"
tests:
  - apps/web/spec/integration/files-timeline.test.tsx
api:
  - GET /api/worktrees/:worktreeId/commits/:oid/files
  - GET /api/worktrees/:worktreeId/file-commits
  - POST /api/worktrees/:worktreeId/commits/:oid/diffs
---

# files.timeline

## What it is

The timeline of a file lists the commits that changed it, newest first, following it back across a rename and naming the path it had, and opening one shows that commit with the diff of the file.

## How a user reaches it

- Review → Files → file → Timeline, or right-click the file → Show timeline

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### 1. The timeline of a renamed file lists its commits across the rename and opens the diff of one

Before driving, on the instance (the sample repository and project home are in the instance file):

- commit everything in the sample repository as “Explain the change to review”
- write `guide.md` in the sample repository
- delete `README.md` from the sample repository
- commit everything in the sample repository as “Move the readme to the guide”

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "Files"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role treeitem --name "guide.md"`
   Look for: the page settles; take a snapshot to read what it shows.
4. `.agents/skills/web-verify/scripts/cli click --role button --name "Timeline"`
   Look for: the text “Renamed from README.md” shows; the text “Modified as README.md” shows; the text “Added as README.md” shows; the text “Start of this file’s history.” shows; the heading “Explain the change to review” shows; the text “A change to review.” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

### 2. The file tree opens the timeline of a file

Before driving, on the instance (the sample repository and project home are in the instance file):

- commit everything in the sample repository as “Explain the change to review”
- write `guide.md` in the sample repository
- delete `README.md` from the sample repository
- commit everything in the sample repository as “Move the readme to the guide”

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "Files"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role treeitem --name "guide.md" --button right`
   Look for: the page settles; take a snapshot to read what it shows.
4. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "Show timeline"`
   Look for: the button “/^Move the readme to the guide/” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/files-timeline.test.tsx` (Browser Mode integration): the timeline of a renamed file lists its commits across the rename and opens the diff of one; the file tree opens the timeline of a file.
- The tests read back what the server kept through the kit: `server.commits()`.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
