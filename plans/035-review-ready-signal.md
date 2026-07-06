# Plan 035: An attention signal when the agent pushes — unread dots on the rail (design-scoped build)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 113e373..HEAD -- src/renderer/src/hooks/use-app-events.ts src/renderer/src/components/shell/app-sidebar.tsx src/shared/ws-protocol.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S–M
- **Risk**: LOW
- **Depends on**: none (pairs with plans/034 — a reply is one of the events worth signalling)
- **Category**: direction
- **Planned at**: commit `113e373`, 2026-07-05

## Why this matters

When the coding agent pushes through an MCP channel — a review set, a feature
artifact, a resolved/answered comment — the app *silently* refreshes the open
view. There is no unread indicator, no toast, nothing that says "the agent
finished something for you." The stated user is a solo dev managing agents from
the terminal, usually NOT staring at the Feature tab — and since v0.19 the
daemon can run headless on a remote box, widening the gap between "agent
pushed" and "human noticed." The data channel is two-way; the *attention*
channel doesn't exist. This plan builds the smallest honest version: per-tab
unread dots driven by the events that already arrive, cleared on visit —
and records the deliberately-deferred escalations (toasts, OS notifications).

## Current state

Push plumbing that already exists (nothing new needed server-side):

- `src/backend/review-watch.ts:22-30` watches the six agent-writable channel
  files and emits app-events: `feature-view`, `comments`, `board`, `actions`,
  `layers`, `artifact`.
- Events broadcast to every window's WS session and land in
  `src/renderer/src/hooks/use-app-events.ts` (mounted once in `AppShell`),
  which today only invalidates the matching queries.
- The sidebar rail (`src/renderer/src/components/shell/app-sidebar.tsx`) renders
  the tab icons (Files·Search·Changes·History·Feature·Board·Terminal); the
  active tab lives in the persisted `preferences` store (`sidebarTab`).

State-placement rule (architecture skill): cross-component UI state → a zustand
store in `stores/`, one file per concern; components subscribe with
fine-grained selectors; store actions may call other stores via `getState()`.
Persistence: ONLY the `preferences` store persists — unread state is
deliberately session-local (see Design decisions).

Design decisions (made here so the executor doesn't improvise):

1. **Signal = a dot on the rail icon**, not a count. Counts imply inbox
   semantics the channels don't have (events are refreshes, not items).
2. **Mapping**: `feature-view` + `artifact` → dot on **Feature**; `comments` →
   dot on the **active-context** Quick Access… no — keep it one-axis: `comments`
   → dot on **Feature** as well (comments surface in the Feature/Changes Quick
   Access); `board` → dot on **Board**; `actions` → dot on **Terminal**;
   `layers` → no dot (a layers push visibly regroups the open view already).
3. **Clearing**: visiting the tab clears its dot (set `sidebarTab` → clear).
   An event for the CURRENTLY active tab sets no dot (the view live-refreshes
   in front of the user).
4. **No persistence**: a reload starts clean. Rationale: the dot answers "did
   something change while I wasn't looking *in this session*"; persisted
   unread needs per-repo watermarks and cross-window reconciliation — deferred.
5. **No toast/OS notification in this plan** — recorded as the follow-up
   escalation, gated on living with the dots first.

## Commands you will need

| Purpose   | Command                        | Expected on success |
|-----------|--------------------------------|---------------------|
| Targeted  | `pnpm test -- unread`          | all pass            |
| Full gate | `pnpm verify`                  | exit 0              |

## Scope

**In scope**:
- `src/renderer/src/stores/unread.ts` (create) + `unread.test.ts` (create)
- `src/renderer/src/hooks/use-app-events.ts` (mark on event)
- `src/renderer/src/components/shell/app-sidebar.tsx` (render the dot; clear on select)

**Out of scope**:
- Server/daemon/MCP changes — the events already exist.
- OS notifications, sounds, toasts (deferred escalations — index note).
- Persisted watermarks / per-repo unread.
- The `layers` event (decision 2).

## Git workflow

- Commit straight to `main` (hook-enforced verify; branches hook-blocked). Do NOT push.
- Message: `feat: unread dots on the rail when the agent pushes (feature/board/terminal), cleared on visit`

## Steps

### Step 1: The unread store

Create `src/renderer/src/stores/unread.ts` — a small zustand store, one concern:

```ts
export type UnreadTab = 'feature' | 'board' | 'terminal'

interface UnreadState {
  unread: Record<UnreadTab, boolean>
  mark: (tab: UnreadTab) => void      // no-op when tab === preferences.sidebarTab (read via getState())
  clear: (tab: UnreadTab) => void
}
```

`mark` reads the active tab from the preferences store
(`usePreferencesStore.getState().sidebarTab` — match the actual store/export
names by reading `stores/preferences.ts`) and no-ops when the event's tab is
already active (decision 3). Event→tab mapping lives here too:

```ts
export function unreadTabFor(event: AppEvent): UnreadTab | null {
  // 'feature-view' | 'artifact' | 'comments' → 'feature'
  // 'board' → 'board' ; 'actions' → 'terminal' ; everything else → null
}
```

(`AppEvent` is the union from `@shared/ws-protocol` — import the type.)

Write `unread.test.ts` (pattern: existing store tests, e.g.
`stores/preferences.test.ts` — reset state in `beforeEach`): mark sets, clear
unsets, mark on the active tab no-ops, `unreadTabFor` mapping table (all six
events + an unknown), `layers` → null.

**Verify**: `pnpm test -- unread` → pass.

### Step 2: Mark on event

In `use-app-events.ts`, where agent-channel events are handled (the switch that
invalidates queries), add — without disturbing the invalidation — a call:

```ts
const tab = unreadTabFor(event)
if (tab) useUnreadStore.getState().mark(tab)
```

Keep the hook's existing structure; imports of stores in hooks are sanctioned.

**Verify**: `pnpm typecheck` → exit 0 (the hook has no test today; the store
test covers the logic, the wiring is one line).

### Step 3: Render + clear

In `app-sidebar.tsx`:

- Each rail tab icon whose tab has `unread[tab] === true` renders a small dot —
  absolutely positioned on the icon button's corner, `size-1.5 rounded-full`,
  using an existing semantic token for the fill (the app is neutral-graphite;
  use `bg-foreground/70`, NOT a new accent color — the no-decorative-accent
  rule). Subscribe with a fine-grained selector per tab.
- Wherever the rail sets `sidebarTab` on click, also
  `useUnreadStore.getState().clear(tabFor(clicked))` when the clicked tab is
  one of the three unread-capable tabs. Also clear on the Cmd+1–7 path IF that
  path doesn't converge on the same setter — check `use-app-shortcuts.ts`; if
  both paths call the same preferences action, prefer clearing inside a
  `subscribe` on the preferences store from `unread.ts` (one clearing point,
  no component wiring) — choose whichever gives ONE clearing site and note it
  in the commit message.

**Verify**: `pnpm verify` → exit 0. Manual (recommended, cheap): `pnpm dev`
against the playground repo; from a terminal
`echo '{}' >> ~/.porcelain/board.json` is too crude — instead run the app, use
the in-app Board to confirm no self-dot, then simulate an agent write:
`node -e "const f=process.env.HOME+'/.porcelain/board.json'; const fs=require('fs'); const j=JSON.parse(fs.readFileSync(f,'utf8')); fs.writeFileSync(f+'.tmp', JSON.stringify(j)); fs.renameSync(f+'.tmp', f)"`
with the Files tab active → Board dot appears; click Board → clears.
(dev app uses the same `~/.porcelain` — the isolation is userData, not the
home channels; this is safe, it rewrites identical content.)

## Test plan

Step 1's store tests carry the logic. A component test for the dot is optional;
if written, mock nothing (the store is real) — set unread state, render
`AppSidebar`… only if `app-sidebar` renders without heavy providers; check how
existing shell components are tested first, and skip if it needs the full
provider stack (note the skip).

## Done criteria

- [ ] `pnpm verify` exits 0
- [ ] `pnpm test -- unread` → all pass (≥7 cases incl. the mapping table)
- [ ] `grep -n "unreadTabFor" src/renderer/src/hooks/use-app-events.ts` → wired
- [ ] Exactly ONE clearing site exists (grep `clear(` usages of the store) — per Step 3's note
- [ ] Manual check performed and described in the status note (dot appears on
      agent-style write, clears on visit, no dot for the active tab)
- [ ] `plans/README.md` status row updated

## STOP conditions

- `use-app-events.ts`'s event handling doesn't match the described shape
  (e.g. events handled elsewhere since 113e373) — re-locate before wiring.
- The rail icon buttons can't take a positioned child without fighting the
  shadcn sidebar primitives — report with the specific constraint rather than
  restructuring the sidebar.
- You're tempted to add a toast — that's the recorded follow-up, not this plan.

## Maintenance notes

- Escalation path (deferred, in order): debounced toast for `feature-view`
  pushes → OS notification via the shell for the remote-daemon case (needs a
  shell-event, Electron `Notification`, and a settings toggle). Revisit after
  living with the dots.
- If plan 034 lands, an agent *reply* arrives as a `comments` event and gets
  the Feature dot — no extra wiring; verify that mapping still feels right in use.
- The dot color decision (no accent) is deliberate — a reviewer seeing a
  colored dot should push back (the one-color-for-meaning rule).
