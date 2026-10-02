---
route: /
shell: desktop
selectors:
  - "Toggle Sidebar"
  - "Settings"
  - "Ways in"
  - "Local network"
  - "Devices"
  - "Paired devices"
  - "Remote computers"
  - "No remote computers yet"
tests:
  - apps/web/spec/e2e/app-settings-scope.desktop.e2e.ts
api:
  - GET /api/remote-access
  - PATCH /api/remote-access
---

# app.settings-scope

## What it is

Desktop Settings splits sharing into This computer, Ways in, Devices and Remote computers, each its own page.

## How a user reaches it

- Toggle Sidebar → Settings → Ways in, Devices, Remote computers

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start --desktop`.

### Desktop Settings splits sharing into This computer, Ways in, Devices and Remote computers, each its own page

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Toggle Sidebar"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role button --name "Settings"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Ways in"`
   Look for: the heading “Ways in” shows; the switch “Local network” shows.
4. `.agents/skills/web-verify/scripts/cli click --role button --name "Devices"`
   Look for: the switch “Local network” is gone; the text “Paired devices” shows.
5. `.agents/skills/web-verify/scripts/cli click --role button --name "Remote computers"`
   Look for: the text “No remote computers yet” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/e2e/app-settings-scope.desktop.e2e.ts` (Playwright e2e): desktop Settings splits sharing into This computer, Ways in, Devices and Remote computers, each its own page.

## Gotchas

- Only the desktop app shows this; start the instance with `.agents/skills/web-verify/scripts/cli start --desktop`, which serves the web in the desktop Vite mode.
