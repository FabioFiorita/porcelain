---
route: /
selectors:
  - "Toggle Sidebar"
  - "Settings"
  - "Appearance"
  - "Sharing"
  - "Updates"
tests:
  - apps/web/spec/e2e/app-settings-without-sharing.e2e.ts
api:
  - GET /api/inventory
  - GET /api/service/update
  - POST /api/service/update
---

# app.settings-without-sharing

## What it is

The web the server serves leaves sharing and remote computers to the desktop app: Settings keeps its preferences and Updates with no Sharing section, and the navigator still names this computer.

## How a user reaches it

- Toggle Sidebar → Settings
- Shortcut: `Alt+Shift+S`

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### The web the server serves lists Appearance, Git and agents, Connection and Updates in Settings and no Sharing, and the navigator still names this computer

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Toggle Sidebar"`
   Look for: the text shows.
2. `.agents/skills/web-verify/scripts/cli click --role button --name "Settings"`
   Look for: the heading “Appearance” shows; the button “Sharing” is gone.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Updates"`
   Look for: the heading “Updates” shows; the text “Porcelain <offered.version ?? ''>” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/e2e/app-settings-without-sharing.e2e.ts` (Playwright e2e): the web the server serves lists Appearance, Git and agents, Connection and Updates in Settings and no Sharing, and the navigator still names this computer.
- The tests read back what the server kept through the kit: `server.inventory()`, `server.serviceUpdate()`.

## Gotchas

- None known.
