# Data Fetching & IPC

- **Data fetching = tRPC v11 + @tanstack/react-query v5 over TWO transports.** (1) The **appRouter** is
  real tRPC over `httpBatchLink` to the daemon; its streams and push ride the ONE zod-validated WS
  session, where terminals and watch registration are **messages, not procedures**. (2) The
  **shellRouter** rides a serialized-HTTP shuttle over `invoke('trpc-shell')` replayed through
  `fetchRequestHandler`: **keep all protocol logic inside tRPC — only shuttle bytes.** Don't
  reintroduce a transport that reads tRPC internals; that is what rotted `electron-trpc` (abandoned at
  0.7.1, never supported v11). Shell push is the `shell-event` IPC channel; daemon push is the WS
  session. **Neither is a tRPC subscription — there are none.** Never raw `ipcMain`/`ipcRenderer` for
  data; never cast.
- **Components never import `@renderer/lib/trpc` or `@renderer/lib/daemon`** (Biome
  `noRestrictedImports` on `components/**`). Server access goes through domain hooks that own their
  post-mutation invalidation; the WS session is reached only through `use-app-events` /
  `use-terminal-channel` / `use-files`. The vanilla tRPC client is sanctioned only in `stores/repo.ts`
  and `use-app-events.ts`.
- **Never `void` a promise** to silence a floating-promise lint — use `async`/`await` or
  `await Promise.all([...])`.
- **The shell forks the daemon via `utilityProcess.fork` — NEVER via `spawn(process.execPath, …,
  ELECTRON_RUN_AS_NODE)`.** Packaged builds fuse `RunAsNode` OFF and **the fuse silently IGNORES the
  env var**, so a child_process spawn boots the child as a second full GUI app whose own
  `startDaemon()` spawns another — a recursive fork bomb, caught only in a pre-publish fuse check
  because dev and e2e run unfused. `utilityProcess` runs a real Node environment regardless of the
  fuse, and node-pty's Electron-ABI build stays valid. Lifecycle differs from child_process: only
  `spawn`/`exit` events exist (**no `error`**), so every way down lands on `exit` — `onChildDown` and
  `awaitReadyLine`'s reject both key off it, with `wentDown`/`cleanup` flags guarding a double signal.
  The shell also sets `PORCELAIN_NO_STDIN_WATCHDOG=1` (a utility child has no stdin). *Verify:*
  `kill -9` the daemon while the app runs → it restarts and the UI recovers; in a packaged build
  exactly ONE process has `daemon/server.js` in argv.
- **On WS-session close, DETACH senders (PTYs survive) — but still reject every in-flight and queued
  terminal create AND attach, and clear the outbox** (`session.dispose` → `detachSender`, **not** a
  kill). A PTY's lifetime is decoupled from the connection, so a dropped socket must not end a shell —
  but a `createTerminal`/`attachTerminal` promise whose reply died with the socket would hang forever,
  and replaying a stale `terminal:create` from the outbox on a much-later reconnect would spawn an
  abandoned shell nobody awaits. Reconnect DOES re-register watch sets, re-attach every streamed
  terminal, and flush the outbox on a *live* open — but pending creates/attaches are rejected, not
  replayed (attaches drop their id so the next hydrate retries). **Don't make creates auto-replay and
  don't reintroduce a kill-on-close path.**
- **A session's scrollback is byte-capped (64 KB).** Attach replays retained output into the
  reconnecting client's xterm, so it must be remembered — but a chatty long-running shell would grow
  daemon memory without bound. Newest ≤64 KB kept, oldest dropped. Don't remove or unbound the cap.
  *Verify:* `scrollback-buffer.test.ts`.

