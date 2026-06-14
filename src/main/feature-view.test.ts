import { describe, expect, it } from 'vitest'
import type { ChangedFile } from './diff'
import { buildFeatureView, expandContext, resolveRelativeImport } from './feature-view'
import { DEFAULT_LAYERS } from './flow'
import type { ReviewSet } from './review-set'

const changed = (path: string, status: ChangedFile['status'] = 'modified'): ChangedFile => ({
  path,
  status,
})

describe('resolveRelativeImport', () => {
  const files = new Set([
    'app/hooks/use-crew.ts',
    'app/screens/crew/index.tsx',
    'app/screens/crew/card.tsx',
  ])

  it('resolves a relative spec to a real file, trying extensions', () => {
    expect(resolveRelativeImport('../../hooks/use-crew', 'app/screens/crew/card.tsx', files)).toBe(
      'app/hooks/use-crew.ts',
    )
  })

  it('resolves a directory spec to its index file', () => {
    expect(resolveRelativeImport('./crew', 'app/screens/list.tsx', files)).toBe(
      'app/screens/crew/index.tsx',
    )
  })

  it('ignores non-relative (alias/bare) specs — those cross seams it cannot follow', () => {
    expect(resolveRelativeImport('@soaphealth/mens-health/client', 'app/x.ts', files)).toBeNull()
    expect(resolveRelativeImport('react', 'app/x.ts', files)).toBeNull()
  })

  it('returns null when the target is not a repo file', () => {
    expect(resolveRelativeImport('./missing', 'app/screens/list.tsx', files)).toBeNull()
  })
})

describe('expandContext', () => {
  it('pulls in unchanged files reachable by a relative import from a changed file', () => {
    const repoFiles = new Set(['app/card.tsx', 'app/use-crew.ts', 'app/types.ts'])
    const sources = new Map([['app/card.tsx', "import { useCrew } from './use-crew'"]])
    expect(expandContext(['app/card.tsx'], sources, repoFiles)).toEqual(['app/use-crew.ts'])
  })

  it('never includes a file that is itself changed', () => {
    const repoFiles = new Set(['app/card.tsx', 'app/use-crew.ts'])
    const sources = new Map([['app/card.tsx', "import { x } from './use-crew'"]])
    expect(expandContext(['app/card.tsx', 'app/use-crew.ts'], sources, repoFiles)).toEqual([])
  })

  it('honours the limit', () => {
    const repoFiles = new Set(['a.ts', 'b.ts', 'c.ts', 'hub.ts'])
    const sources = new Map([
      ['hub.ts', "import a from './a'\nimport b from './b'\nimport c from './c'"],
    ])
    expect(expandContext(['hub.ts'], sources, repoFiles, 2)).toHaveLength(2)
  })
})

describe('buildFeatureView', () => {
  const layers = DEFAULT_LAYERS
  const noStats = new Map<string, { additions: number; deletions: number }>()

  it('groups changed files in flow order with no review set (the baseline)', () => {
    const view = buildFeatureView({
      name: 'Feature view',
      changed: [changed('app/screens/crew/tab.tsx'), changed('app/hooks/use-crew.ts')],
      contextPaths: [],
      reviewSet: null,
      sources: new Map(),
      stats: noStats,
      layers,
    })
    expect(view.fromAgent).toBe(false)
    expect(view.groups.map((g) => g.layer)).toEqual(['Pages', 'Hooks'])
    expect(view.groups[0]?.files[0]?.source).toBe('changed')
  })

  it('tags context files and keeps them in their own layer', () => {
    const view = buildFeatureView({
      name: 'Feature view',
      changed: [changed('app/screens/crew/tab.tsx')],
      contextPaths: ['app/hooks/use-crew.ts'],
      reviewSet: null,
      sources: new Map(),
      stats: noStats,
      layers,
    })
    const hooks = view.groups.find((g) => g.layer === 'Hooks')
    expect(hooks?.files[0]).toMatchObject({ path: 'app/hooks/use-crew.ts', source: 'context' })
  })

  it('overlays an agent review set: shipped files + notes, git status still wins', () => {
    const reviewSet: ReviewSet = {
      name: 'Call-outs',
      files: [
        { path: 'server/services/crew.service.ts', source: 'shipped', note: 'owns the labels' },
        { path: 'app/hooks/use-crew.ts', note: 'maps ISO date' },
      ],
    }
    const view = buildFeatureView({
      name: 'fallback',
      changed: [changed('app/hooks/use-crew.ts')],
      contextPaths: [],
      reviewSet,
      sources: new Map(),
      stats: noStats,
      layers,
    })
    expect(view.fromAgent).toBe(true)
    expect(view.name).toBe('fallback')
    const service = view.groups
      .flatMap((g) => g.files)
      .find((f) => f.path === 'server/services/crew.service.ts')
    expect(service).toMatchObject({ source: 'shipped', note: 'owns the labels' })
    // declared as a plain file but git says it's changed → stays 'changed', note attaches
    const hook = view.groups.flatMap((g) => g.files).find((f) => f.path === 'app/hooks/use-crew.ts')
    expect(hook).toMatchObject({ source: 'changed', note: 'maps ISO date' })
  })

  it('connects files within the view via their imports', () => {
    const view = buildFeatureView({
      name: 'Feature view',
      changed: [changed('app/screens/crew/tab.tsx')],
      contextPaths: ['app/hooks/use-crew.ts'],
      reviewSet: null,
      sources: new Map([
        ['app/screens/crew/tab.tsx', "import { useCrew } from '../../hooks/use-crew'"],
      ]),
      stats: noStats,
      layers,
    })
    const tab = view.groups.flatMap((g) => g.files).find((f) => f.path.endsWith('tab.tsx'))
    expect(tab?.connects).toEqual(['app/hooks/use-crew.ts'])
  })

  it('attaches numstat additions/deletions to changed files', () => {
    const view = buildFeatureView({
      name: 'Feature view',
      changed: [changed('app/hooks/use-crew.ts')],
      contextPaths: [],
      reviewSet: null,
      sources: new Map(),
      stats: new Map([['app/hooks/use-crew.ts', { additions: 74, deletions: 3 }]]),
      layers,
    })
    expect(view.groups[0]?.files[0]).toMatchObject({ additions: 74, deletions: 3 })
  })
})
