---
name: prove-web
version: 0.59.2
metadata:
  internal: true
description: Drive the browser client to observe a change in a real page — dev daemon plus HMR client, snapshot the accessibility tree, click and type, screenshot. Use when the changed behavior is `apps/web`, a daemon procedure seen through the UI, or any client behavior an Electron shell is not needed for. Read `docs/runtime-proof.md` for what finishes a proof.
---

# Prove web

The browser client is the cheapest surface: HMR means an edit is on screen in under a second, and
`agent-browser` reads the page as an accessibility tree instead of pixels.

## Drive the client

```sh
pnpm dev:daemon    # background it — prints its port, home, playground, and auth line
pnpm dev:web       # background it — HMR client on the daemon port + 10000
```

```sh
agent-browser --session porcelain-web --args "--no-sandbox" open http://127.0.0.1:53118/
agent-browser --session porcelain-web snapshot -i
agent-browser --session porcelain-web click @e13
agent-browser --session porcelain-web screenshot /tmp/porcelain-web.png   # then read the file
```

Development auth is automatic: the daemon authorizes a browser that opens its URL, and prints
`pnpm dev:pair` for another device. Act on refs from the newest snapshot and re-snapshot after
anything that changes the view; refs are renumbered per snapshot.

Editing `apps/web` needs no command — the page updates itself. The daemon-served client on the
daemon's own port is the built dist and stays stale until `pnpm build:web`.

## Traps

- **Name your session.** `--session <name>` on every command keeps this drive out of the shared
  default browser, which other agents and the human are using at the same time.
- **`--args "--no-sandbox"` on Linux.** The Chrome that `agent-browser` downloads ships no
  `chrome-sandbox` helper, and Ubuntu restricts unprivileged user namespaces, so a plain launch
  dies with `No usable sandbox!`. There is nothing to chmod here — the flag is the fix.
- **Hover is inert headless.** Headless Chromium reports `(hover:hover)=false`, so Tailwind
  `hover:` styles never apply. Prove hover with `--headed`.
- **Clearing a controlled input.** `agent-browser fill @ref ""` empties the DOM value without
  notifying React: the field reads empty while the store keeps the old value. Clear with
  `agent-browser keyboard type` plus `agent-browser press Backspace`.

## Regression instead of a look

An automated check owns its own daemon, home, token, and fixture repository:

```sh
pnpm test:e2e
```

Prefer the existing fixtures, `loc.*`, and `TestIds` helpers in `apps/desktop/e2e/helpers/app.ts`.
Keep screenshot-sensitive suites at one worker and inspect a screenshot difference before you
accept a new baseline.

## Down

`agent-browser --session porcelain-web close`, then stop the daemon and web server you started, by
their tracked task or PID.
