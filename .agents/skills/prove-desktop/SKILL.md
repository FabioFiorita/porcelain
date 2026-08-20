---
name: prove-desktop
version: 0.55.1
metadata:
  internal: true
description: Drive the Electron client to observe a change in the real desktop app — launch it with a CDP port, snapshot its accessibility tree, click and type, screenshot. Use when the changed behavior is Electron shell, preload/IPC, window, or menu work, or when desktop evidence is asked for. Read `docs/runtime-proof.md` for what finishes a proof.
---

# Prove desktop

`agent-browser` speaks CDP, and Electron is Chromium, so the desktop client drives exactly like a
page: snapshot, act, re-snapshot. Renderer-only behavior is cheaper on the browser client — reach
here for what only the shell can show.

## Drive the running app

```sh
cd apps/desktop && ./node_modules/.bin/electron-vite dev --remoteDebuggingPort=9333   # background it
agent-browser --session porcelain-desktop connect 9333
agent-browser --session porcelain-desktop tab        # one target, ending http://localhost:5173/
agent-browser --session porcelain-desktop snapshot -i   # a11y tree with @eN refs — every button,
                                                        # tab, and textbox by name
agent-browser --session porcelain-desktop click @e10
agent-browser --session porcelain-desktop screenshot /tmp/porcelain-desktop.png   # read the file
```

Act on refs from the newest snapshot and re-snapshot after anything that changes the view; refs are
renumbered per snapshot. `pnpm dev` runs the same client when no flag is needed — it appends nothing
to `electron-vite`, so `pnpm dev -- --remoteDebuggingPort=…` starts an app you cannot attach to.

The app carries its own daemon under `~/.config/@porcelain/desktop-dev` with `PORCELAIN_DEV=1`,
which is why driving it never reaches production state.

## Traps

- **Name your session.** `--session <name>` on every command keeps this drive out of the shared
  default browser, which other agents and the human are using at the same time.
- **Clearing a controlled input.** `agent-browser fill @ref ""` empties the DOM value without
  notifying React: the field reads empty while the store stays filtered, and the view keeps showing
  the old result. Clear with `agent-browser keyboard type` plus `agent-browser press Backspace`.
  Non-empty `fill` is fine.
- **Linux sandbox.** Electron aborts at boot when `chrome-sandbox` under
  `node_modules/.pnpm/electron@<ver>/…/dist/` is not `root:root` mode `4755`. The file is extracted
  per install, so a reinstall, an upgrade, or a fresh worktree needs it again:
  `sudo chown root:root "$S" && sudo chmod 4755 "$S"`. `ELECTRON_DISABLE_SANDBOX=1` boots without
  sudo at the cost of matching shipped behavior.
- **Screenshots come from CDP, never the screen.** GNOME refuses `org.gnome.Shell.Screenshot` over
  D-Bus, and a Wayland window has no X11 capture path.

## Shell lifecycle without a human

Menus, windows, preload, and IPC that no attached session can reach belong in the Playwright
electron project, which owns its own app instance:

```sh
pnpm --dir apps/desktop test:e2e:native
```

## Down

Stop the app you started, by its tracked task or PID. An Electron instance under a
`/tmp/porcelain-e2e-ud-*` user-data directory belongs to a Playwright run — leave it alone.
