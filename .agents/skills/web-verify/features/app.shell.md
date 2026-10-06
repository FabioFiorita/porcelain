# app.shell

## What it is

A browser with no session asks the real server for its inventory, gets 401, is sent to `/pair`, and sees the instructions to pair it instead of the workspace.

## How a user reaches it

- Open Porcelain (`/` or any workspace or settings address) in a browser that was never paired, or whose session ended.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start` launches the disposable server without a browser. Open the printed web root in a fresh in-app tab before using any pairing attachment.

### Setup

None.

1. Open `/` on the instance web URL
   Look for: Page URL `/pair`; heading "Porcelain" (level 1); heading "This browser is not paired"; the text "Run this on the machine hosting Porcelain, then open the link it prints on this device."; code `porcelain pair "This browser" --address http://127.0.0.1:<port>` naming the web origin the CLI started; no region "Review content". `$C server devices` lists only the server's own "Development setup".
2. Open `/settings/appearance` on the instance web URL
   Look for: also redirected to `/pair` with the same heading: every paired route is guarded.
3. Inspect browser network evidence
   Look for: `GET /api/inventory` answered 401 for each load.

## What proves it works

- The not-paired heading and the `porcelain pair` command at `/pair` after loading `/`, with inventory answering 401.
- `apps/web/spec/e2e/app-shell.e2e.ts`: a fresh browser context opening `/` sees the heading "This browser is not paired".

## Gotchas

- Run `$C pair` afterwards and follow "Open workspace" from its fresh attachment page using the skill’s in-app workflow (`access.pairing`), so the same instance can go on to other features. Disconnecting a paired browser from Settings → Connection reaches the same page by another path (`access.disconnect`).
- `/pair` shows the not-paired page only when the browser has no session; a paired browser that opens it is sent to its workspace.
