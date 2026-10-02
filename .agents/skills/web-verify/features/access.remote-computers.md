---
route: /settings/$section
shell: desktop
selectors:
  - "Toggle Sidebar"
  - "Settings"
  - "Remote computers"
  - "No remote computers yet"
  - "Pairing link"
  - "Add"
  - "That link is for this computer."
  - "Online"
tests:
  - apps/web/spec/e2e/access-remote-computers.desktop.e2e.ts
api:
  - GET /api/environment
  - POST /api/pair
---

# access.remote-computers

## What it is

The desktop app pairs with another Porcelain from the link porcelain pair prints, across origins with its own credential, shows it online, refuses a used or unreadable link and a link for this computer, and forgets it.

## How a user reaches it

- Toggle Sidebar → Settings → Remote computers → paste the pairing link → Add

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start --desktop`.

### The desktop app adds a remote computer from the link porcelain pair prints, shows it online, refuses a used or broken link, and forgets it

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Toggle Sidebar"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role button --name "Settings"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Remote computers"`
   Look for: the text “No remote computers yet” shows.
4. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Pairing link" "not a link"`
   Look for: the page settles; take a snapshot to read what it shows.
5. `.agents/skills/web-verify/scripts/cli click --role button --name "Add"`
   Look for: the main “Settings” shows.
6. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Pairing link" "<await app.remoteLink('this')>"`
   Look for: the page settles; take a snapshot to read what it shows.
7. `.agents/skills/web-verify/scripts/cli click --role button --name "Add"`
   Look for: the text “That link is for this computer.” shows.
8. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Pairing link" "<link>"`
   Look for: the page settles; take a snapshot to read what it shows.
9. `.agents/skills/web-verify/scripts/cli click --role button --name "Add"`
   Look for: the listitem shows; the text “Online” shows.
10. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "Pairing link" "<link>"`
   Look for: the page settles; take a snapshot to read what it shows.
11. `.agents/skills/web-verify/scripts/cli click --role button --name "Add"`
   Look for: the main “Settings” shows.
12. `.agents/skills/web-verify/scripts/cli click --role listitem`
   Look for: the text “No remote computers yet” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/e2e/access-remote-computers.desktop.e2e.ts` (Playwright e2e): the desktop app adds a remote computer from the link porcelain pair prints, shows it online, refuses a used or broken link, and forgets it.
- The tests read back what the server kept through the kit: `server.devices()`, `server.inventory()`.

## Gotchas

- Only the desktop app shows this; start the instance with `.agents/skills/web-verify/scripts/cli start --desktop`, which serves the web in the desktop Vite mode.
- The tests start a second disposable server as the remote computer; the CLI starts one server, so pairing a remote needs a second instance started with `start` and a pairing link issued on it.
