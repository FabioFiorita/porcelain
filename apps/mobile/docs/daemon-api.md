# Daemon API — the mobile client's contract

The native app is a fourth client of the same daemon the browser client talks to; everything below is what that client actually uses. Router: `apps/daemon/src/api.ts` (single flat tRPC v11 router, 114 procedures composed from the ten domain routers). Transport pipeline: `apps/daemon/src/features/remote/remote-http.ts`. When this doc and the code disagree, the code wins — update this doc in the same commit.

## Transport

| Path | Method | Auth | Notes |
|---|---|---|---|
| `/trpc/*` | GET/POST | `authorization: Bearer <token>` (401 otherwise) | tRPC `fetchRequestHandler`, endpoint `/trpc`, standard `httpBatchLink` batching |
| `/session` | WS upgrade | token as WS subprotocol `porcelain.<token>` | Hand-rolled JSON protocol in `packages/contracts` (`@porcelain/contracts`) — app events, terminal streams, watch registrations. Not tRPC |
| `/pair` | POST | **unauthenticated** (the only such mutation) | `{"credential":"pc_pair_<id>_<secret>"}` → `{"token":"pc_client_<id>_<secret>","client":{id,label,createdAt}}`. Rate-limited 12/min/IP, 8 KB body cap |

No cookies, no CSRF, no session state. CORS: requests without an `Origin` header get no CORS headers and are allowed — a native app passes; WS upgrades have no origin check. The Bearer token is the real gate.

## Reachability (the actual constraint)

The daemon always binds `127.0.0.1`; a phone reaches it only through an opt-in second listener, all admin-toggled from the host (Mac shell / daemon CLI), **never** from a paired device:

- **LAN bind** — RFC1918 addresses, port 43117, cleartext HTTP (accepted opt-in tradeoff).
- **Tailscale bind** — 100.64/10 tailnet address, port 43117, cleartext HTTP.
- **Tailscale Funnel** — public HTTPS proxy.

This is why the app ships `NSAllowsArbitraryLoads` / `usesCleartextTraffic` (see the architecture skill for the guardrails).

## Pairing (mobile = same flow as the browser client)

1. Host admin issues a link: `issuePairingLink({label, baseUrl})` → `<baseUrl>/pair#token=pc_pair_<id>_<secret>`. Single-use, **15-minute TTL**, stored hashed in `~/.porcelain/access.json`.
2. The mobile app takes a **pasted link** (no QR — deliberate), parses the URL: origin = the daemon base URL, fragment `token` param = the credential. Fragments never reach servers, so parse client-side.
3. `POST <origin>/pair` with `{credential}` → client token `pc_client_<id>_<secret>`.
4. Verify the new client token with `recentRepos`, then store the token + one or more verified endpoint URLs (+ user-chosen group nickname) in `expo-secure-store`. A group with one endpoint is valid. Every request thereafter: `Bearer` header; WS: `porcelain.<token>` subprotocol.
5. To add a LAN, Tailscale, or Funnel link to an existing group, redeem it into a temporary credential, verify that the existing group credential also authenticates at that URL, then revoke the temporary credential before saving the endpoint. This prevents two machines from sharing one group token.
6. A device can un-pair itself with `revokeCurrentClient` (the one access procedure clients may call). Everything else access-related (`accessStatus`, `issuePairingLink`, revocations, LAN/tailnet/funnel toggles) is admin-only and FORBIDDEN for paired clients — mobile cannot self-pair another device or flip binds.

**Environment groups are client-owned.** The desktop Remotes registry lives in the Electron shell router (IPC-only, not on any port). The mobile app keeps its own list of `{nickname, baseUrl, endpoints, preferredEndpoint, token}` groups in secure storage.

## Bootstrap sequence

1. Try the group's exact preferred endpoint, then last-known-good, then the remaining saved routes. Failover is sequential; a 401 stops immediately.
2. `daemonInfo` → `{version, protocolVersion, host, platform, arch}`. This is the current daemon identity, wire protocol, and build contract; a missing or malformed response is an invalid response.
3. `recentRepos({includeWorktrees:true})` → pick a repo (also the cheap "is my token valid" probe — the browser client uses it exactly this way).
4. `openRepoPath(path)` — **load-bearing**: records the recent, seeds worktree settings, warms the file-list cache. Always call it when switching repo.
5. Remember the endpoint that answered as last-known-good without changing the preferred route.
6. Open `/session` WS lazily; after choosing a repo send `session:hello {repo}` and `watch:files`/`watch:dirs` registrations. **On every reconnect** re-send hello, watches, and `terminal:attach` for each attached terminal — server-side session state dies with the socket.
7. `browseDirs(path|null)` walks daemon-side directories for the repo picker (`null` = daemon home).

## Live updates

Daemon-owned Canvas, Actions, scope, working-tree, and file-tree changes surface through the typed session stream. Canvas records are daemon-root and are read through the Projects procedures below; there is no repo-local Review reading lifecycle. Mobile should poll screen-focused data lazily to respect battery/cellular.

## Procedure catalog by feature area

All flat names; Q = query, M = mutation. No tRPC subscriptions exist.

### Files tab
- `readDir` Q `{repoPath, path, showHidden}` → `DirEntry[]` (`{name,path,kind,hidden,pinned}`)
- `repoScope` Q, `hidePath`/`unhidePath`/`pinPath`/`unpinPath` M, `pinnedEntries` Q — monorepo hide/pin
- `searchFiles` Q `{repoPath, query}` → fuzzy results, max 50 (drives the Files search bar)
- `searchText` Q (git grep), `searchCode` Q `{regex, caseSensitive, include, exclude}`
- `readFile` Q `{projectPath, path}` (POSIX-absolute project root + project-relative path) → `text|image(dataUrl)|binary|too-large|not-found` discriminated union
- `previewHtml` Q `{projectPath, path}` → inlined HTML string or `null`
- `writeTextFile` M `{projectPath, path, content}` (debounced autosave edits)
- fs mutations (all `{projectPath, …}` + relative targets): `createFile`, `createFolder`, `renamePath`, `duplicatePath` (returns **relative** new path), `trashPath`

`readDir`, scope mutations, `repoScope`, and `pinnedEntries` use absolute daemon-side paths. The
eight host-filesystem procedures use `projectPath` plus project-relative targets. All of them are
owned by the canonical Files feature router; there is no separate repository/settings router.

### Quick Open

Quick Open is a mobile presentation surface, not a daemon procedure. It combines the existing
`searchFiles`, `actions`, and `gitLog` queries locally, with a 150 ms file-search debounce. It
groups file matches, runnable Actions, recent commits, and local go-to destinations; actions marked
non-local are omitted, commit hashes accept 7–40-character prefixes, and a selected action or file
hands off to the existing terminal or viewer navigation. Content search remains a separate
`searchText`/`searchCode` flow.

### Changes tab
- `gitStatus` Q, `gitFlow` Q (layer-grouped working tree), `gitRangeFlow` Q (vs merge-base)
- `gitDiffFile` / `gitRangeDiffFile` / `gitCommitDiff` Q → `{hunks}`
- `diffReading` Q `{repoPath, scope: working|branch|commit}` → whole change as one continuous document (richest single call for a phone diff reader)
- staging: `gitStageAll`/`gitUnstageAll`/`gitStageFile`/`gitUnstageFile`/`gitDiscardFile` M
- commit: `gitCommit` M (clears reviewed marks), `gitSuggestions` Q, `gitCommitConventions` Q
- `gitPush` M, `gitQuickCommand` M `{command, pullMode?}`, `gitHead`/`gitBranches`/`gitWorktrees` Q, `gitCheckout`/`gitCreateBranch`/`gitAddWorktree` M
- reviewed marks: `setReviewed` M `{repoPath, paths, reviewed}` (total and idempotent — one call marks or unmarks a whole set), `reviewedPaths` Q
- History (inside Changes): `gitLog` Q `{limit≤500}`, `gitCommitFlow` Q, `gitCommitMessage` Q, `gitFileLog` Q (`--follow`)

### Canvas and Actions
- Canvas: `listCanvases` Q `{projectId, worktreeId?, worktreePath?}`, `readCanvas` Q `{projectId, canvasId, worktreePath?}`, `mintCanvasAccessToken` M `{projectId, canvasId, worktreePath?}`
- Actions: `actions` Q `{projectId}`, `addAction`/`updateAction`/`moveAction`/`deleteAction` M, `prepareActionRun` M — every mutation names its Project and Worktree target

### Terminal tab
- Roster via tRPC: `terminalSessions` Q → `{id,name,cwd,status,exitCode}[]`, `renameTerminal` M
- Everything else on the `/session` WS (JSON text frames):
  - → `terminal:create {reqId,name,cwd,initialInput?,cols?,rows?}` · `terminal:attach {id,reqId}` · `terminal:detach` · `terminal:write {id,data}` · `terminal:resize` · `terminal:kill`
  - ← `terminal:created {reqId,id}` (`id:''` = refused) · `terminal:attached {reqId,id,scrollback,status,exitCode?,found}` · `terminal:data {id,data}` (UTF-8 strings) · `terminal:exit`
- PTYs are daemon-owned and outlive sockets: detach ≠ kill; `MAX_SESSIONS = 64`; detached idle TTL 12 h. `cwd`/`initialInput` are **daemon** paths.
- Actions (definitions only — the daemon never executes them): `actions` Q, `addAction`/`updateAction`/`moveAction`/`deleteAction` M

### Cross-cutting
- `removeRecentRepo` M

## Mobile-side cautions

- Heavy payloads: `readFile` inlines images as data URLs; `diffReading` can carry up to ~200 files of hunks. Fine on LAN/tailnet; cap or defer on a Funnel/cellular path.
- Paths are **daemon-side**. The eight host-fs procedures take an absolute `projectPath` plus
  project-relative targets (no `~` expansion on those). `readDir`/scope use absolute host paths.
  Never touch the phone's filesystem for repo content.
- The mobile client and daemon are developed and delivered together. A missing procedure or
  malformed payload is an error; do not feature-detect alternate daemon contracts or silently
  degrade.
