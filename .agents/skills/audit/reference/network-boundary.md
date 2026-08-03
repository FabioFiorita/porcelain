# Network & Process Boundary

## Process boundary

- **External URLs go through `isSafeExternalUrl`** (`external-url.ts`; http/https/mailto allowlist).
  Every `shell.openExternal` / `setWindowOpenHandler` path is gated, or rendered content can run
  `file://` and custom-scheme URLs. Extend `ALLOWED_PROTOCOLS` deliberately; never drop the guard.
  *Verify:* lint-enforced, but the lint is a proxy — it can't tell a gated call from an ungated one
  *inside* a file that already imports the guard, so still read a change to `window.ts` itself.
- **`readFile` stats before it reads** and returns `{type:'too-large'}` above `MAX_READ_BYTES`
  (10 MB). Never read the bytes of an oversized file — a multi-GB file in a 50 GB monorepo OOMs the
  process.
- **`apps/daemon` is the only OS/git/fs surface.** `apps/desktop/src/main` keeps the Electron-native
  rump (dialogs, windows, updater, plugin installer); the web client is pure UI with no Node APIs, and
  `@main/*` imports there are **type-only** — a runtime import leaks Node into the bundle.
- **Never write into the user's work repos.** Per-repo state lives under `userData`, keyed by repo
  path.
- **Dev never opens or mutates real repos.** The dev stack uses `porcelain-dev` and a seeded
  playground; a managed worktree derives per-slug user data/channels and passes
  `PORCELAIN_DEV_PLAYGROUND` for its disposable playground. That override is a daemon-only knob and
  **must stay in `terminal-env.ts`'s scrub list**.

## The daemon is the ONE sanctioned listener — loopback-first, ALWAYS credential-gated

"The app opens no port" no longer holds, so the surface is deliberately hostile-input-hardened. All
of the following must stay true.

**(1) Binds are loopback plus, optionally, enumerated private interfaces behind the same gate.**
`listen(port, '127.0.0.1')` ALWAYS; on opt-in, second listener(s) on the detected Tailscale address
(100.64/10) OR the machine's RFC1918 addresses — both from the one `createIfaceListener` factory
sharing the same handlers, so the token gate applies unchanged. **Never `0.0.0.0`, never any other
interface.** Range alone was not enough: binding a Docker bridge address serves the daemon — and
therefore a shell — to every container on that bridge, so `findLanAddresses` also denies
virtual/container/VPN interface-name prefixes. That is a **deny** list because physical NIC names are
unenumerable and the range check already fail-closes on public addresses. `findTailscaleAddress`
refuses ambiguous multi-candidate setups (logs, returns null) rather than guessing, since the
100.64/10 match is range-based by design and non-Tailscale CGNAT interfaces exist. "Just bind
0.0.0.0 since we bind everything anyway" is wrong.
**Cleartext-credential-on-LAN is an accepted tradeoff:** the tailnet is WireGuard-encrypted, but on
a plain home LAN the bearer credential crosses the wire in cleartext and a sniffer can capture it —
accepted the way local dev tools accept it, but ONLY because the LAN bind is opt-in, default-off,
recorded here, and never silently widened past the enumerated private addresses.
**Tailscale Funnel is a proxy, not another listener:** public HTTPS exposure of loopback only by
explicit config/env/CLI action. `funnel.ts` must use `execFile` **without a shell**, refuse a nonempty
conflicting or unowned configuration, and turn Funnel off only when the 0600 Porcelain marker owns
this exact daemon target. Never adopt or erase another service's Funnel.

**(2) Auth is never optional.** Every `/trpc` request needs `authorization: Bearer <credential>`
(constant-time compare over sha256 digests, else 401); the WS upgrade needs the
`porcelain.<credential>` subprotocol or the handshake is rejected. *Why:* loopback is reachable from
any webpage the user's browser has open, and **WebSockets carry no CORS at all**, so an
unauthenticated `/session` hands `terminal:create` — a shell — to drive-by web content. The token gate
is the whole boundary: a holder can already open/read any path, so the daemon-side `browseDirs`
(directory names only) widens nothing.

**(2b) Two credential scopes, one gate.** `authenticate()` accepts the local administrator credential
(`~/.porcelain/admin-token`, 0600) or a client token whose sha256 hash is in `access.json` (0600). The
plaintext administrator credential only reaches the local Electron renderer and host CLI.
Access/network/Funnel procedures use `adminProcedure` — never make them ordinary client procedures.
Revoking a client removes its hash **and closes that client's live WS sessions**: the gate runs at
upgrade time, so removing the stored hash alone is insufficient. *Verify:* `admin-token.test.ts`,
`access-store.test.ts`, `daemon-http.test.ts`.

**(3) No credential appears in argv** (`ps`-visible), daemon logs/stdout (the only stdout line is the
port), or a spawned PTY's env. A connection link carries the one-time secret **only in the URL
fragment**, which browsers never send on GET — never move it to the query or path, never log or render
it beyond the explicit copy surface. Saved environments store client tokens in plaintext under
`userData` (a user-owned directory), tokens are stripped from renderer query results, and a token is
sent only to a verified endpoint of its own entry.
**The administrator token that DOES reach the renderer is the LOCAL daemon's**, handed to remote-bound
windows too so they can open a second connection to the machine the app runs on. Safe for one reason
worth keeping: an Electron window always loads our own renderer dist from disk (`loadFile`,
`will-navigate` guarded), so a remote-bound window runs trusted code — a remote daemon never serves it
HTML. **If a window is ever loaded FROM a remote daemon's static server, this becomes a real
credential leak and must go first.** It stays Electron-only (the shell router throws in the browser).
**An entry must never come to hold two different machines' addresses** — that is what would put one
machine's token on another's wire, in cleartext, on a LAN. The identity proof is the existing
entry's credential authenticating at the new address; reported hostnames like `ubuntu` only nominate
a candidate because they collide. The proof gates explicit group attach
and an automatic host-nominated merge. A duplicate entry is cosmetic; a merged pair of machines is a
leaked credential.

**(4) CORS is scoped, never `*`** — only the dev Vite origin or the packaged `null` origin is echoed.
The preflight carries nothing sensitive; the Bearer check on the real request is the gate.

**(5) Static serving widens nothing.** Non-`/trpc`, non-`/session` requests get the renderer dist —
**GET/HEAD only, unauthenticated by design** (the app shell is not secret). It must stay this narrow:
it only reads files INSIDE the dist root (`resolveStaticPath` decodes, normalizes, and rejects
traversal, encoded `%2e%2e`, absolute paths, backslashes — unit-tested), never reads user files, adds
**no write surface**.
**(5b) Pairing is the one narrow unauthenticated mutation.** `POST /pair` accepts only an ≤8 KB JSON
body, is rate-limited per remote address, and atomically consumes a 15-minute single-use grant;
plaintext pair/client secrets are never stored. Do not add another unauthenticated dynamic route or
broaden this exchange. `rewriteCsp` touches **only `connect-src`**. The rewritten shell MUST stay
`no-cache` (host-specific, pointing at release-hashed assets); only fingerprinted `/assets/*` may be
`immutable`, and compressed variants keep `Vary: Accept-Encoding`. Don't relax any of this to "make
local dev easier."

**(6) A client credential is the user boundary across every network — accepted.** A peer presenting
one gets everything loopback gets: arbitrary-path `readFile`/`writeTextFile`/`renamePath`/`trashPath`
and `terminal:create`. That's the design — the token holder IS the user. Consequences: the token file
and the saved-environments file are exactly as sensitive as user-level shell access on the daemon
host; a token sniffed off a LAN grants a shell; the second-listener binds must never widen beyond
their enumerated addresses. Funnel is intentionally public HTTPS, so possession of a device credential
is its entire product boundary. Keep admin-only procedures separate, but **do not repo-scope ordinary
file procedures** — that breaks cross-repo flows.

*Verify:* `rg -n "createServer|listen\(|http\.createServer" apps/daemon apps/desktop/src/main apps/cli`
hits at most two `createServer` sites (`server.ts`, `tailnet-listener.ts`) and nothing in `apps/cli`;
the loopback `listen` still passes `'127.0.0.1'`; the factory binds only `findTailscaleAddress()`/
`findLanAddresses()` results; all listeners share the Bearer + subprotocol checks;
`static-server.test.ts` traversal and connect-src-only tests stay green.

## PTY environment

- **A spawned PTY's env is scrubbed of the daemon's internals** (`terminalEnv` in `terminal-env.ts`,
  unit-tested — extracted from the one impure module precisely so the strip list is testable).
  `DAEMON_ONLY_ENV` must cover: `PORCELAIN_ADMIN_TOKEN` (a secret — `env` would print it),
  `PORCELAIN_ADMIN_TOKEN_FILE`, `PORCELAIN_ACCESS_FILE`, Funnel controls, the other daemon-only
  `PORCELAIN_*` knobs, `ELECTRON_RUN_AS_NODE` (would make any Electron binary launched from the
  terminal silently run as plain Node), and **`_VOLTA_TOOL_RECURSION`** — Volta's shim sets it on the
  real node process when the daemon starts via `~/.volta/bin/node`, and if it leaks every
  `node`/`yarn`/`npm` shim thinks it is a recursive tool call, skips the managed platform, and fails
  with "Node is not available"/ENOENT (VS Code works because its PTY host never has the flag). The
  user's real environment otherwise passes through untouched. *Verify:* a new daemon env var that must
  not leak is added to `DAEMON_ONLY_ENV`; `terminal-env.test.ts` still asserts the token,
  `RUN_AS_NODE`, and `_VOLTA_TOOL_RECURSION` are absent.
