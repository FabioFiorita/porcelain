# Design overhaul — live doc

Written 2026-07-19. User-sanctioned "major refactor" of the UI's professionalism
gap vs T3 Code and Synara. Evidence: competitor screenshots + our own `pnpm shots`
captures, compared side by side (session scratchpad `competitor-ui/` +
`marketing/shots/`). Steer: **the reading room** (see
`positioning-and-roadmap.md`) — out-legible them, don't out-glassmorphism them.

## Diagnosis

What reads "professional" in both competitors is narrow: one accent on
near-black, sans-for-chrome/mono-for-code typography, everything composed as
bordered cards, and fully committed chrome. Against that, our gaps in impact
order:

1. **Typography (the #1 gap).** The app ships ONLY monospace fonts
   (`@fontsource-variable/geist-mono`, `jetbrains-mono`) — panel headers, board
   cards, buttons, menus, and even the Review's long-form PROSE are all mono.
   Both competitors reserve mono for codelike tokens. For a product whose
   identity is *reading*, prose in monospace is the single biggest drag.
2. **Dead space / composition.** Board viewer: cards hug the top-left of a huge
   empty canvas. Review's diagram card reserves far more height than the SVG.
   Workspace right panel is one lone Notes stub at the bottom of an empty column.
3. **Redundant double-render.** Wide viewer surfaces (Board) repeat the same
   content as the sidebar list beside them.
4. **The floating top search pill** sits alone in a full-height black band —
   wasted vertical space that reads unfinished.
5. **Already right (keep):** chromatic restraint, 1px card borders, right-aligned
   diff counts, the icon rail, the three-region shell, nova/shadcn foundation.
   **No teardown** — this is composition polish, not a redesign.

## Phases

- **A — Typography system. SHIPPED 2026-07-19.** Geist (sans) is the UI + prose
  face; mono ONLY for: code/diffs, terminal, file paths & names, +/− counts,
  SHAs/branches, kbd shortcuts, codelike chips, file/diff tab titles. Taste
  calls decided: model chips sans (friendly catalog labels), commit-message
  textarea sans, terminal session names sans. Traps: `ui/kbd.tsx` is vendored
  shadcn with a local `font-sans`→`font-mono` edit — re-applying the preset
  reverts it (re-graft list); `VirtualRows` hardcodes `font-mono`, which is what
  keeps all reading surfaces mono under a sans body. Only one linux baseline
  shifted >2% (`settings-general`); **darwin baselines + a marketing-image
  refresh still need the macos-14 regen workflow before the next release.**
- **B — Composition. SHIPPED 2026-07-19 (`5c02d45`).** Board columns share the
  canvas (centered `max-w-[80rem]`, equal flex widths, quiet empty-column
  placeholder); the Review diagram container sizes to the SVG's intrinsic
  aspect ratio parsed from markup on the parent side (`svgAspectRatio`, unit
  tested — the sandboxed iframe can't be measured; `sandbox=""` + srcdoc
  invariant untouched), capped by a `max-h` scroll well; empty Pinned panel got
  the centered empty-state treatment. The top bar was split OUT of this phase —
  it hosts macOS traffic lights/drag regions, needs the `audit` skill and its
  own pass (still open, below).
- **C — Complementarity.** When a wide viewer surface duplicates the sidebar
  list, the sidebar complements (or collapses) instead of repeating it; a
  confidence pass over empty states (centered, actioned, one line of copy).
- **C2 — Top bar (deferred from B).** The floating search pill sits in a
  full-height band; slim/integrate it without breaking the macOS drag region /
  traffic lights. Read the `audit` skill first; design decided by the
  orchestrator, not delegated blind.
- **D — Re-shoot.** `pnpm shots` regen, swap `marketing/images/`, og:image,
  baseline sync.

Verification for every phase: `pnpm shots` before/after compare, lint/test/
build gate, visual baselines updated deliberately (never blindly).
