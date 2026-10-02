---
route: /
selectors:
  - "repository"
  - "Rename project"
  - "Name"
  - "Rename"
tests:
  - apps/web/spec/integration/projects-rename.test.tsx
api:
  - PATCH /api/projects/:projectId
---

# projects.rename

## What it is

Renaming a project in the navigator shows the new name and the server keeps it.

## How a user reaches it

- sidebar → project → right-click → Rename project

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### Renaming a project in the navigator shows the new name and the server keeps it

```sh
.agents/skills/web-verify/scripts/cli open /
```

After `open`, look for: the button “repository” shows.
1. `.agents/skills/web-verify/scripts/cli click --role button --name "repository" --button right`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "Rename project"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Name" " "`
   Look for: the button “Rename” is disabled; the alert shows.
4. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Name" "Browser renamed project"`
   Look for: the page settles; take a snapshot to read what it shows.
5. `.agents/skills/web-verify/scripts/cli click --role button --name "Rename"`
   Look for: the button shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/integration/projects-rename.test.tsx` (Browser Mode integration): renaming a project in the navigator shows the new name and the server keeps it.
- The tests read back what the server kept through the kit: `server.project()`.

## Gotchas

- None known.
