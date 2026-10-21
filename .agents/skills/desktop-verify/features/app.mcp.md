---
selectors:
  - 'Porcelain MCP server'
  - 'Copy MCP configuration'
  - 'Retry MCP configuration'
tests:
  - apps/desktop/src/rules/mcp-command.spec.ts
  - apps/server/src/cli/cli-program.spec.ts
  - apps/desktop/spec/e2e/bridge.e2e.ts
api: []
---

# app.mcp

## What it is

Settings gives agents the absolute app executable and the local app server's
actual data directory. The executable's MCP mode relays stdio to the existing
owner socket before desktop startup or the single-instance lock. It never starts
a second server. Normal desktop `--data-directory` continues to mean a profile
root; MCP mode requires the explicit server data directory.

## How a user reaches it

- Settings > Integrations > Porcelain MCP server > Copy MCP configuration.
- The copied command registers this local app server with Claude Code. The app
  must be running, including when the renderer is viewing a remote computer.

## Driving it

Use the desktop verification skill's disposable Porcelain Dev instance. Read the
command through Settings, run its executable portion from a fresh terminal with
its working directory set to the registered sample repository, initialize MCP,
and call `list_comments`. The command uses the staged Electron executable and
entry for Dev, and only the absolute app executable for a packaged app.

Confirm the returned comments belong to that repository, the app window remains
usable, and its existing server PID is unchanged. End bridge stdin and observe a
clean exit after its final response. Repeat against a missing disposable server
path: a request returns a protocol error and starts no server. Never substitute
an installed app or its data for the disposable instance.

## What proves it works

- The command spec observes literal argument values through a real POSIX shell,
  including spaces, apostrophes, command substitution and backticks.
- The CLI spec requires an absolute explicit server path, ignores environment
  defaults and refuses server commands in desktop MCP mode. Rejections and help
  go to stderr; stdout remains reserved for bridge protocol messages.
- The bridge E2E checks the trusted host's directory and executable, the Settings
  command and copy action, and refusal of a rogue window's IPC request.
- A native disposable MCP journey proves startup dispatch, the owner socket,
  working-directory selection, coexistence with the app and stdio completion.

## Gotchas

- Linux proof does not establish packaged Mac executable behaviour. Native Mac
  proof remains required separately before claiming issue acceptance.
- No global CLI, executable shim, credential, Node mode or relaxed fuse is needed.
- A bridge read failure disables copy until a configuration is available; Retry
  MCP configuration reads again through the same trusted bridge.

## Signed packaged proof

After candidate review, use the release skill's `--signed-verification` build mode
in an isolated exact-head Mac checkout. It preserves production runtime security
while requiring only the existing signing identity, not Apple notarization
credentials. Launch the resulting non-installed bundle's absolute executable with
an isolated profile, then drive Settings and its copied MCP command without
debugger switches. Record the app signature, hardened runtime/entitlements, ASAR,
locked fuses and the bounded MCP/coexistence/EOF journey above. This does not prove
notarization or Gatekeeper distribution acceptance and needs no simulator.
