# Client structure

## Where code goes

```
src/app/        route table only — thin files that re-export a feature screen
src/features/   one folder per feature (files, changes, review, board, terminal, settings)
src/components/ shared presentational components
src/lib/daemon/ the only daemon seam
src/theme/      shared design values (colors.tint is the single accent)
```

Never co-locate components, types or utilities under `src/app` — it holds routes and `_layout` files
and nothing else. A new screen is a file in `src/features/<feature>/<name>-screen.tsx` plus a
one-line route that default-exports it. File names are kebab-case. Feature slices exist so parallel
worktrees don't collide in a shared component tree.

## The tab shell

Native tabs, each owning its own stack, so deeper screens push instead of becoming tabs.

**The ceiling is five.** iOS collapses a sixth into a system "More" tab, so anything new earns its
place by displacing one, not by being added.

**CONFLICT — resolve before adding another.** `src/app/(tabs)/_layout.tsx` currently registers
**six** triggers: Files, Changes, Review, Board, Terminal, Settings. Either the ceiling is being
violated on iPhone, or the ceiling rule is wrong; the code and this rule cannot both stand. Verify on
a booted iPhone simulator before treating either as settled.

Surfaces the desktop app has that are deliberately not tabs here:

| Desktop surface | Where it lives on mobile |
| --- | --- |
| History | pushed from the **Changes** header — commit history reads as part of the working-tree story |
| Read | a contextual row in **Changes**, only when there are changed files |
| Search | the **Files** header search bar |

Every tab's native header keeps the workspace context together: project chooses the daemon's active
repo, branch checks out a branch in that worktree, worktree switches among linked checkouts.
Environment selection stays in Settings, so changing the network target does not change what the
project/branch/worktree controls mean.

Environments are **LAN + Tailscale only — no relay tier, deliberately**: a relay is a recurring bill,
and Funnel is already the public path.

iPhone uses the bottom `NativeTabs` presentation. The iPad root presentation is a root `SplitView`
over the same route table with Files list/detail columns — do not add an iPad-only route table or
selection store. `SplitView` is structurally blocked inside another navigator, so the fork belongs
only in the root layout. **Treat every iPad claim as unproven until a screenshot backs it.**

## The daemon seam

`src/lib/daemon/` is the only way this app talks to a daemon. `DaemonProvider` (root layout) owns the
query client, hydration, the bootstrap sequence and the `/session` socket; screens call
`useDaemonQuery` / `useDaemonMutation` with a descriptor from `procedures/*.ts` and wrap their body in
`DaemonGate`. Transport is untyped `@trpc/client` + react-query.

Four rules hold it together:

- **Import the exact module — there is no barrel.** A tab slice adds `procedures/<tab>.ts` and
  appends to `app-events.ts`; it edits nothing else here.
- **Never import the daemon's `AppRouter`.** It drags 45 modules through `tsc`. Procedures are
  hand-declared zod descriptors and every response is parsed, so contract drift fails as
  `invalid-response` rather than as an undefined property three renders later.
- **WS frames come from `@porcelain/contracts`.** One definition of the protocol in the repo;
  re-declaring a schema locally is drift by construction.
- **Credentials live in `expo-secure-store`, one key per environment** (`porcelain.token.<id>`).
  The `porcelain.environments` index carries no token, so renaming an environment never rewrites one.
  An index that will not parse is kept under `porcelain.environments.corrupt` and reported, never
  silently dropped. Pairing is a **pasted link only, no QR**.

Query keys are `['daemon', envId, procedureName, input ?? null]` — the environment id is in the key,
so switching daemons can never serve another one's cache.

## UI primitives

`@expo/ui/swift-ui` components with styling from `@expo/ui/swift-ui/modifiers`, plus Expo Router
navigation. No shadcn, Tailwind or DOM components. The universal `@expo/ui` root is lint-banned; see
the skill's platform decisions for why.
