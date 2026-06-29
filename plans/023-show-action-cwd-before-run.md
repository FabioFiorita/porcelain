# Plan 023: The human sees a saved action's working directory before running it

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7bb4a55..HEAD -- src/renderer/src/components/terminal/actions-group.tsx src/renderer/src/hooks/use-actions.ts .agents/skills/audit/SKILL.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `7bb4a55`, 2026-06-26

## Why this matters

Saved actions are **agent-writable** — the user's coding agent curates named shell
commands over MCP — but **human-executed**: the human clicks Play to run one in the
embedded terminal. The whole safety model rests on the human seeing *exactly what a
click executes* before clicking. The Actions row honors that for the **command** text
(it's shown and in the run tooltip) but **not for the working directory**: an action's
`cwd` is invisible in the UI, and `resolveCwd` uses an **absolute** `cwd` verbatim
(`src/renderer/src/hooks/use-actions.ts:57-59`). So an agent can author an action with
a benign-looking command (`git clean -fdx`, `npm install`) and a `cwd` pointing
*outside the repo* (`/Users/<you>`, `/`), and the human — seeing only the command and
assuming it runs in the repo — runs it somewhere they never saw. The `cwd` is half of
"what a click executes," and it's hidden.

The fix is small and non-breaking: **surface the `cwd`** in the Actions row and the run
tooltip whenever an action has one, so the human can see where it will run before
clicking. We deliberately do **not** clamp/contain the path — an absolute `cwd` is a
legitimate use (a sibling worktree is a parallel checkout often worked side by side),
so containment would break valid actions. Visibility, consistent with the existing
human-gated model, is the right mitigation.

## Current state

Files:
- `src/renderer/src/components/terminal/actions-group.tsx` — the Actions Quick Access
  section. `ActionRow` (module-private, lines 20–86) renders one saved action: a Play
  button whose label is the action `title` + `command`, with a run tooltip. **The `cwd`
  is never rendered.**
- `src/renderer/src/hooks/use-actions.ts` — `resolveCwd` (lines 57–60) turns an absolute
  `cwd` into the spawn cwd verbatim; `useRunAction` (67–80) spawns the terminal.
- `.agents/skills/audit/SKILL.md` — the "Saved actions are agent-writable but
  HUMAN-executed" invariant (search for that phrase). Safeguard (2) currently says only
  the **command** must be visible.

`ActionRow`'s run button today (`actions-group.tsx:34-50`):

```tsx
<div className="group/action glaze-tile flex items-center gap-1 p-2 [--tile-fill:var(--surface-2)]">
  <button
    type="button"
    onClick={() => run(action)}
    className="flex min-w-0 flex-1 items-center gap-2 text-left"
    // The full command is always visible before it runs — an agent can author
    // actions, so the human must see exactly what a click executes (see audit skill).
    title={`Run: ${action.command}`}
  >
    <Play className="size-3.5 shrink-0 text-muted-foreground" />
    <span className="min-w-0 flex-1">
      <span className="block truncate text-xs font-medium">{action.title}</span>
      <span className="block truncate font-mono text-2xs text-muted-foreground">
        {action.command}
      </span>
    </span>
  </button>
  ...
```

The `Action` type (`src/main/actions-store.ts:20-30`) has `cwd?: string` (repo-relative
or absolute; omitted ⇒ repo root).

Conventions to match:
- One public component per file; `ActionRow` stays module-private. Use `cn()` only for
  conditional classes (not needed here). Tailwind tokens already in this file:
  `text-2xs`, `text-muted-foreground`, `font-mono`, `truncate`, `block`, `min-w-0`.
- The repo bans `any` / `as unknown as`. Strict TS. Biome is the linter/formatter.
- Component tests **mock the domain hooks, never tRPC**. Exemplar in this exact folder:
  `src/renderer/src/components/terminal/action-composer.test.tsx` (it does
  `vi.mock('@renderer/hooks/use-actions', () => ({ useActionMutations: vi.fn() }))`).

## Commands you will need

| Purpose   | Command                                              | Expected on success |
|-----------|------------------------------------------------------|---------------------|
| Install   | `pnpm install`                                       | exit 0              |
| Lint      | `pnpm lint`                                           | exit 0              |
| Typecheck | `pnpm typecheck`                                      | exit 0, no errors   |
| Test (one)| `pnpm test -- actions-group`                          | all pass            |
| Full gate | `pnpm verify`                                         | all pass            |

(`pnpm verify` = `pnpm lint && pnpm typecheck && pnpm test && pnpm build`; it is
hook-enforced before any commit.)

## Scope

**In scope** (the only files you should modify/create):
- `src/renderer/src/components/terminal/actions-group.tsx` — render the `cwd`; extend the run tooltip.
- `src/renderer/src/components/terminal/actions-group.test.tsx` — **create**; assert cwd is shown when set, absent when not.
- `.agents/skills/audit/SKILL.md` — extend safeguard (2) to include `cwd` visibility.

**Out of scope** (do NOT touch, even though they look related):
- `src/renderer/src/hooks/use-actions.ts` — do **not** add path containment / clamping to
  `resolveCwd`. Absolute `cwd` is a supported, legitimate value (sibling worktrees);
  containment would break it. The mitigation is visibility, not restriction.
- `src/main/actions-store.ts`, `src/mcp/action-file.ts` — the channel/schema are correct;
  `cwd` is meant to be stored and may be absolute.
- The `ActionComposer` dialog — it already shows/edits `cwd`; leave it.

## Git workflow

- Commit straight to `main` (no branches — the git-guard hook hard-blocks branch creation).
- Conventional Commits. Suggested message:
  `security(actions): surface a saved action's cwd before the human runs it`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Render the `cwd` in `ActionRow` and add it to the run tooltip

In `src/renderer/src/components/terminal/actions-group.tsx`, change the run button so
that when `action.cwd` is set, the human sees it. Two changes inside `ActionRow`:

1. Extend the `title` (run tooltip) to include the cwd when present:

```tsx
title={action.cwd ? `Run: ${action.command}\n(in ${action.cwd})` : `Run: ${action.command}`}
```

2. Render a visible cwd line on its **own** line (so the `truncate` on the command line
   can't hide it), below the command, inside the existing label `<span>`:

```tsx
<span className="min-w-0 flex-1">
  <span className="block truncate text-xs font-medium">{action.title}</span>
  <span className="block truncate font-mono text-2xs text-muted-foreground">
    {action.command}
  </span>
  {action.cwd ? (
    <span className="block truncate font-mono text-2xs text-muted-foreground/80">
      in {action.cwd}
    </span>
  ) : null}
</span>
```

Keep the existing comment on the button accurate — update it to say the command **and
its working directory** are visible:

```tsx
// The full command and its working directory are always visible before it runs — an
// agent can author actions, so the human must see exactly what (and where) a click
// executes (see audit skill).
```

**Verify**: `pnpm lint && pnpm typecheck` → exit 0.

### Step 2: Create the component test

Create `src/renderer/src/components/terminal/actions-group.test.tsx`. Model it on
`action-composer.test.tsx` (same folder) — mock the domain hook, render `ActionsGroup`,
assert on what the human sees. `ActionsGroup` reads three hooks from
`@renderer/hooks/use-actions` (`useActions`, `useRunAction`, `useActionMutations`), so
mock all three in one `vi.mock`:

```tsx
import { useActionMutations, useActions, useRunAction } from '@renderer/hooks/use-actions'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Action } from '@main/actions-store'
import { ActionsGroup } from './actions-group'

vi.mock('@renderer/hooks/use-actions', () => ({
  useActions: vi.fn(),
  useRunAction: vi.fn(),
  useActionMutations: vi.fn(),
}))

const action = (over: Partial<Action>): Action => ({
  id: 'a1',
  title: 'Reset tree',
  command: 'git clean -fdx',
  order: 0,
  createdAt: 0,
  ...over,
})

describe('ActionsGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useRunAction).mockReturnValue(vi.fn(async () => {}))
    vi.mocked(useActionMutations).mockReturnValue({
      add: vi.fn(async () => {}),
      update: vi.fn(async () => {}),
      move: vi.fn(async () => {}),
      remove: vi.fn(async () => {}),
    })
  })

  it('shows the working directory when an action has one', () => {
    vi.mocked(useActions).mockReturnValue([action({ cwd: '/Users/someone' })])
    render(<ActionsGroup />)
    // The human must see WHERE the command will run before clicking.
    expect(screen.getByText('in /Users/someone')).toBeInTheDocument()
  })

  it('shows no working-directory line when an action has none', () => {
    vi.mocked(useActions).mockReturnValue([action({})])
    render(<ActionsGroup />)
    expect(screen.queryByText(/^in /)).not.toBeInTheDocument()
  })
})
```

Notes for the executor:
- `ActionsGroup` also renders the `ActionComposer` child, which calls
  `useActionMutations` — already covered by the mock above (don't add a second mock).
- The `Action` type is imported from `@main/actions-store` as a **type** (the
  `import type`/value import is fine here in a test; if Biome complains, switch to
  `import type { Action }`).
- If `SidebarProvider`/`matchMedia` errors appear, the global `src/test-setup.ts`
  already stubs `window.matchMedia`; you do not need to add anything.

**Verify**: `pnpm test -- actions-group` → both tests pass.

### Step 3: Update the audit skill invariant

In `.agents/skills/audit/SKILL.md`, find safeguard **(2)** under the "Saved actions are
agent-writable but HUMAN-executed" bullet. It currently requires only the **command**
to be visible. Extend it so the rule covers the `cwd` too. Change the safeguard (2)
sentence to also state that **the working directory is shown whenever an action has one,
because `cwd` is agent-writable and may point outside the repo** — the human must see
*where* a click runs, not just *what* it runs. Keep it to the existing terse invariant
style (one or two sentences; reference `actions-group.tsx`). Do not rewrite the rest of
the bullet.

**Verify**: `git diff .agents/skills/audit/SKILL.md` shows the safeguard-(2) wording now
mentions the working directory / `cwd` visibility.

## Test plan

- New file `src/renderer/src/components/terminal/actions-group.test.tsx`, modeled on
  `action-composer.test.tsx`. Cases:
  - **cwd shown**: an action with `cwd: '/Users/someone'` renders `in /Users/someone`.
  - **no cwd**: an action without `cwd` renders no `in …` line.
- Verification: `pnpm test -- actions-group` → all pass (2 new tests).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm typecheck` exits 0.
- [ ] `pnpm test -- actions-group` passes; the new `actions-group.test.tsx` exists with the two cases above.
- [ ] `grep -n "action.cwd" src/renderer/src/components/terminal/actions-group.tsx` shows the cwd is rendered (a match inside the label span) and used in the run `title`.
- [ ] `grep -in "working directory\|cwd" .agents/skills/audit/SKILL.md` shows the safeguard now mentions cwd visibility.
- [ ] `git status` shows only the three in-scope files changed (two modified, one created).
- [ ] `pnpm verify` passes.
- [ ] `plans/README.md` status row for 023 updated.

## STOP conditions

Stop and report back (do not improvise) if:

- The `ActionRow` markup in `actions-group.tsx` no longer matches the "Current state"
  excerpt (someone restructured it since this plan was written).
- `ActionsGroup` no longer reads `useActions`/`useRunAction`/`useActionMutations` from
  `@renderer/hooks/use-actions` (the mock would be wrong — re-derive it from the live imports).
- You find yourself wanting to modify `resolveCwd` or add path containment — that is
  explicitly out of scope; stop and report instead.
- `pnpm verify` fails twice after a reasonable fix attempt.

## Maintenance notes

- If a future change adds *more* agent-writable fields to an action (e.g. an env var
  list), apply the same rule: surface it before the human runs the action.
- A reviewer should confirm the cwd line can't be visually hidden (it's on its own
  `truncate` line, not appended to the command line) and that the run tooltip includes it.
- Deliberately **not** done here and left for a separate decision: hard path containment
  on `cwd`. It was rejected because absolute `cwd` (sibling worktrees) is legitimate; the
  human-visible-before-run model is the mitigation. Revisit only if actions ever become
  auto-runnable (they are not — there is no MCP run tool; see the audit skill).
