# Code map

Use this page to find the owning code, then read its contracts, implementation, and nearby tests.
[Domain terms](glossary.md) explain the product language. [Decisions](decisions/) preserve choices
and tradeoffs that code alone cannot explain.

## Runtime and packages

```text
browser ─┐
Electron ├─> daemon ─> repositories, Git, terminals, review data
mobile  ─┘
agent plugin ────────> daemon
```

| Concern | Start here |
| --- | --- |
| Daemon composition and lifecycle | [server](../apps/daemon/src/server.ts), [composition](../apps/daemon/src/daemon-composition/) |
| Wire inputs, outputs, and errors | [procedure catalog](../packages/contracts/src/procedure-catalog.ts), [domain contracts](../packages/contracts/src/) |
| Live protocol | [session contracts](../packages/contracts/src/session/), [daemon sessions](../apps/daemon/src/session/) |
| Shared client behavior | [client runtime](../packages/client-runtime/src/) |
| Browser and Electron presentation | [web client](../apps/web/src/) |
| Native desktop lifecycle and IPC | [desktop main process](../apps/desktop/src/main/) |
| Native mobile client | [mobile integration map](../apps/mobile/docs/daemon-api.md) |
| Agent operations | [MCP handlers](../apps/daemon/src/net/mcp/), [shipped plugin](../plugins/porcelain/) |
| Shared primitives | [shared utilities](../packages/shared/), [UI](../packages/ui/) |

For a behavior change, follow the relevant domain from `packages/contracts/src` to
`apps/daemon/src/features` and `packages/client-runtime/src`, then its client consumers. Keep
capabilities with their owner; share client semantics when more than one client needs them.

## Focused entry points

- Environments: [contracts](../packages/contracts/src/environment.ts),
  [WSL management](../apps/desktop/src/main/wsl-environments.ts),
  [mobile connections](../apps/mobile/src/features/remote/).
- Review and persistence: [project-data contracts](../packages/contracts/src/project-data/),
  [daemon project data](../apps/daemon/src/features/project-data/),
  [review implementation](../apps/daemon/src/review/).
- Terminal rendering: [browser adapter](../apps/web/src/terminal/ghostty/README.md),
  [native module](../apps/mobile/modules/porcelain-terminal/README.md).
- Development profiles and launchers: [development guide](development.md).
- Host administration: [remote operations](remote-access.md).
- Packaging and publishing: [release guide](release.md).
