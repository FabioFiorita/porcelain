---
route: /
selectors:
  - "This browser is not paired"
  - "porcelain pair"
  - "Connection"
  - "Disconnect this browser"
tests:
  - apps/web/spec/e2e/app-shell.e2e.ts
api:
  - GET /api/inventory
---

# app.shell

## What it is

A browser with no session asks the real server for its inventory, gets 401, is sent to `/pair`, and sees the instructions to pair it instead of the workspace.

## How a user reaches it

- Open Porcelain (`/` or any workspace or settings address) in a browser that was never paired, or whose session ended.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start`. `start` always pairs the browser, so a never-paired browser needs a CLI gap; ending the session from Settings reaches the same code path (inventory answers 401) and is what the steps use.

### Setup

- Preferred, missing: `cli start --unpaired` (start without opening a pairing link).
- Available: `$C open /settings/connection`, then `$C click --role button --name "Disconnect this browser"`; look for heading "This browser is not paired".

1. `$C open /`
   Look for: Page URL `/pair`; heading "Porcelain" (level 1); heading "This browser is not paired"; the text "Run this on the machine hosting Porcelain, then open the link it prints on this device."; code `porcelain pair "This browser" --address http://127.0.0.1:<port>` naming the web origin the CLI started; no region "Review content".
2. `$C open /settings/appearance`
   Look for: also redirected to `/pair` with the same heading: every paired route is guarded.
3. `$C network`
   Look for: `GET /api/inventory` answered 401 for each load.

## What proves it works

- The not-paired heading and the `porcelain pair` command at `/pair` after loading `/`, with inventory answering 401.
- `apps/web/spec/e2e/app-shell.e2e.ts`: a fresh browser context opening `/` sees the heading "This browser is not paired".

## Gotchas

- The setup disconnects the instance's browser for good: nothing else can be driven until it is paired again (CLI gap `cli pair`). Drive this last, or `$C stop` and `$C start` afterwards.
- `/pair` shows the not-paired page only when the browser has no session; a paired browser that opens it is sent to its workspace.
