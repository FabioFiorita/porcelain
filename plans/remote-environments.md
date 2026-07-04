# Remote environments — Porcelain client/server split

**Status:** specced 2026-07-04, grilled and decided with Fabio. Not started.
**Driver:** new Beelink mini PC (Linux, 32GB, arrives ~mid-July 2026) becomes the machine where Claude Code, builds, and typecheck run; the MacBook (16GB) and iPad become clients. Everything heavy runs on the Beelink; Porcelain must view/control a repo that lives on the Beelink's disk.

## Architecture decision (t3-style, always client/server)

Porcelain becomes a thin client talking to a **Porcelain daemon** over one WebSocket — *always*, even fully local. The Mac Electron app spawns a local daemon as a child process and connects to `ws://localhost`; remote is the same daemon on the Beelink reached over the tailnet. Local and remote are one code path and cannot drift. Reference implementation studied and cloned at `~/Code/t3code-main` — read `docs/architecture/remote.md`, `apps/desktop/src/backend/DesktopBackendManager.ts`, `packages/tailscale/src/tailscale.ts`.

Key insight from t3: **Tailscale is not a transport, it's reachability.** The daemon binds to the Tailscale interface + localhost only; clients connect to a tailnet URL (MagicDNS). Nothing is mounted or synced; file reads, git, PTYs, and channel data are all RPC/streams answered by the daemon from its local disk.

## Decisions (from the 2026-07-04 grilling)

1. **Server shape: headless Node daemon.** Extract the tRPC routers + services into an Electron-free package. Audit verdict (see below): ~85% of the backend is already pure Node; `src/mcp/` proves the data layer runs headless.
2. **Local mode: t3-style always-WS.** The Mac app spawns the daemon as a child (health-check, restart on crash, kill on quit, port management). No IPC transport survives. `pnpm dev` becomes two processes; e2e drives both.
3. **Auth: tailnet + shared token.** Daemon binds Tailscale interface + localhost only, never 0.0.0.0. Static token in `~/.porcelain/daemon-token` on both ends, presented on WS connect. No TLS needed — WireGuard encrypts the wire. ~30 LOC, proportionate for a solo tailnet.
4. **iPad: in v1.** The daemon serves the renderer as static files over HTTP; Safari on the iPad connects over the tailnet. Consequences owned: renderer must be zero-Electron (Biome-enforceable — nothing in `src/renderer` imports/assumes preload APIs), glaze needs a **fallback backdrop** (no macOS vibrancy in a browser — a first-class static backdrop layer behind the tiles), Safari steals some ⌘-shortcuts + touch targets need a pass (Linux-port branch `claude/agitated-hugle-4642c3` has prior art for modifier remapping).
5. **Repo identity: daemon-side registry.** Repos ARE daemon absolute paths. Clients never send their own paths; the welcome screen lists the daemon's recent repos, and `openRepo` becomes a remote directory browser (tRPC readDir picker) replacing the native dialog. **Zero schema changes** to the eight `~/.porcelain` channel files — their absolute-path keys stay, and the MCP server on the Beelink already agrees with them. `revealInFinder`/`openExternal` remain client-side (they act on the machine with the screen).
6. **PTY lifetime: survive disconnect, reattach.** Daemon owns PTYs independent of connections, keeps a scrollback buffer (~64KB) per session, replays on reattach. "Sessions outlive tabs" extends to "sessions outlive connections" — close the Mac, open the iPad, same Claude Code session. Explicit kill only from the Terminal list. (Today `terminal-manager.ts` kills PTYs on sender close — that must go.)
7. **Multi-client:** daemon broadcasts app-events to all connections (push channel is a bare re-poll enum — fan-out is trivial); last-write-wins.
8. **Dev-server preview:** free via tailnet — servers started in the remote terminal bind on the Beelink, opened from Mac/iPad as `http://beelink:3000` (MagicDNS); Vite needs `--host`.

## Extraction audit findings (2026-07-04, full audit in session)

- One flat router (`src/main/api.ts`, ~90 procedures) already mounted via tRPC's **fetch adapter** (`ipc.ts`) — mounting the identical router on a WS/standalone adapter is a ~50-LOC daemon entrypoint, zero router changes. Renderer already uses `httpBatchLink`.
- **GREEN (~4,000 LOC, moves as-is):** `git.ts`, flow/feature engine, all eight channel stores, `app-events.ts`, `review-watch.ts`, `file-watch.ts` (already fenced behind structural `FileWatchSender`), all of `src/mcp/`, ~75 pure procedures.
- **YELLOW (~300 LOC):** `config-store.ts` (`app.getPath('userData')` → env/XDG path), `plugin*.ts`/`codex*.ts` (`app.getAppPath` → path constant), `terminal-manager.ts` (WebContents sink → connection sink).
- **RED (~430 LOC, stays in shell):** `index.ts`, `window.ts`, `menu.ts`, `updater.ts`, `ipc.ts` (replaced by WS adapter). Electron-touching procedures to relocate/redesign: `openRepo` (native dialog → remote picker), `revealInFinder`, `windowInit`, `newWindow`, `watchFiles`/`watchDirs` (`ctx.sender` → connection handle), updater trio (client-side), `trashItem` uses (→ fs-based).
- The only `ctx.sender` readers are `windowInit`, `watchFiles`, `watchDirs`. Channel files key by absolute repo path but entries are repo-relative + `isRepoContained`-validated — the daemon-registry decision makes this a non-issue.

## Phases (each lands on main behind the verify gate; app fully working after each)

**Phase 1 — Extraction + local daemon (pure refactor, zero new features).**
Backend package with zero Electron imports; daemon entrypoint mounting the router over WS on localhost; Electron main spawns/manages it; renderer talks WS. Acceptance: daily driving indistinguishable from today; `pnpm verify` green; a Biome/lint fence exists against Electron imports in the backend package and renderer.

**Phase 2 — Network-ready: token auth + reattachable PTYs + remote repo picker.**
Token handshake; PTYs survive disconnect with scrollback replay; daemon-side repo registry + remote directory picker; broadcast pushes. Acceptance: kill the renderer mid-Claude-session, relaunch, reattach with scrollback; second client connects simultaneously.

**Phase 3 — Browser client (iPad).**
Daemon serves renderer static files over HTTP; glaze fallback backdrop; Safari/touch/shortcut pass. Acceptance: full review flow (Changes, Feature, comments, board, terminal) from Safari on the iPad against a localhost daemon.

**Phase 4 — Beelink bring-up (ops, no code).**
Install Node + daemon + Claude Code + porcelain MCP plugin on the Beelink; join tailnet; Tailscale SSH on; daemon bound to tailscale IP; Mac app + iPad pointed at `ws://beelink`. Acceptance: end-to-end feature review of a real repo living only on the Beelink.

## Traps already identified

- Two processes in dev: dev loop, logging, and Playwright e2e must manage daemon lifecycle (see t3's `DesktopBackendManager`).
- PTY orphan reaping moves from window-close to explicit kill + daemon shutdown.
- Vibrancy void: browser build must not look broken — backdrop fallback is a design task, not a bug fix.
- `openRepo` on iPad/remote is a *remote* picker; the native dialog only remains for picking where the *local* daemon looks.
- Hardware: the Mac has 16GB — one reason this project exists. Keep local daemon lean; heavy verify runs move to the Beelink after Phase 4.
