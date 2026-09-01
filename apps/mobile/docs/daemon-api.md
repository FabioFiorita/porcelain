# Mobile daemon integration

This page is a navigation map for the native client, not a second API specification. Procedure
names, inputs, outputs, errors, and session frames are executable contracts under
`packages/contracts`. When a contract changes, update its producers and consumers instead of
copying the catalog here.

## Start here

- `packages/contracts/src/procedure-catalog.ts` composes the daemon procedure catalog; each domain
  owns its schemas in the neighboring `*.procedures.ts` and `*.contract.ts` files.
- `packages/contracts/src/session` owns the live-session frames.
- `packages/client-runtime/src/session` owns shared connection and recovery semantics.
- `apps/mobile/src/lib/daemon` adapts those transports to React Native.
- `apps/mobile/src/features/remote` owns saved environments, endpoint failover, pairing, and
  credentials.
- `apps/mobile/src/features/projects` owns repository selection and project bootstrap.

Use the focused tests beside those files to understand observable behavior. The daemon router and
transport implementation live under `apps/daemon/src`; they are not mobile-owned documentation.

## Native-client boundaries

- Repository paths, files, Git state, terminals, Canvases, and Actions belong to the selected
  daemon. Never reinterpret daemon paths as phone filesystem paths.
- Device credentials stay in secure storage. Pairing grants a revocable client identity; it never
  gives the phone the daemon's administrator credential.
- One saved environment may contain several routes to the same daemon. Endpoint ordering and
  failover are client behavior, while each daemon remains authoritative for its own state.
- Live-session reconnects use the shared client runtime. Add protocol behavior to the contracts
  and shared runtime rather than maintaining a mobile-only variant.
- Host exposure, service installation, and remote administration follow
  [`docs/remote-access.md`](../../../docs/remote-access.md).

Keep this file thin. It should point to ownership and record native-only constraints, not list the
current procedures or preserve an implementation history.
