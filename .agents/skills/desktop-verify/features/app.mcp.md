---
selectors:
  - 'Copy MCP configuration'
  - 'Retry MCP configuration'
tests:
  - apps/desktop/src/rules/mcp-command.spec.ts
  - apps/server/src/cli/cli-program.spec.ts
  - apps/desktop/spec/e2e/bridge.e2e.ts
api: []
---

# app.mcp

Settings gives agents the absolute app executable and the local app server's
actual data directory. The executable's MCP mode relays stdio to the existing
owner socket before desktop startup or the single-instance lock. It never starts
a second server. Normal desktop `--data-directory` continues to mean a profile
root; MCP mode requires the explicit server data directory.

## How to get to it (user POV)

- Settings > Computers > This computer > Agents > Copy MCP configuration.
- The copied command registers this local app server with Claude Code. The app
  must be running, including when the renderer is viewing a remote computer.

## Driving it with Electron

Preconditions: [surface baseline](README.md).

1. In Settings → Computers → This computer → Agents, read and copy the command. Run its executable portion in a fresh terminal whose working directory is the registered sample repository. Initialize MCP and call `list_comments`.
2. Confirm comments belong to that repository, the window remains usable and the captured server PID is unchanged. End stdin; expect the final response followed by clean exit. Keep stdout restricted to protocol messages; errors/help use stderr.
3. Repeat with a missing disposable server path: a request returns a protocol error and starts no server.
4. For separate signed packaged proof, use the release skill's `--signed-verification` mode in an isolated exact-head Mac checkout. Launch the non-installed bundle's absolute executable with an isolated profile, without debugger switches. Record signature, hardened runtime/entitlements, ASAR and locked fuses, then repeat the MCP/coexistence/EOF journey.

Automated coverage: `mcp-command.spec.ts`, `cli-program.spec.ts`, `bridge.e2e.ts`.

## Gotchas

- The app must remain running, including when viewing a remote computer. Dev's command includes its staged executable and entry; a packaged command uses the absolute app executable alone.
- Bridge read failure disables copy; Retry MCP configuration reads again. No global CLI, credential, shim or relaxed fuse is needed.
- Linux does not prove packaged Mac behavior. Signed candidate proof does not establish notarization or Gatekeeper distribution acceptance.
