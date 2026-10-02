---
route: /
shell: desktop
selectors:
  - "Toggle Sidebar"
  - "Settings"
  - "This computer"
  - "Name of this computer"
  - "Save"
  - "Devices"
  - "Back"
  - "Workstation"
tests:
  - apps/web/spec/e2e/access-environment-name.desktop.e2e.ts
api:
  - GET /api/inventory
  - PUT /api/environment/name
---

# access.environment-name

## What it is

The navigator header names the computer Porcelain runs on, its host name until the owner chooses a name in Settings, which the header, the browser tab title and the pairing instructions then show, and clearing it goes back to the host name.

## How a user reaches it

- Settings → This computer → Name of this computer → Save

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start --desktop`.

### The owner names this computer in Settings, and the tab title, pairing and the navigator header show the name

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Toggle Sidebar"`
   Look for: the text shows.
2. `.agents/skills/web-verify/scripts/cli click --role button --name "Settings"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "This computer"`
   Look for: the textbox “Name of this computer” holds ''; the button “Save” is disabled.
4. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Name of this computer" "Workstation"`
   Look for: the page settles; take a snapshot to read what it shows.
5. `.agents/skills/web-verify/scripts/cli click --role button --name "Save"`
   Look for: the page settles; take a snapshot to read what it shows.
6. `.agents/skills/web-verify/scripts/cli click --role button --name "Devices"`
   Look for: the text “/to connect it to Workstation\./” shows.
7. `.agents/skills/web-verify/scripts/cli click --role button --name "This computer"`
   Look for: the button “Save” is disabled.
8. `.agents/skills/web-verify/scripts/cli click --role button --name "Back"`
   Look for: the page settles; take a snapshot to read what it shows.
9. `.agents/skills/web-verify/scripts/cli click --role button --name "Toggle Sidebar"`
   Look for: the text “Workstation” shows.
10. `.agents/skills/web-verify/scripts/cli click --role button --name "Settings"`
   Look for: the page settles; take a snapshot to read what it shows.
11. `.agents/skills/web-verify/scripts/cli click --role button --name "This computer"`
   Look for: the page settles; take a snapshot to read what it shows.
12. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Name of this computer" ""`
   Look for: the page settles; take a snapshot to read what it shows.
13. `.agents/skills/web-verify/scripts/cli click --role button --name "Save"`
   Look for: the page settles; take a snapshot to read what it shows.
14. `.agents/skills/web-verify/scripts/cli click --role button --name "Back"`
   Look for: the page settles; take a snapshot to read what it shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/e2e/access-environment-name.desktop.e2e.ts` (Playwright e2e): the owner names this computer in Settings, and the tab title, pairing and the navigator header show the name.
- The tests read back what the server kept through the kit: `server.inventory()`, `server.project()`.

## Gotchas

- Only the desktop app shows this; start the instance with `.agents/skills/web-verify/scripts/cli start --desktop`, which serves the web in the desktop Vite mode.
