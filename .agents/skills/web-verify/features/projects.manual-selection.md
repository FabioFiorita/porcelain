---
route: /
selectors:
  - "Toggle Sidebar"
  - "Open project"
  - "selected"
tests:
  - apps/web/spec/e2e/projects-manual-selection.e2e.ts
api:
  - GET /api/projects/folders
  - POST /api/projects
---

# projects.manual-selection

## What it is

Repositories are registered only after explicit folder selection; opening the app does not discover or register other repositories.

## How a user reaches it

- sidebar → Open project → browse → repository → Open

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### Only the repository selected by browsing is registered

Before driving, on the instance (the sample repository and project home are in the instance file):

- make the Git repository `selected` in the project home
- make the Git repository `unselected` in the project home

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Toggle Sidebar"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role button --name "Open project"`
   Look for: the button “unselected” shows; the button “selected” shows; the region “Found on this machine” is gone.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "selected"`
   Look for: the page settles; take a snapshot to read what it shows.
4. `.agents/skills/web-verify/scripts/cli click --role button --name "Open selected"`
   Look for: the dialog “Open project” is gone; the button “selected” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/e2e/projects-manual-selection.e2e.ts` (Playwright e2e): only the repository selected by browsing is registered.
- The tests read back what the server kept through the kit: `server.inventory()`.

## Gotchas

- None known.
