import type { Layer } from './flow'

/** Stable built-in grouping for Changes; no repo-local layer channel is persisted. */
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
