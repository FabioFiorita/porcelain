---
route: /
selectors:
  - "Review"
  - "Files"
  - "README.md"
  - "Open file"
  - "Edit"
  - "Not saving: changed on disk"
  - "Toggle Sidebar"
  - "Settings"
  - "Connection"
  - "Disconnect this browser"
  - "Back"
  - "Resume edit"
  - "Reload"
  - "This browser is not paired"
tests:
  - apps/web/spec/e2e/access-disconnect.e2e.ts
api:
  - DELETE /api/session
  - GET /api/inventory
---

# access.disconnect

## What it is

Disconnecting this browser from Settings ends its session and shows how to pair it again while the device stays paired, and it is refused while a file draft cannot be saved.

## How a user reaches it

- sidebar → Settings → Connection → Disconnect this browser
- Shortcut: `Alt+Shift+S`

## Driving it

Start an instance first: `.agents/skills/web-verify/scripts/cli start`.

### 1. Disconnecting is refused while a file draft cannot be saved, and the file on disk keeps its own change

Before driving, on the instance (the sample repository and project home are in the instance file):

- write `README.md` in the sample repository

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Review"`
   Look for: the page settles; take a snapshot to read what it shows.
2. `.agents/skills/web-verify/scripts/cli click --role tab --name "Files"`
   Look for: the treeitem “README.md” shows.
3. `.agents/skills/web-verify/scripts/cli click --role treeitem --name "README.md" --button right`
   Look for: the page settles; take a snapshot to read what it shows.
4. `.agents/skills/web-verify/scripts/cli click --role menuitem --name "Open file"`
   Look for: the page settles; take a snapshot to read what it shows.
5. `.agents/skills/web-verify/scripts/cli click --role button --name "Edit"`
   Look for: the textbox “README.md” shows.
6. `.agents/skills/web-verify/scripts/cli fill --role textbox --name "README.md" "A draft the browser cannot save"`
   Look for: the text “Not saving: changed on disk” shows.
7. `.agents/skills/web-verify/scripts/cli click --role button --name "Toggle Sidebar"`
   Look for: the page settles; take a snapshot to read what it shows.
8. `.agents/skills/web-verify/scripts/cli click --role button --name "Settings"`
   Look for: the page settles; take a snapshot to read what it shows.
9. `.agents/skills/web-verify/scripts/cli click --role button --name "Connection"`
   Look for: the page settles; take a snapshot to read what it shows.
10. `.agents/skills/web-verify/scripts/cli click --role button --name "Disconnect this browser"`
   Look for: the alert reads 'Save or discard unsaved file drafts before disconnecting.',.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

### 2. Disconnecting this browser ends its session and shows how to pair it again, while the device stays paired

```sh
.agents/skills/web-verify/scripts/cli open /
```

1. `.agents/skills/web-verify/scripts/cli click --role button --name "Back"`
   Look for: the main “Settings” is gone.
2. `.agents/skills/web-verify/scripts/cli click --role button --name "Resume edit"`
   Look for: the page settles; take a snapshot to read what it shows.
3. `.agents/skills/web-verify/scripts/cli click --role button --name "Reload"`
   Look for: the text “Not saving: changed on disk” is gone.
4. `.agents/skills/web-verify/scripts/cli click --role button --name "Toggle Sidebar"`
   Look for: the page settles; take a snapshot to read what it shows.
5. `.agents/skills/web-verify/scripts/cli click --role button --name "Settings"`
   Look for: the page settles; take a snapshot to read what it shows.
6. `.agents/skills/web-verify/scripts/cli click --role button --name "Connection"`
   Look for: the page settles; take a snapshot to read what it shows.
7. `.agents/skills/web-verify/scripts/cli click --role button --name "Disconnect this browser"`
   Look for: the heading “This browser is not paired” shows.

Then `.agents/skills/web-verify/scripts/cli snapshot` and `.agents/skills/web-verify/scripts/cli screenshot` record the end state, and `.agents/skills/web-verify/scripts/cli network` lists the requests the page sent.

## What proves it works

- `apps/web/spec/e2e/access-disconnect.e2e.ts` (Playwright e2e): disconnecting is refused while a file draft cannot be saved, and the file on disk keeps its own change; disconnecting this browser ends its session and shows how to pair it again, while the device stays paired.
- The tests read back what the server kept through the kit: `server.devices()`, `server.fileWriteCount()`, `server.text()`.

## Gotchas

- The CLI browser is phone width (414 by 896), so the review panel opens from the Review button instead of standing beside the document.
