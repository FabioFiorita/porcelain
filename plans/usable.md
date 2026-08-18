# Make Porcelain usable

Status: active. This is the only backlog. Do not add gates, ADRs, or docs unless a slice below
cannot ship without them. Delete this file when all four slices are on `main` and the app has
been used on a real monorepo for a week.

You are implementing product. The human reviews the running app, not your diff.

## Already true

- Worktree click stays in one window (`apps/web/src/features/projects/hub-tree.tsx`). The
  Electron special-case that called `newWindow` is gone.
- Metrics already exist: coverage, `lint-architecture`, complexity, 450-line ceiling, mutation,
  knip. Do not add a seventh.
- `apps/mobile` is frozen. Do not touch it.
- Do not rewrite. Do not open `plans/refounding.md` or `plans/architecture-refactor/` — they are
  gone on purpose.

## How to ship a slice

1. One slice per PR. Branch `work/<slice-slug>` from current `main`.
2. Read the surface doc named in the slice before editing.
3. Prove at the lowest test that can fail the behaviour. Then `pnpm quality:changed`.
4. Slice 1 and 2 need Mac proof: Electron build, click the flow, screenshot. Linux unit tests
   are not enough for those two.
5. Do not push unless asked.

## Slice 1 — Mac: one window, two daemons

**Done when:** In the Mac app, clicking a worktree on any connected daemon switches this
window. No second window. Switching back works. Tabs from the previous worktree stay.

**Where:** already patched in `hub-tree.tsx`. Verify on Mac against both real daemons. If
anything else still calls `newWindow` / `openWindowInEnvironment` on a worktree *click* (not
an explicit "new window" button), delete that path too. Check
`apps/web/src/features/remote/remote-shell.ts` and `apps/web/src/components/git/worktree-switcher.tsx`.

**Proof:** Mac Electron, both remotes connected, click worktree A then B. One window. `pnpm --dir
apps/web exec vitest run src/features/projects/hub-tree.test.tsx`.

## Slice 2 — Cloudflare Tunnel (not Clerk)

**Do not add Clerk.** T3 Connect is Clerk + a hosted relay + PlanetScale, built for 100k users.
Paseo's production relay is a hosted Elixir service; the Cloudflare code in that repo is
*legacy and not deployed*. Porcelain has no users to log in. Identity is already pairing.

**Copy this instead:** T3's `t3 connect link` installs `cloudflared` and the daemon dials
outbound. Pairing stays. That is the side-project version of T3 Connect.

**Done when:** `porcelain-daemon serve --cloudflare` publishes loopback on a quick
`*.trycloudflare.com` URL. Pair once. Open Mac or browser at that URL. No Tailscale
required. `--lan` and `--tailnet` stay. `--funnel` is gone — Cloudflare is the public
HTTPS path.

**Shape:** wrap `cloudflared` the way Funnel used to wrap Tailscale
(`apps/daemon/src/features/remote/`). Outbound. Never bind `0.0.0.0`. Never send repo
contents to a Porcelain server. Bearer + pairing still gate every request. Two daemons =
two tunnels, two pairing links, two remotes in the Hub. Tailscale and Cloudflare are
exclusive. Clients try LAN, then Tailscale, then Cloudflare.

**Where:** `apps/daemon/src/features/remote/`, `docs/remote-setup.md`,
`plugins/porcelain/skills/porcelain-remote/`.

**Proof:** tunnel against the *dev* daemon first, then a named tunnel on a second daemon
with its own home and port. Tests for start, stop, and "cloudflared missing" sit next to
the Cloudflare tests. Mac: pair, open a worktree, one window.

## Slice 3 — Create and dispose worktrees

**Done when:** Create asks for branch *and* destination on disk. Create runs Actions marked
`on create` after the checkout exists. Dispose asks for confirmation, runs Actions marked
`on dispose`, then removes the worktree. A failing create hook leaves the worktree and shows
the error. A failing dispose hook aborts deletion.

**Where:** `docs/surfaces/navigator.md` is the contract.
`apps/web/src/features/projects/create-worktree-dialog.tsx` already picks a branch — add
destination. Daemon create/remove lives under `apps/daemon/src/features/projects/` and
`apps/daemon/src/features/git/`. Actions already exist; add the create/dispose marking, do
not invent a second hook store (`docs/product.md`, CONTEXT.md Action).

**Proof:** playground `worktrees` shape plus a second destination path. Create, see the hook
run, dispose, see teardown, confirm a failing dispose does not delete.

## Slice 4 — Worktree profile

**Done when:** `porcelain worktree profile get|set` reads and writes pins, hides, and layer
order for *this* worktree. The file tree and the Changes list honour it. A worktree with no
profile is a plain tree. The full tree stays reachable. Profiles are personal, die with the
worktree, and are never written by Porcelain on its own (`docs/surfaces/worktree-profile.md`,
ADR 0003, ADR 0006). Layer grouping stays in `apps/daemon/src/review/flow.ts`.

**Where:** CLI under `apps/cli`. Store on the daemon-root project record, not in tracked
`project.json`. Web tree: `apps/web/src/features/files/`. Changes grouping: extend
`groupByLayer` in `flow.ts`.

**Proof:** set a profile on one worktree of a two-worktree playground; the other worktree is
unchanged. Hide a path, confirm it is folded and still openable. Set layers, confirm Changes
order follows them.

## Track B — one plugin, then MCP, then delete the CLI

Decided 2026-08-18. Runs alongside the slices; it is distribution and plumbing, not a slice.

The reason is not "MCP is stateless now." Commit `7833529` killed the MCP server for
**per-agent config writing** and stdio/PATH pain. A plugin *is* the config, and MCP
2026-07-28 makes the server a route on the daemon that already runs — both original causes
are gone. The prize is that `apps/cli` stops being a **second writer**: it reimplements the
daemon's Project Data write path against `$PORCELAIN_HOME` on disk
(`apps/cli/src/project-io.ts`: "Mirrors daemon project-channel atomic tmp+rename"). One
writer is the point.

1. **Done.** `plugins/porcelain/` with both manifests, independent semver, bump gate
   (`pnpm lint:plugin`).
2. The app stops printing `npx skills` and points at the plugin. Delete `skills.sh.json`.
3. `/mcp` on the daemon, thin over the existing routers. Opt-in — tool defs cost context on
   every agent turn.
4. Dogfood a whole Review through MCP only, CLI present but unused.
5. Delete `apps/cli`, `cli-install.ts` (daemon + shell), `lint:cli`, and the AUD-08/11/12
   rows. Ratchet in the same commit: nothing writes `$PORCELAIN_HOME` outside the daemon's
   Project Data adapter.

**Conflicts to settle when they land.** Slice 4 writes `porcelain worktree profile get|set`
under `apps/cli` — build it as an MCP tool instead, or accept it dies in step 5. Step 5 also
wants the "use it for a week" gate below to have happened first.

Open design questions, all owned by step 3:

- Stateless means **no cwd**. The CLI resolved Project/Worktree from the git toplevel; every
  tool call needs an explicit handle instead.
- Loopback `/mcp` is not the CLI's posture — a webpage can POST to `127.0.0.1`, it cannot exec
  a binary. Origin validation or keep the token (AUD-03 owns that boundary).
- A static `mcp.json` names one URL; dev is 43118 and worktrees are 43200–43999.
- The daemon must be running. Accepted regression — make the failure say so.
- Do not transliterate the 17 verbs into 17 tools.
- **The portable `mcp.json` cannot carry the token.** Claude Code has `userConfig`, so
  its manifest prompts for `~/.porcelain/admin-token` on install. Agent Plugins 1.0.0
  expands `${PLUGIN_ROOT}`/`${PLUGIN_DATA}` in stdio `args`/`env`/`cwd` only — nothing
  in HTTP `headers` — so the portable file names `${PORCELAIN_ADMIN_TOKEN}` and a client
  that does not expand it needs the header set by hand. Unsolved, not hidden.
- The CLI never carried review comments or reviewed marks. `comment-router` and
  `review-marks-router` are live on the daemon and the agent has no reach — restoring that
  is the point, not tool-count math.

## After slice 4

Stop. Use it on a real monorepo for a week. UI redesign, Tasks polish, and anything not in
the four slices wait for that week. If it is not opened, the next conversation is whether
to archive, not what to build next.
