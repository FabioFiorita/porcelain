---
name: client
metadata:
  internal: true
description: Porcelain's renderer UI layer — the shadcn/ui setup, the settled config an agent must not re-derive, and the composition rules hard rule 5 enforces. Read before adding or changing any renderer component.
---

# Renderer UI

Hard rule 5: the renderer uses **shadcn only, never hand-rolled**. Sidebars, tabs, dialogs, trees
and overlays already exist — check before writing a styled `div`. `lint-shadcn-heuristics.mjs`
catches two tells (`role="tablist|dialog|menu|tree"` and `fixed` + `inset-0`), so the gate is
partial: it cannot see a hand-rolled tree that skips the role.

`apps/mobile` shares none of this — it is SwiftUI-only. Backend work loads neither.

## Settled config — do not re-derive it

`apps/desktop/components.json` is the source; these are the answers a generic shadcn guide would
make you look up, and they do not change per task.

| Field | Porcelain | Consequence |
|---|---|---|
| `base` | **Base UI** (`@base-ui/react`), not Radix | Custom triggers use `render`, **never `asChild`** |
| `rsc` | `false` | Never add `"use client"` — there are no server components |
| Tailwind | v4, `cssVariables: true` | Theme lives in `@theme inline` in `src/renderer/src/assets/main.css`. There is no `tailwind.config.js` |
| `iconLibrary` | `lucide` | Import from `lucide-react`. Never assume another pack |
| `style` | `base-nova`, `neutral`, preset `b5J4txmSY` | Re-applying the preset is in the architecture skill's `reference/repo.md` |
| `aliases` | `@renderer/components`, `@renderer/lib`, `@renderer/hooks` | Import by alias, never a relative climb |

Run the CLI with this repo's package manager: `pnpm dlx shadcn@latest <command>`. Ask it rather
than guessing — `info`, `docs <component>`, `view <component>`. Never decode a preset code or build
a registry URL by hand; `preset decode|url|resolve` do it.

Components land in `apps/desktop/src/renderer/src/components/ui`, which is **vendored**: every lint
in this repo skips it. Edit a component there only to re-apply an upstream change, never to
customise — customisation goes in the consuming component.

## Reference

| File | When to read |
|---|---|
| [`reference/composition.md`](reference/composition.md) | Writing or reviewing renderer JSX — the styling, form, structure, and icon rules |

Typography, App Shell surfaces, and colour recipes are **not** here; they are traps recorded in the
architecture skill (`reference/app-shell.md`, and the sans/mono split in its Stack table).
