---
route: /settings/$section
shell: desktop
selectors:
  - "Review content"
  - "Toggle Sidebar"
  - "Settings"
  - "Appearance"
  - "Diff layout"
  - "Git and agents"
  - "Back"
  - "This computer"
  - "Name of this computer"
  - "Devices"
  - "repository"
  - "Remove from Porcelain"
  - "No projects registered"
  - "Select a worktree"
tests:
  - apps/web/spec/e2e/app-settings-page.desktop.e2e.ts
api:
  - DELETE /api/projects/:projectId
  - GET /api/inventory
  - GET /api/remote-access
  - PATCH /api/remote-access
---

# app.settings-page

## What it is

Settings is its own page with one section at a time; Back and Escape return to where it was opened, Escape stays while typing in a field, and it opens even with no project registered.

## How a user reaches it

- Toggle Sidebar → Settings
- Shortcut: `Alt+Shift+S`

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start --desktop`.

### 1. Settings opens as its own page with one section at a time, and Back returns to the review

```sh
.agents/skills/web-verify/scripts/cli open /
```

After `open`, look for: the region “Review content” shows.
1. `.agents/skills/web-verify/scripts/cli click --role button --name "Toggle Sidebar"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role button --name "Settings"`
   Look for: the main “Settings” shows; the region “Review content” is gone; the heading “Appearance” shows; the text “Diff layout” shows.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Git and agents"`
   Look for: the heading “Git and agents” shows; the text “Diff layout” is gone.
4. `.agents/skills/web-verify/scripts/cli click --role button --name "Back"`
   Look for: the main “Settings” is gone; the region “Review content” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

### 2. Escape leaves Settings, except while typing in one of its fields

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Toggle Sidebar"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role button --name "Settings"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "This computer"`
   Look for: the page settles; take a snapshot to read what it shows.
4. `.agents/skills/web-verify/scripts/cli click --role textbox --name "Name of this computer"`
   Look for: the page settles; take a snapshot to read what it shows.
5. `.agents/skills/web-verify/scripts/cli press Escape`
   Look for: the main “Settings” shows.
6. `.agents/skills/web-verify/scripts/cli click --role button --name "Devices"`
   Look for: the page settles; take a snapshot to read what it shows.
7. `.agents/skills/web-verify/scripts/cli press Escape`
   Look for: the main “Settings” is gone; the region “Review content” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

### 3. Settings still opens once the last project is removed

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Toggle Sidebar"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role button --name "repository" --button right`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "Remove from Porcelain"`
   Look for: the page settles; take a snapshot to read what it shows.
4. `.agents/skills/web-verify/scripts/cli click --role button --name "Remove from Porcelain"`
   Look for: the text “No projects registered” shows.
5. `.agents/skills/web-verify/scripts/cli click --role button --name "Settings"`
   Look for: the heading “Appearance” shows.
6. `.agents/skills/web-verify/scripts/cli click --role button --name "Back"`
   Look for: the text “Select a worktree” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/e2e/app-settings-page.desktop.e2e.ts` (Playwright e2e): Settings opens as its own page with one section at a time, and Back returns to the review; Escape leaves Settings, except while typing in one of its fields; Settings still opens once the last project is removed.
- The tests read back what the server kept through the kit: `server.project()`.

## Gotchas

- Only the desktop app shows this; start the instance with `.agents/skills/web-verify/scripts/cli start --desktop`, which serves the web in the desktop Vite mode.
