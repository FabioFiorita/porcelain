# 005 — Glaze: Porcelain's design system

**Status:** Phases 0–1 DONE + tab segments from phase 2 (visually verified via CDP
screenshots 2026-06-12; gate green) · Rest of phase 2 + phases 3–4 TODO
**Authored:** 2026-06-12, synthesized from a three-agent review (visual audit,
design direction, composition audit). Self-contained: an executor with no other
context can implement any phase from this document alone.

---

## 1. Why

A deep audit found Porcelain's identity is skin-deep: one genuinely distinctive
idea (vibrancy + the frosted sidebar tab pill) sitting on unreconciled stock
shadcn. Concretely:

- **Radius chaos.** Corners range from `rounded-sm` to `rounded-4xl` pills
  inside a single 200px sidebar. The luma preset's primitives hardcode big
  radii (`button.tsx` `rounded-4xl`, menus `rounded-3xl`) while the project's
  own `--radius: 0.45rem` and feature code use small ones.
- **Four hover fills, zero transitions on rows.** `bg-sidebar-accent`,
  `bg-sidebar-accent/50`, `bg-muted/50`, `bg-accent/50` all mean "hovered";
  rows snap (no color transition) while buttons animate (`transition-all`).
- **Two materials at random.** Menus are frosted glass
  (`bg-popover/70 + backdrop-blur-2xl`); dialogs and the Cmd+P finder are
  opaque slabs (`bg-popover`, no blur). Same conceptual surface, opposite
  materials.
- **Color anarchy.** "Added" is three unrelated greens (`emerald-950/60`,
  `emerald-500`, `emerald-400`); diff/status/file-icon colors are raw Tailwind
  literals outside the token system; the emerald primary is nearly invisible.
- **The shell is a slab.** Default sidebar variant with a hard `border-r`,
  tabs riveted to the top bar — the default shadcn dashboard silhouette.

## 2. The system: Glaze

Porcelain the material is vitrified: fired clay turned glass-hard, defined by
hairline precision and a specular skin that catches one line of light along its
top curve. **Glaze** makes the app a set of fired porcelain tiles floating over
the vibrancy void — each panel discrete, weightless, edge-lit, separated by
deliberate gaps where the user's desktop glows through. Quiet, dimensional,
exact. Expensive ceramic, not glassmorphism cliché.

**Signature element — the glaze edge.** Every floating tile carries a 1px
specular top-edge highlight (a light line fading out toward the corners), like
glazed ceramic catching light. It is the literal embodiment of the product's
name and appears on every tile, so the whole shell reads as one material.

**Restraint (the removed accessory).** The sidebar-tab icon rainbow
(sky/amber/violet) goes monochrome, lighting emerald only when active. File-type
icon colors stay (they aid scanning in the tree/finder), but decoration-color
elsewhere yields to one functional accent: emerald = focus, active, primary.

**The kept risk.** Content tiles stay translucent over live vibrancy (the main
panel is glass, not opaque). De-risked by flooring content surfaces at 0.72
alpha with reduced blur.

### Structural concept

```
┌──────────────────────── window (transparent → desktop vibrancy void) ────────────────────────┐
│  ◉ ◉ ◉      ‹ drag region ›                                                                  │
│  ╭─ left tile ─────╮  ╭─────────────── main tile ────────────────────────╮  ╭─ right tile ─╮ │
│  │▔ glaze edge ▔▔▔▔│  │▔ glaze edge ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔│  │▔▔▔▔▔▔▔▔▔▔▔▔▔│ │
│  │ project ⌄    👁 │  │ ⛶  tab │ tab │ tab                            ⛶ │  │ QUICK ACCESS │ │
│  │ ┌ tabs pill ──┐ │  │──────────────────────────────────────────────────│  │ pinned /     │ │
│  │ │Files Chg Hst│ │←8px→ code / diff / markdown content                 │←8px→ commit /   │ │
│  │ └─────────────┘ │  │                                                  │  │ quick cmds   │ │
│  │  file tree…     │  │                                                  │  │              │ │
│  │ ─────────────── │  │                                                  │  │              │ │
│  │ branch ⌄      ⚙ │  │                                                  │  │              │ │
│  ╰─────────────────╯  ╰──────────────────────────────────────────────────╯  ╰──────────────╯ │
└────────────────────────── 8px void on every outer edge ──────────────────────────────────────┘
```

- **Void** = `8px` everywhere tiles meet tiles or window edges. The void shows
  raw vibrancy (no `bg-background` wash behind the shell).
- Left sidebar: `variant="floating"` (shadcn-native; its `p-2` provides the
  void). Right sidebar: same. Main panel: a `.glaze-tile` div with margins that
  collapse to `0` on sides where a floating sidebar already provides the void.
- Transient glass (Cmd+P finder, dialogs) floats above tiles at elevation 3
  with a stronger shadow (`--shadow-float`).

## 3. Tokens (live in `main.css`, below the preset blocks)

The b2D0xPJT8 palette (emerald primary, neutral luma, Geist Mono,
`--radius: 0.45rem`) is untouched; Glaze layers on top.

| Token | Dark (primary) | Light |
|---|---|---|
| `--surface-0` (sidebars, resting tiles) | `oklch(0.205 0 0 / 0.55)` | `oklch(0.985 0 0 / 0.62)` |
| `--surface-1` (main/content tiles) | `oklch(0.215 0 0 / 0.72)` | `oklch(0.99 0 0 / 0.80)` |
| `--surface-2` (capsules, sticky bars) | `oklch(0.24 0 0 / 0.80)` | `oklch(1 0 0 / 0.86)` |
| `--surface-3` (transient glass) | `oklch(0.26 0 0 / 0.92)` | `oklch(1 0 0 / 0.94)` |
| `--hairline` (tile edge) | `oklch(1 0 0 / 0.10)` | `oklch(0.145 0 0 / 0.10)` |
| `--hairline-strong` (dialogs) | `oklch(1 0 0 / 0.16)` | `oklch(0.145 0 0 / 0.14)` |
| `--glaze` (specular edge) | `oklch(1 0 0 / 0.14)` | `oklch(1 0 0 / 0.55)` |
| `--glaze-strong` | `oklch(1 0 0 / 0.22)` | `oklch(1 0 0 / 0.75)` |
| `--hover-fill` (the one row-hover) | `oklch(1 0 0 / 0.05)` | `oklch(0.145 0 0 / 0.05)` |
| `--radius-panel` | `1rem` | same |
| `--ease-glaze` | `cubic-bezier(0.22, 0.61, 0.36, 1)` | same |
| `--dur-fast / base / slow` | `120ms / 180ms / 240ms` | same |
| `--ring` (override) | emerald `oklch(0.696 0.17 162.48)` | emerald `oklch(0.508 0.118 165.612)` |

Shadow stacks (hairline ring + tight contact + soft ambient — tiles read as
lifted, never drop-shadowed):

- `--shadow-tile: 0 0 0 1px var(--hairline), 0 1px 2px <contact>, 0 8px 24px -6px <ambient>`
- `--shadow-float: 0 0 0 1px var(--hairline-strong), 0 4px 8px <contact>, 0 24px 60px -12px <ambient>`
- Dark ambient = black alphas; light ambient = faint cool emerald
  (`oklch(0.5 0.02 165 / …)`), never muddy grey.

`.glaze-tile` (unlayered CSS so it wins over the preset's utility classes; the
same recipe is applied to `[data-variant="floating"] [data-slot="sidebar-inner"]`
so shadcn floating sidebars are tiles automatically): `border-radius:
var(--radius-panel)`, `background: var(--tile-fill, var(--surface-0))`
(override fill per tile via `[--tile-fill:var(--surface-1)]`), `box-shadow:
var(--shadow-tile)`, plus a `::before` overlay painting the glaze edge —
`linear-gradient(180deg, var(--glaze) 0, transparent 3px)` masked with
`linear-gradient(90deg, transparent, #000 18%, #000 82%, transparent)`.

**Gotcha:** do NOT put `backdrop-filter` on tiles that contain
`position: fixed` descendants (it creates a containing block and re-anchors
shadcn's fixed sidebars). Blur is a no-op over the native vibrancy void anyway;
reserve `backdrop-filter` for surfaces that float over page content (menus,
dialogs, the sticky tab pill).

### Rules

- **Radius nesting:** tiles/dialogs/capsules `--radius-panel` (16px) → rows
  `--radius-md` → chips `--radius-sm`/`rounded-full`. No element's radius ≥ its
  parent's. (Phase 2 reconciles the preset's `rounded-3xl/4xl` primitives.)
- **Hairlines:** only the tile perimeter gets the fired-edge treatment
  (`--hairline`, inside the shadow stack). Internal seams (headers, footers,
  splits) stay `border-border`.
- **Hover grammar (one treatment):** background warms to `--hover-fill` over
  `--dur-fast` on `--ease-glaze`. Buttons may additionally brighten their glaze.
  Active tab = `--surface-2` + glaze + 1px emerald underglow. Forbidden:
  translate/scale lifts, glow blooms. Porcelain is set in place; only light moves.
- **Motion:** one easing curve (`--ease-glaze`), three durations. Nothing
  bounces. `prefers-reduced-motion` → opacity-only.
- **Focus:** emerald, via the `--ring` token override (primitives already use
  `ring-ring/*` — zero component edits needed).

## 4. Encoding (composition layer)

Per the Vercel composition patterns and hard rule 5 (shadcn primitives only,
wrappers fine), the system is encoded once, not copy-pasted:

- **`ui/surface.tsx`** — a CVA wrapper mirroring `button.tsx`'s idiom exactly.
  `tone`: `tile` (glaze tile), `raised` (tile at `--surface-2`), `glass` (the
  frosted-pill recipe, extracted from `app-sidebar.tsx`), `chip` (floating
  status chip). `motion`: `none` | `hover` (the hover grammar). Attach to
  shadcn parts via Base UI's `render` prop, e.g.
  `<TabsList render={<Surface tone="glass" />} …>`.
- **Phase 3 helpers** (add when adopted): `Toolbar`/`ToolbarTitle` (the 4×
  duplicated viewer header), `ViewerStatus` (the 12× loading/error paragraph),
  `.code-gutter` utility (the 3× drifted gutter recipe).
- Never encode the system by editing `ui/*` class strings (preset re-apply
  overwrites them) — tokens + unlayered CSS + wrappers only.

## 5. Phased rollout (conflict-aware)

A parallel code-quality session owns most git/viewer/shell leaf components.
**Its work has priority.** Phases are ordered so each lands only in files that
session isn't touching.

| Phase | Scope | Files | Status |
|---|---|---|---|
| **0** | Tokens, `.glaze-tile`, floating-sidebar skin, emerald `--ring`, `ui/surface.tsx` | `main.css`, `ui/surface.tsx` (additive) | DONE |
| **1** | Floating shell: left sidebar `variant="floating"`, main panel becomes a tile, right sidebar `variant="floating"` (one attribute), top bar transparent inside the tile, void margins incl. collapsed states | `app-shell.tsx`, `app-sidebar.tsx`, `right-sidebar.tsx` (1 attr) | DONE (geometry verified: all voids exactly 8px) |
| **2** | ~~Tab capsule segments~~ DONE (`.glaze-segment` in `main.css`, `tab-bar.tsx`). Remaining: transient glass for dialog/command (`--surface-3` + `--shadow-float` + blur); radius reconciliation pass over preset primitives; monochrome sidebar-tab icons | `ui/dialog.tsx`, `ui/command.tsx`, `ui/button.tsx` (re-apply-safe via tokens where possible), `app-sidebar.tsx` | TODO |
| **3** | Adoption: hover grammar + `--dur-fast` transitions on every row (tree, changes, history, commit files, search, finder items); `Toolbar`/`ViewerStatus`/`.code-gutter`; `Surface tone="chip"` for editor chips | the currently-dirty viewer/git files — **only after the quality session lands** | TODO |
| **4** | Color discipline: semantic tokens `--color-added`/`--color-removed`/`--color-renamed` (one green, one red), route diff rows + status badges + ± counts through them; `--text-2xs` token replacing ad-hoc `text-[10px]` | `main.css` + dirty git/viewer files | TODO |

**Verification:** every phase runs the full gate
(`pnpm lint && pnpm typecheck && pnpm test && pnpm build`) plus a visual pass
(dev app screenshots — hover, focus, collapsed sidebar, both sidebars toggled,
Cmd+P open) before commit. Traffic-light offsets (`pl-[4.25rem]`-style values)
must be re-tuned visually whenever tile geometry changes.

## 6. Anti-generic check

Eliminated tells: slab shell with `border-r` → floating tiles over void;
`hover:bg-accent` snap-hovers → one warmed-fill grammar with motion; muted-grey
focus ring → emerald; folder tabs → lit capsule; flat `shadow-sm ring-1` cards →
layered lift + glaze edge. Checked against the frontend-design calibration: this
is not the cream-serif default, not flat-black-plus-acid-accent (the surface is
dimensional translucent ceramic; emerald is functional, not decorative), not
broadsheet hairlines. The glaze edge is the memorable, ownable device — generic
dark-glass passes glow whole panels; Glaze lights only the fired edge.
