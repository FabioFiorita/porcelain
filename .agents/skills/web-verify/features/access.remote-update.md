---
route: /settings/$section
shell: desktop
selectors:
  - "Toggle Sidebar"
  - "Settings"
tests:
  - apps/web/spec/e2e/access-remote-update.desktop.e2e.ts
api:
  - GET /api/service/update
  - POST /api/service/update
---

# access.remote-update

## What it is

This computer lists each remote computer’s update; an app that computer does not trust is told how to get trusted, and a trusted app starts the update there.

## How a user reaches it

- Toggle Sidebar → Settings → This computer → Remote computers → Update to …

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start --desktop`.

### This computer lists each remote computer’s update, tells an untrusted app how to get trusted there, and lets a trusted app start the update on that computer

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Toggle Sidebar"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role button --name "Settings"`
   Look for: the listitem shows; the listitem is gone.
3. `.agents/skills/web-verify/scripts/cli click --role listitem`
   Look for: the page settles; take a snapshot to read what it shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/e2e/access-remote-update.desktop.e2e.ts` (Playwright e2e): This computer lists each remote computer’s update, tells an untrusted app how to get trusted there, and lets a trusted app start the update on that computer.
- The tests read back what the server kept through the kit: `server.inventory()`, `server.serviceUpdate()`.

## Gotchas

- Only the desktop app shows this; start the instance with `.agents/skills/web-verify/scripts/cli start --desktop`, which serves the web in the desktop Vite mode.
- The tests start a second disposable server as the remote computer; the CLI starts one server, so pairing a remote needs a second instance started with `start` and a pairing link issued on it.
