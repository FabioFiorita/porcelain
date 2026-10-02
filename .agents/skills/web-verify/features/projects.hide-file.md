---
route: /
selectors:
  - "Review"
  - "Files"
  - "README.md"
  - "Hide file"
  - "Show file"
  - "Showing hidden"
tests:
  - apps/web/spec/integration/projects-hide-file.test.tsx
api:
  - GET /api/projects/:projectId/file-preferences
  - PUT /api/projects/:projectId/file-preferences
---

# projects.hide-file

## What it is

Hiding a file takes it out of the file tree and the server keeps it hidden for the project, and showing it again returns it.

## How a user reaches it

- Review → Files → README.md → right-click → Hide file

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### 1. Hiding a file takes it out of the file tree and the server keeps it hidden for the project

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "Files"`
   Look for: the treeitem “README.md” shows.
3. `.agents/skills/web-verify/scripts/cli click --role treeitem --name "README.md" --button right`
   Look for: the page settles; take a snapshot to read what it shows.
4. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "Hide file"`
   Look for: the treeitem “README.md” is gone; the button “Hidden (1)” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

### 2. Showing a hidden file again returns it to the file tree and the server no longer hides it

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "Files"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role treeitem --name "README.md" --button right`
   Look for: the page settles; take a snapshot to read what it shows.
4. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "Hide file"`
   Look for: the page settles; take a snapshot to read what it shows.
5. `.agents/skills/web-verify/scripts/cli click --role button --name "Hidden (1)"`
   Look for: the treeitem “README.md” shows.
6. `.agents/skills/web-verify/scripts/cli click --role treeitem --name "README.md" --button right`
   Look for: the page settles; take a snapshot to read what it shows.
7. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "Show file"`
   Look for: the button “Showing hidden” is gone; the treeitem “README.md” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/projects-hide-file.test.tsx` (Browser Mode integration): hiding a file takes it out of the file tree and the server keeps it hidden for the project; showing a hidden file again returns it to the file tree and the server no longer hides it.
- The tests read back what the server kept through the kit: `server.filePreferences()`.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
