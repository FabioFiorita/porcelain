import type { Layer } from '@porcelain/contracts/project-data'

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
