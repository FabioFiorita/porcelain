# 00 — Connection & environments

The prerequisite layer. Everything in `01`–`04` consumes the seams defined here; nothing here
depends on them. Read `../daemon-api.md` first — it is the contract this plan implements against,
and where it and this plan disagree, the daemon source wins.

## 1. Mission

When this worktree merges, the app can be pointed at a real daemon and stay pointed at it: the user
pastes a pairing link into Settings → Environments, the app redeems it, stores `{id, nickname,
baseUrl, token}` in `expo-secure-store`, picks a repo from the daemon's recents (or browses the
daemon's directories), and every screen in the app can then run a typed, zod-validated tRPC call
against the active environment with React Query caching, a `/session` WebSocket pushing
invalidations, and a coherent story for the three failures that actually happen (host unreachable,
token revoked, daemon too old). The four tabs are still placeholders — but each one now has an
empty state that routes to pairing instead of lying, and a one-import path to real data.

## 2. Shared seams this layer exports

This section is the contract `01`–`04` reference. Names and signatures here are binding; changing
one after merge means changing four plans.

### Module map — `apps/mobile/src/lib/daemon/`

| Module | Exports (public surface) |
|---|---|
| `environment.ts` | `Environment`, `EnvironmentId`, storage zod schemas, secure-store IO |
| `environments-store.ts` | zustand store + `useEnvironments`, `useActiveEnvironment`, actions |
| `repo.ts` | `useActiveRepo`, `openRepo`, `clearActiveRepo` |
| `pairing.ts` | `parsePairingLink`, `redeemPairingLink` (pure parse + one unauthenticated POST) |
| `client.ts` | `getDaemonClient(env)` — cached untyped tRPC client per environment |
| `procedure.ts` | `defineQuery` / `defineMutation`, `DaemonQuery`, `DaemonMutation` |
| `procedures/connection.ts` | this layer's procedures (`daemonInfo`, `recentRepos`, …) |
| `errors.ts` | `DaemonError`, `DaemonErrorKind`, `toDaemonError` |
| `queries.ts` | `daemonKeys`, `useDaemonQuery`, `useDaemonMutation`, `useDaemonInvalidate` |
| `ws-protocol.ts` | runtime zod mirrors of the daemon's `/session` frames |
| `session.ts` | `useDaemonSession`, `DaemonSession`, `SessionStatus` |
| `app-events.ts` | `APP_EVENT_INVALIDATIONS` — the event → procedure-name map |
| `preferences.ts` | `usePreference` — device-local, non-secret UI preferences |
| `provider.tsx` | `DaemonProvider` — the single wiring point in `src/app/_layout.tsx` |

Rules that keep four parallel worktrees off each other's files:

- **No barrel file.** Import from the exact module. A barrel is a guaranteed merge conflict.
- **Tab worktrees add `procedures/<tab>.ts`** (`procedures/files.ts`, `procedures/changes.ts`, …)
  and never edit `procedures/connection.ts`.
- **`app-events.ts` is the one file all five worktrees append to.** Keep it a flat map, one line per
  entry, alphabetically sorted, so appends conflict trivially.

### The transport seam — decision

**Decision: a hand-declared, zod-validated procedure contract, not an imported `AppRouter` type.**

I probed the alternative rather than guessing. A type-only `import type { AppRouter } from
'../../../src/backend/api'` resolves, but it drags 45 daemon modules into `apps/mobile`'s
`tsc --noEmit`, which then fails on daemon-only assumptions the mobile tsconfig can't hold
(`__PORCELAIN_VERSION__` is a build-time global, `ProcessEnv` overload mismatches in `git.ts`, node
vs. react-native lib config). Making it pass means bending the mobile tsconfig around daemon source
— which is exactly the "two patterns nobody chose" failure. The `.d.ts`-generation variant trades
that for a checked-in generated artifact that goes stale silently and orders `pnpm build` before
`typecheck:mobile`. The hand-declared contract costs one small zod schema per procedure used, and
buys something the imported type could never give: **runtime validation at a genuinely external
seam**. Version skew across daemon releases is real and stated in `daemon-api.md`; a compile-time
type asserts a shape the phone cannot verify, while a zod parse turns skew into a legible
`invalid-response` error instead of an undefined-property crash three renders later.

The client itself is still the real thing — vanilla `@trpc/client` v11 with `httpBatchLink`, so
batching, error shapes, and the URL contract are tRPC's, not ours:

```ts
// client.ts
import { createTRPCUntypedClient, httpBatchLink } from '@trpc/client'
import type { AnyTRPCRouter } from '@trpc/server' // type-only; verified to compile from apps/mobile

export type DaemonClient = ReturnType<typeof createTRPCUntypedClient<AnyTRPCRouter>>

/** One client per environment id, rebuilt when the token or baseUrl changes. */
export function getDaemonClient(env: Environment): DaemonClient
```

`@trpc/server` is a peer dependency of `@trpc/client` and is used **type-only**; declare it in
`apps/mobile` `devDependencies` at the exact root version (`11.17.0`) so knip's unlisted check and a
future reader both see it.

### Procedure descriptors

```ts
// procedure.ts
import type { z } from 'zod'

export type DaemonQuery<TInput, TOutput> = {
  readonly kind: 'query'
  readonly name: string
  readonly output: z.ZodType<TOutput>
}
export type DaemonMutation<TInput, TOutput> = {
  readonly kind: 'mutation'
  readonly name: string
  readonly output: z.ZodType<TOutput>
}

export function defineQuery<TInput, TOutput>(
  name: string,
  output: z.ZodType<TOutput>,
): DaemonQuery<TInput, TOutput>

export function defineMutation<TInput, TOutput>(
  name: string,
  output: z.ZodType<TOutput>,
): DaemonMutation<TInput, TOutput>

/** Call outside React (bootstrap, session hello). Parses; throws `DaemonError`. */
export function callDaemon<TInput, TOutput>(
  client: DaemonClient,
  procedure: DaemonQuery<TInput, TOutput> | DaemonMutation<TInput, TOutput>,
  input: TInput,
): Promise<TOutput>
```

Input is typed but **not** zod-parsed: we author it, so it isn't an external seam. Output always is.
`TInput` is phantom on the descriptor — that's deliberate, it makes `useDaemonQuery` infer the input
without a second type argument at every call site.

### Hooks

```ts
// queries.ts
export const daemonKeys = {
  environment: (envId: EnvironmentId) => ['daemon', envId] as const,
  procedure: (envId: EnvironmentId, name: string) => ['daemon', envId, name] as const,
  call: (envId: EnvironmentId, name: string, input: unknown) =>
    ['daemon', envId, name, input ?? null] as const,
}

export function useDaemonQuery<TInput, TOutput>(
  procedure: DaemonQuery<TInput, TOutput>,
  input: TInput,
  options?: {
    enabled?: boolean
    staleTime?: number
    /** Backstop poll interval in ms; applied only while foregrounded AND the socket is down. */
    backstopMs?: number
  },
): UseQueryResult<TOutput, DaemonError>

export function useDaemonMutation<TInput, TOutput>(
  procedure: DaemonMutation<TInput, TOutput>,
  options?: { invalidates?: readonly string[] },
): UseMutationResult<TOutput, DaemonError, TInput>

/** Imperative invalidation by procedure name, scoped to the active environment. */
export function useDaemonInvalidate(): (names: readonly string[]) => void
```

```ts
// environments-store.ts
export function useEnvironments(): readonly Environment[]
export function useActiveEnvironment(): Environment | null
export function useConnectionState(): ConnectionState
export const environmentActions: {
  add(input: { nickname: string; baseUrl: string; token: string }): Promise<Environment>
  rename(id: EnvironmentId, nickname: string): Promise<void>
  setActive(id: EnvironmentId): Promise<void>
  remove(id: EnvironmentId): Promise<void>   // local only — see `unpair` in the UX section
  hydrate(): Promise<void>                   // called once by DaemonProvider
}

export type ConnectionState =
  | { kind: 'loading' }
  | { kind: 'no-environment' }
  | { kind: 'connecting' }
  | { kind: 'ready'; daemonVersion: string | null }  // null = pre-0.30 daemon
  | { kind: 'unreachable'; message: string }
  | { kind: 'unauthorized' }
```

```ts
// repo.ts
export function useActiveRepo(): { path: string; name: string } | null
/** Calls `openRepoPath` (load-bearing), persists the choice, re-sends session hello. */
export async function openRepo(path: string): Promise<void>
export async function clearActiveRepo(): Promise<void>
```

```ts
// session.ts
export type SessionStatus = 'idle' | 'connecting' | 'open' | 'reconnecting'

export type DaemonSession = {
  readonly status: SessionStatus
  send(message: ClientMessage): void
  /** Returns an unsubscribe. Registering the first listener lazily opens the socket. */
  subscribe(listener: (message: ServerMessage) => void): () => void
  /** Fires after every successful (re)connect, once hello has been re-sent. */
  onReconnect(handler: () => void): () => void
  watch(paths: { files?: readonly string[]; dirs?: readonly string[] }): () => void
  /**
   * `reqId`-correlated request/response for the frames that carry one
   * (`terminal:create` → `terminal:created`, `terminal:attach` → `terminal:attached`).
   * The manager mints the `reqId`, `match` narrows the awaited reply, and a timeout
   * (default 10 s) rejects with a `DaemonError`. Callers never touch the raw socket.
   */
  request<TReply extends ServerMessage>(
    message: ClientMessage,
    match: (frame: ServerMessage) => TReply | null,
    options?: { timeoutMs?: number },
  ): Promise<TReply>
}

export function useDaemonSession(): DaemonSession
```

The session manager stays **feature-agnostic**: it owns the socket, `session:hello`, the
watch registrations, reconnect + `onReconnect`, and `reqId` correlation — and holds no
terminal state and no attachment bookkeeping. Re-sending `terminal:attach` after a reconnect
is the Terminal feature's job, riding `onReconnect` (see `04-terminal.md` §2.6/§4.4).

```ts
// preferences.ts — device-local, non-secret UI preferences (NOT per-environment,
// NOT secrets: "Show hidden" in Files, terminal font size, …). Backed by
// `expo-sqlite`'s key/value store (already a dependency); values are zod-parsed on
// read so a rewritten row degrades to the fallback instead of crashing.
export function usePreference<T>(
  key: string,
  schema: z.ZodType<T>,
  fallback: T,
): readonly [T, (next: T) => void]
```

Preference keys are namespaced strings owned by the calling slice (`files.showHidden`,
`terminal.fontSize`) — deliberately **no shared key registry**, so this never becomes a
second file every worktree appends to.

`ClientMessage` / `ServerMessage` are **type-only** imports from
`../../../../src/shared/ws-protocol` (verified: it depends on zod alone and typechecks cleanly from
`apps/mobile`). Metro does not bundle files outside the project root, so `ws-protocol.ts` re-declares
the zod schemas locally and pins them to the shared types:

```ts
const serverMessageSchema: z.ZodType<ServerMessage> = z.discriminatedUnion('t', [ /* … */ ])
```

Drift in the daemon protocol then becomes a **mobile compile error**, not a runtime surprise. (Adding
`metro.config.js` `watchFolders` to import the shared module directly is the tempting alternative —
deliberately not done here; see Out of scope.)

### Provider wiring — `src/app/_layout.tsx`

`DaemonProvider` goes **inside** `ThemeProvider` and **outside** `Stack`. It owns: the singleton
`QueryClient`, `environmentActions.hydrate()`, the bootstrap sequence, the WS session lifecycle, and
React Query's `focusManager` (driven by `AppState`) plus `onlineManager` (driven by `expo-network`).
It renders `children` immediately — hydration state is exposed through `useConnectionState`, never
through a blocking splash, so a cold start on a dead daemon still lands in a usable shell.

```tsx
<ThemeProvider value={…}>
  <DaemonProvider>
    <Stack>…</Stack>
  </DaemonProvider>
</ThemeProvider>
```

### Gate component — `src/components/daemon-gate.tsx`

```tsx
export function DaemonGate(props: {
  /** 'environment' — needs a paired daemon. 'repo' — needs a daemon AND an open repo. */
  requires: 'environment' | 'repo'
  children: ReactNode
}): JSX.Element
```

Every tab screen wraps its content in `DaemonGate`. That is the whole contract for empty/locked
states — tab worktrees write zero empty-state UI.

## 3. UX shape

`@expo/ui` universal components and expo-router only. No shadcn, no Tailwind, no DOM. `List` is
JS-thread-bound per row — fine for environments and recents (tens of rows), and the reason
`browseDirs` results get a row cap (see below).

### Settings → Environments (`/settings/environments`)

A `List` inside the existing settings stack:

- One `ListItem` per environment. Headline = nickname; `supportingText` = `baseUrl` plus a state dot
  (`Active`, `Unreachable`, `Token revoked`). Tapping a non-active row makes it active and pops back
  to the settings root.
- A trailing `Button` row: **Pair a daemon** → pushes `/settings/environments/pair`.
- Tapping the **active** row pushes `/settings/environments/[id]` (detail): rename via `TextInput`
  (`useNativeState`, per the expo-ui skill — its `value` is an `ObservableState`, not a string),
  read-only `baseUrl`, daemon version + host from `daemonInfo`, and **Unpair this device**.
- Empty list: a short line explaining that Porcelain is useless without a remote, and the same
  **Pair a daemon** button.

**Unpair** = `revokeCurrentClient` mutation, then `environmentActions.remove(id)` regardless of the
result. If the daemon is unreachable the token can't be revoked remotely — the confirmation copy says
so plainly and offers to remove it locally anyway ("revoke it from the host later"). Silent local
deletion that pretends the credential is dead is the failure mode to avoid.

### Pairing (`/settings/environments/pair`)

One screen, one field, deliberately dull:

1. `TextInput` (multiline, autocapitalize off, autocorrect off) — "Paste the pairing link". A
   **Paste** button reads the clipboard (`expo-clipboard`) as a convenience; typing works too.
2. Live parse feedback under the field via `parsePairingLink` — origin and a masked credential when
   it parses, a specific reason when it doesn't.
3. Optional nickname field, pre-filled with the link's host (`beelink`, `100.x.y.z`).
4. **Pair** button → `redeemPairingLink` → `environmentActions.add` → `setActive` → pop to
   `/settings/environments`. The new environment is active immediately; the app then runs the
   bootstrap sequence and, if no repo is chosen yet, opens the repo sheet.

`parsePairingLink` is pure and unit-tested (see Verification). It accepts `<origin>/pair#token=<cred>`
and tolerates a trailing slash, surrounding whitespace, and a `?`-style fragment; it rejects a
missing fragment, a credential that isn't `pc_pair_*`, and a non-http(s) scheme.

### Repo selection — where it lives in the shell

**Decision: a root-level `/repo` route presented as a form sheet, opened from a header button on the
left of every tab, mirroring the existing Settings gear on the right.**

Rejected alternatives: a fifth tab (the shell is four tabs, deliberately — architecture skill); a
Files-tab-only picker (all four tabs are repo-scoped, so Changes would depend on Files); a
header-title dropdown (`NativeTabs` + native stack headers give no portable menu affordance on both
platforms, and `@expo/ui` `Picker` inside a header is not a native pattern).

- New `src/components/repo-toolbar.tsx` renders its own `Stack.Toolbar placement="left"` with a
  button labelled by the active repo's `name` (or "Choose repo"). It must **not** compose
  `SettingsToolbar` — per the note in that file, toolbar children have to be created inside the
  component that renders the toolbar. Tabs render both components side by side.
- Add a `'repo'` entry to `ToolbarIconName` in `src/components/toolbar-icon.ts` (SF Symbol
  `folder.badge.gearshape` or `shippingbox`). iOS-only: one symbol string, no PNG twin.

**The sheet** (`/repo`, a nested stack like `/settings`):

- `index` — "Recent" `List` from `recentRepos({ includeWorktrees: true })`, each row headline =
  `name`, supporting = `path`. Tap → `openRepo(path)` → dismiss. Swipe/long-press is not used;
  a **Remove from recents** action lives on the row's detail-free trailing `Button` only if it comes
  cheap — otherwise defer `removeRecentRepo` to a later plan.
- `browse` — pushed by a "Browse the daemon…" row. Walks `browseDirs(path | null)`: header shows the
  current `path`, a first row goes to `parent` (hidden at the filesystem root), then directory rows
  (`isRepo` ones get a leading `Icon` and an **Open** trailing button). Cap rendered rows at 200 with
  a "…and N more" footer row — `List` is not virtualized cheaply enough for a big `/nix/store`.
- Pull-to-refresh via `List` `onRefresh` on both screens.

### Empty / locked states (`DaemonGate`)

Rendered as an actionable empty state (new `src/components/empty-state.tsx`: title, one line of body,
one primary `Button`; the existing `PlaceholderScreen` stays for the not-yet-built tab bodies):

| `useConnectionState` | Title | Action |
|---|---|---|
| `no-environment` | "Pair your first daemon" | **Pair a daemon** → `/settings/environments/pair` |
| `unauthorized` | "This device was unpaired" | **Pair again** → the pair screen, prefilled nickname |
| `unreachable` | "Can't reach <nickname>" | **Retry**, secondary **Switch environment** |
| `ready`, no repo (`requires: 'repo'`) | "Choose a repo" | **Choose repo** → `/repo` |
| `loading` / `connecting` | nothing (render children; queries show their own pending state) | — |

## 4. Data layer

### Procedures this layer owns — `procedures/connection.ts`

| Descriptor | Procedure | Input | Output schema |
|---|---|---|---|
| `daemonInfoQuery` | `daemonInfo` Q | `void` | `{ version: string; host?: string; platform?: string; arch?: string }` |
| `recentReposQuery` | `recentRepos` Q | `{ includeWorktrees: boolean }` | `{ path: string; name: string }[]` |
| `openRepoPathMutation` | `openRepoPath` M | `string` (abs daemon path) | `{ path: string; name: string }` |
| `browseDirsQuery` | `browseDirs` Q | `string \| null` | `{ path: string; parent: string \| null; entries: { name: string; path: string; isRepo: boolean }[] }` |
| `removeRecentRepoMutation` | `removeRecentRepo` M | `string` | `void` (`z.void()`) |
| `revokeCurrentClientMutation` | `revokeCurrentClient` M | `void` | `void` |

Every optional daemon field stays optional in the schema — `daemonInfo`'s identity fields are the
version-skew canary, not a contract.

### Query keys

`['daemon', <envId>, <procedureName>, <input ?? null>]`. The environment id is in the key so
switching environments can never serve another daemon's cache, and unpairing is a single
`removeQueries({ queryKey: daemonKeys.environment(id) })`. Repo scoping rides along inside `input`
(every repo-scoped procedure already takes `repoPath`).

Defaults on the singleton `QueryClient`: `staleTime: 5_000`, `gcTime: 5 * 60_000`, `retry` = 2 for
`unreachable` only (never retry `unauthorized`, `unsupported`, or `invalid-response`),
`refetchOnReconnect: true`, `refetchOnMount: true`.

### Invalidation on app-event — `app-events.ts`

```ts
export const APP_EVENT_INVALIDATIONS: Record<AppEvent, readonly string[]> = { … }
```

Typing it as `Record<AppEvent, …>` with `AppEvent` imported from the shared protocol makes a new
daemon event a compile error until it's mapped. Seed values (tab worktrees extend their own rows):

| `app-event` | Invalidates (procedure names) |
|---|---|
| `actions` | `actions` |
| `board` | `boardCards` |
| `comments` | `reviewComments` |
| `evidence` | `loopEvidence`, `loopEvidenceHtml`, `featureReading` (the reading carries the evidence meta) |
| `feature-view` | `featureView`, `featureReading`, `worktreeInbox` |
| `file-tree` | `readDir`, `searchFiles`, `pinnedEntries` |
| `layers` | `repoLayers` |
| `scope` | `repoScope`, `pinnedEntries`, `readDir` |
| `working-tree` | `gitStatus`, `gitFlow`, `gitRangeFlow`, `diffReading`, `gitDiffFile`, `reviewedPaths`, `gitHead` |

Names that no tab has implemented yet are harmless — invalidating an absent key is a no-op, and
seeding the full map now is what keeps four worktrees from each inventing half of it.

### The `/session` socket

- URL: `baseUrl` with `http`→`ws` / `https`→`wss`, path `/session`. Subprotocol:
  `new WebSocket(url, ['porcelain.' + token])` (React Native's WebSocket supports the protocols
  argument; the token never appears in the query string).
- **Lazy**: opens on the first `subscribe`/`watch` caller, or once a repo is open — whichever comes
  first. Closes on `AppState` `background`, reopens on `active`.
- **Reconnect**: exponential backoff 500 ms → 8 s with jitter, unlimited while foregrounded. On every
  open: send `session:hello { repo }`, re-register all live watches, then fire `onReconnect` handlers
  (this is how the Terminal plan re-attaches its PTYs — server-side session state dies with the
  socket).
- Every inbound frame is `serverMessageSchema.parse`d; an unparseable frame is logged and dropped,
  never thrown into React.
- A `401`-equivalent close (or an upgrade rejection) flips the environment to `unauthorized` and
  stops the reconnect loop — a revoked token must not become an infinite retry battery drain.

### Polling backstop

`useDaemonQuery({ backstopMs })` resolves `refetchInterval` to `backstopMs` only when **both** the app
is foregrounded (`AppState === 'active'`) and `session.status !== 'open'`. A healthy socket means
zero polling. This is deliberately stricter than the browser client's always-on 3 s poll: on a phone
that poll is cellular data and battery, and the socket already carries the truth.

### Secure-store schema

`expo-secure-store` values are size-constrained (keep entries well under a couple of KB), so the
list is split:

| Key | Value |
|---|---|
| `porcelain.environments` | `{ version: 1, activeId: string \| null, environments: EnvironmentRecord[] }` |
| `porcelain.token.<id>` | the raw `pc_client_…` token, one key per environment |

```ts
const environmentRecordSchema = z.object({
  id: z.string(),
  nickname: z.string().min(1).max(64),
  baseUrl: z.string().url(),          // normalized: scheme + host + port, no trailing slash
  createdAt: z.number().int(),
  activeRepoPath: z.string().nullable(),
})
const environmentsFileSchema = z.object({
  version: z.literal(1),
  activeId: z.string().nullable(),
  environments: z.array(environmentRecordSchema),
})
```

`Environment` (in-memory) = `EnvironmentRecord & { token: string }`. Tokens never enter the index, so
a nickname edit rewrites a small non-secret blob and never touches credentials. Ids are
`Crypto.randomUUID()` (`expo-crypto`) — SecureStore keys allow `[A-Za-z0-9._-]`, and a UUID is safe.

A file that fails to parse is **not** silently discarded: it's kept under
`porcelain.environments.corrupt` and the app reports "stored environments couldn't be read" with a
re-pair path. Losing a paired credential without saying so is worse than the error.

`activeRepoPath` lives in the environments record on purpose: the repo choice is per-daemon, isn't a
secret but is meaningless without one, and co-locating it avoids adding a second storage dependency
for one string.

### Error taxonomy — `errors.ts`

```ts
export type DaemonErrorKind =
  | 'unreachable'       // network failure, DNS, refused, timeout
  | 'unauthorized'      // 401 — token revoked or wrong daemon
  | 'unsupported'       // NOT_FOUND on a procedure this daemon is too old to have
  | 'invalid-response'  // zod parse failure — version skew in a payload shape
  | 'daemon-error'      // the daemon answered with a real error message

export class DaemonError extends Error {
  readonly kind: DaemonErrorKind
  readonly procedure: string
  constructor(kind: DaemonErrorKind, procedure: string, message: string, options?: ErrorOptions)
}
export function toDaemonError(procedure: string, cause: unknown): DaemonError
```

Classification reads `TRPCClientError`'s `data.httpStatus` / `data.code`; anything that isn't a
`TRPCClientError` and isn't a zod error is `unreachable`.

| Kind | Where it shows |
|---|---|
| `unreachable` | `ConnectionState.unreachable` → `DaemonGate` empty state + the environment row's dot; a retry does **not** clear the cache |
| `unauthorized` | `ConnectionState.unauthorized` → gate offers re-pair; the environment is kept (nickname + baseUrl survive), the token key is deleted |
| `unsupported` on `daemonInfo` | not an error — `ready` with `daemonVersion: null`, plus a one-line "This daemon predates 0.30; some screens may be empty" note on the environment detail screen |
| `unsupported` elsewhere | the calling screen shows "Your daemon is too old for this" in place of that section; the rest of the app keeps working |
| `invalid-response` | the calling screen shows "Unexpected response from the daemon" and the environment detail nudges an update; the parse error is logged with the procedure name |
| `daemon-error` | the daemon's own message, verbatim, at the call site |

### Bootstrap order (in `DaemonProvider`, on hydrate and on every environment switch)

`hydrate` → active environment → `daemonInfo` (version probe; `NOT_FOUND` ⇒ pre-0.30) →
`recentRepos` (doubles as the token-validity probe: a `401` here is what flips `unauthorized`) →
if `activeRepoPath` is set, `openRepoPath` it (load-bearing — records the recent, seeds worktree
settings, warms the file cache) → open the socket and `session:hello`.

## 5. Files to create / change

**Create — `apps/mobile/src/lib/daemon/`**
`environment.ts` · `environments-store.ts` · `repo.ts` · `pairing.ts` · `client.ts` · `procedure.ts` ·
`procedures/connection.ts` · `errors.ts` · `queries.ts` · `ws-protocol.ts` · `session.ts` ·
`app-events.ts` · `preferences.ts` · `provider.tsx`
Tests (pure modules only, no react-native imports): `pairing.test.ts` · `environment.test.ts` ·
`app-events.test.ts` · `ws-protocol.test.ts`

**Create — components / features / routes**
- `src/components/empty-state.tsx`, `src/components/daemon-gate.tsx`, `src/components/repo-toolbar.tsx`
- `src/features/settings/pair-screen.tsx`, `src/features/settings/environment-detail-screen.tsx`
- `src/features/repo/repo-picker-screen.tsx`, `src/features/repo/repo-browse-screen.tsx`
- `src/app/settings/environments/index.tsx`, `.../pair.tsx`, `.../[id].tsx`
  (converts the existing `settings/environments.tsx` file into a folder)
- `src/app/repo/_layout.tsx`, `src/app/repo/index.tsx`, `src/app/repo/browse.tsx`
- `assets/toolbar/repo.png`

**Change**
- `src/features/settings/environments-screen.tsx` — placeholder → real list
- `src/components/toolbar-icon.ts` — add the `'repo'` icon
- `apps/mobile/package.json` — add `zod`, `zustand`, `expo-clipboard`, `expo-crypto`; add
  `@trpc/server` (devDependency, type-only)
- `apps/mobile/README.md` — a short "Connection" section: environments, pairing, the simulator recipe
- `vitest.config.ts` (root) — add `apps/mobile/src/**/*.test.ts` to `include`
- `.agents/skills/architecture/SKILL.md` — record the transport decision from §2 (hard rule 4: same
  commit). The paste-only/no-QR bullet is **already** accurate there; don't rewrite it.

**Already done — do not re-do**

`expo-camera` and its camera/microphone permissions were removed from
`apps/mobile/package.json` and `app.json` in a committed change *before* this plan starts. The
paste-only decision below is already reflected in the tree and in the architecture skill; there is
no camera cleanup left to perform.

**Shared merge points — other worktrees touch these too**

| File | Why it collides |
|---|---|
| `src/app/_layout.tsx` | root providers + the `repo` sheet screen — **this plan owns it; tabs must not restructure it** |
| `src/lib/daemon/app-events.ts` | every tab appends its procedure names |
| `src/app/settings/**` | Appearance/About plans may land here |
| `apps/mobile/package.json` | any tab adding a dependency |
| `src/components/toolbar-icon.ts` | any tab adding a header button — `settings`, `board`, `history` already exist |
| `src/lib/surface-handoffs.ts` | **not created by this plan** — `03-review` specifies it (typed `openDiff` / `openFile` pushes into Changes/Files); whichever tab worktree lands first creates it, to 03's shape |

Everything else is per-slice by construction (`src/features/<tab>/`, `src/lib/daemon/procedures/<tab>.ts`).

## 6. Out of scope

- **QR / camera.** Paste-a-link only. The camera dependency and its permissions are already
  gone from the tree (see "Already done" above) — don't reintroduce them for a scanner.
- **Any admin surface.** Issuing pairing links, `accessStatus`, revoking *other* clients, and the
  LAN / tailnet / Funnel binds are host-side and `FORBIDDEN` for a paired client. The app never
  offers to turn on a bind; the error copy points at the host instead.
- **Daemon autodiscovery** (mDNS/Bonjour scanning, port sweeps). The pairing link carries the
  base URL; guessing endpoints is a security smell and a support nightmare.
- **`metro.config.js` workspace `watchFolders`** to import `src/shared/*` at runtime. Tempting, and
  possibly right later — but it changes how the whole app bundles, and this layer only needs types.
- **Offline persistence** of the React Query cache, background fetch, and push notifications.
- **Multiple simultaneously-connected environments.** One active at a time; switching tears down.
- **Appearance / About settings**, and any tab's actual content.

## 7. Verification

**Static (the rule-3 gate).** From the repo root: `pnpm verify` (`lint` → `test` → `build`, and
`build` runs `typecheck:mobile`). Note that `scripts/lint-escapes.mjs` covers `apps/mobile/src` — no
`any`, no `as unknown as`, no `void`-ed promises; and biome forbids default exports outside
`src/app/**`.

**Unit.** The pure modules listed above run under the root vitest once `include` is extended:
`parsePairingLink` (valid link, trailing slash, whitespace, missing fragment, wrong credential
prefix, non-http scheme), the storage schemas (round-trip, corrupt file), `APP_EVENT_INVALIDATIONS`
exhaustiveness, and `serverMessageSchema` against one frame of each `t`. Keep react-native and
`expo-*` imports out of these files — that's what makes them testable at all.

**Runtime proof — iOS simulator on the Mac, dev daemon only** (`serve-sim-remote` skill; full recipe
and traps in `README.md` → *Shared verification recipe*).

```bash
pnpm build && pnpm dev:daemon                      # dev daemon on 43118, LAN-bound by default
PORCELAIN_HOME=~/.porcelain-dev PORCELAIN_DAEMON_PORT=43118 \
  node scripts/daemon-cli.js access issue --name "Simulator" \
    --base-url http://<this-host>.local:43118      # LAN URL — the sim is on the Mac, not here
pnpm mobile:start                                  # Metro here; the sim loads the bundle over the LAN
```

Two things this plan in particular must not get wrong. The `PORCELAIN_HOME` /
`PORCELAIN_DAEMON_PORT` prefix on the CLI is **not optional**: without it `daemon-cli.js` reads
`~/.porcelain/admin-token` and talks to `127.0.0.1:43117`, i.e. it would issue a link against the
**production** daemon. And the pairing `--base-url` must be this machine's LAN name or IP — a
simulator resolving `127.0.0.1` reaches the *Mac*, so **do not** use `--loopback` here: this plan is
the one that proves cross-machine pairing works. First run on a fresh simulator needs the dev client
installed once from the Mac (`eas build -p ios --profile development-simulator`, then
`xcrun simctl install booted <App>.app`); after that `pnpm mobile:start` is enough.

Then, in the app: Settings → Environments → **Pair a daemon** → paste the printed link → pair →
the environment appears active → the repo sheet lists the dev playground's recents → open one →
the header button shows the repo name and a tab body renders past `DaemonGate`. Capture screenshots
of the pair screen, the environments list, and the repo picker for the Review's evidence.

Also prove the three failures, because they're the point of the taxonomy: stop the daemon and
confirm **unreachable** (with a working Retry); run `access revoke <id>` on the host and confirm the
app lands on **This device was unpaired** without a reconnect storm; point an environment at a wrong
port and confirm it fails as unreachable rather than hanging.

**Never** pair against the production daemon on 43117, and never open a real repo from it.

## 8. Worktree notes

- Suggested slug: **`mobile-connection`** → `pnpm worktree create mobile-connection`, branch
  `work/mobile-connection`, PR into `main` with the Review's evidence attached.
- **This worktree merges first.** `01-files`, `02-changes`, `03-review`, and `04-terminal` all import
  `useDaemonQuery`, `DaemonGate`, `useDaemonSession`, and `app-events.ts`; starting them before this
  lands means four worktrees inventing four transports. Land this, `git pull --ff-only` on `main`,
  then fan out.
- The seam names in §2 are the API those four plans were written against. If implementation forces a
  change, change it **here** and say so in the PR body — a renamed hook after fan-out is four merge
  conflicts and a broken plan document.
- Before stopping: `pnpm worktree remove mobile-connection`, and leave no `.expo/dev/logs`,
  scratch, or screenshot debris in the tree.
