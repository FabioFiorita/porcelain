# Mobile plans

Five implementation plans, one per worktree. Each is self-contained: a fresh agent implements it with
only that file and the repo. **`../daemon-api.md` is required reading in every worktree** — it is the
daemon contract all five implement against, and where it and a plan disagree, the daemon source wins
(fix the doc in the same commit, hard rule 4).

**`00-connection.md` §2 is the binding seam contract.** Every hook, component and file name the tab
plans use comes from there: `useDaemonQuery` · `useDaemonMutation` · `useDaemonInvalidate` ·
`useActiveEnvironment` · `useActiveRepo` · `useConnectionState` · `useDaemonSession` (`send`,
`subscribe`, `onReconnect`, `watch`, `request`) · `usePreference` · `DaemonGate` ·
`procedures/<tab>.ts` · `APP_EVENT_INVALIDATIONS`, with the key convention
`['daemon', envId, procedureName, input ?? null]`. If implementation forces a change, change it **in
00** and say so in the PR — a renamed seam after fan-out is four merge conflicts.

| Plan | What it lands |
|---|---|
| `00-connection.md` | Environments, pairing, the tRPC client, React Query wiring, the `/session` socket, repo selection, `DaemonGate`, device preferences — the seams the other four consume |
| `01-files.md` | Files tab: daemon-side tree, monorepo hide/pin, header search, the file viewer |
| `02-changes.md` | Changes tab: working-tree diff reading, staging, commit, and the pushed History screen |
| `03-review.md` | Review tab: the Review canvas, comments, loop evidence, and the pushed Board screen |
| `04-terminal.md` | Terminal tab: the daemon-owned PTY roster, attach/detach over the WS, saved actions |

## Dependency rule

**`00-connection` merges before any of `01`–`04` starts.** Every tab plan imports `useDaemonQuery`,
`DaemonGate`, `useDaemonSession`, and the app-event map from `src/lib/daemon/`; building a tab before
those exist means inventing a second transport, which hard rule 1 forbids. Once `00` is on `main`,
`01`–`04` run in parallel — they are deliberately sliced so each owns
`src/features/<tab>/`, its route files, and `src/lib/daemon/procedures/<tab>.ts` and nothing else.

## Shared merge points

The few files more than one worktree touches. Keep edits here minimal and additive:

- `src/lib/daemon/app-events.ts` — `APP_EVENT_INVALIDATIONS`, the `app-event` → procedure-name map
  and **the single append-point** for all five worktrees. `00` seeds every row the tab plans need, so
  most tabs append nothing; keep it flat and alphabetical so any conflict resolves trivially.
- `src/app/_layout.tsx` — root providers (`DaemonProvider`) and the root-level sheet routes
  (`settings`, `repo`). Owned by `00`; tabs add a screen at most, never a restructure.
- `src/app/settings/**` — `00` turns `settings/environments.tsx` into a folder
  (`index` · `pair` · `[id]`); Appearance/About plans may also land here.
- `src/lib/surface-handoffs.ts` — **new**, specified in `03-review.md` §2.4: typed `openDiff` →
  Changes' `/file?path=…&scope=working` (`02`) and `openFile` → Files' `/(files)/file/[...path]`
  (`01`). Whichever of `01`/`02`/`03` lands first creates it to that shape; the others fill in their
  own target. No second handoff helper.
- `src/lib/daemon/procedures/` — one file per tab, no barrel (a barrel is a guaranteed conflict).
- `src/components/toolbar-icon.ts` and `assets/toolbar/` — any tab adding a header button. Existing
  names: `settings`, `board`, `history`; `00` adds `repo`. An SF Symbol alone renders **nothing** on
  Android, so every new name needs a PNG too.
- `src/theme/colors.ts` — `02` adds the diff/status palette and the monospace helper.
- `apps/mobile/package.json` — any tab adding a dependency (`00` adds `zod`, `zustand`,
  `expo-clipboard`, `expo-crypto`, and `@trpc/server` type-only).
- `apps/mobile/README.md` — each tab updates its own paragraph.

## Shared verification recipe

Static gate for every worktree, from the repo root: `pnpm verify` (`lint` → `test` → `build`;
`build` runs the mobile typecheck, and `scripts/lint-escapes.mjs` covers `apps/mobile/src`). Unit
tests for pure modules run under the **root** vitest — `00` widens its `include` to
`apps/mobile/src/**/*.test.ts`; no test runner is added to the `apps/mobile` package.

Runtime proof runs on the `porcelain-dev` Android AVD against the **dev** daemon — never production
on 43117:

```bash
pnpm build && pnpm dev:daemon                      # dev daemon on 43118 — never production 43117
emulator -avd porcelain-dev &                      # AVD: porcelain-dev
adb reverse tcp:43118 tcp:43118                    # emulator 127.0.0.1:43118 → host dev daemon
PORCELAIN_HOME=~/.porcelain-dev PORCELAIN_DAEMON_PORT=43118 \
  node scripts/daemon-cli.js access issue --name "Emulator" --base-url http://127.0.0.1:43118
pnpm mobile:start                                  # Metro for the dev client — never Expo Go
```

The `PORCELAIN_HOME` / `PORCELAIN_DAEMON_PORT` prefix is **not optional**: without it
`daemon-cli.js` reads `~/.porcelain/admin-token` and talks to `127.0.0.1:43117` — i.e. it issues the
pairing link against the **production** daemon. A managed worktree substitutes its own 43200–43999
port everywhere 43118 appears, including `adb reverse`. First run on a fresh emulator needs the dev
client installed once (`pnpm --dir apps/mobile android`).

Pair once, open a repo from the dev playground, then exercise the tab under test and attach the
screenshots to the Review. Repos opened this way are daemon-side paths on the dev stack only.
