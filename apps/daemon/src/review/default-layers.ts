import type { Layer } from './flow'

/**
 * The starter grouping, used until a profile declares its own (ADR 0003).
 *
 * Deliberately thin: two labels every repository has, whatever it is written in.
 * Porcelain never grows this into a guess about someone's architecture, because
 * a confident wrong order makes a reader trust a story that isn't true.
 */
export const DEFAULT_LAYERS: Layer[] = [
  {
    label: 'Docs',
    pattern: '(^|/)(README|CONTRIBUTING|LICENSE|CHANGELOG)(\\.md)?$|(^|/)docs/',
  },
  {
    label: 'Agents',
    pattern:
      '(^|/)(AGENTS|CLAUDE|CLAUDE\\.local)\\.md$|(^|/)\\.agents/|(^|/)\\.claude/|(^|/)skills/',
  },
]

/**
 * The layers a changeset actually groups by.
 *
 * An empty declaration means "nothing declared yet", not "no story order" — the
 * starters still apply. A worktree that wants story order OFF says so by
 * declaring an override with `layers: []`, which resolves to the starters too;
 * turning grouping off entirely is not a thing the profile expresses today.
 */
export function effectiveLayers(declared: readonly Layer[]): Layer[] {
  return declared.length > 0 ? [...declared] : DEFAULT_LAYERS
}
