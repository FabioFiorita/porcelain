import { describe, expect, it } from 'vitest'
import type { ChangedFile, DiffHunk } from './diff'
import {
  buildDiffReading,
  buildFeatureReading,
  buildFeatureView,
  expandContext,
  resolveRelativeImport,
} from './feature-view'
import { DEFAULT_LAYERS, type FlowGroup } from './flow'
import type { ReviewSet } from './review-set'

const changed = (path: string, status: ChangedFile['status'] = 'modified'): ChangedFile => ({
  path,
  status,
})

// The view is review-set-only now; an empty set is the minimal input (declared
// files/sections just widen it).
const emptySet = (name = 'Feature view'): ReviewSet => ({ name, files: [], sections: [] })

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
    expect(resolveRelativeImport('@acme/shared/client', 'app/x.ts', files)).toBeNull()
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

  it('groups changed files in flow order with an empty review set', () => {
    const view = buildFeatureView({
      name: 'Feature view',
      changed: [changed('app/screens/crew/tab.tsx'), changed('app/hooks/use-crew.ts')],
      contextPaths: [],
      reviewSet: emptySet(),
      sources: new Map(),
      stats: noStats,
      layers,
    })
    expect(view.groups.map((g) => g.layer)).toEqual(['Pages', 'Hooks'])
    expect(view.groups[0]?.files[0]?.source).toBe('changed')
    expect(view.sections).toEqual([])
    expect(view.thesis).toBeUndefined()
  })

  it('tags context files and keeps them in their own layer', () => {
    const view = buildFeatureView({
      name: 'Feature view',
      changed: [changed('app/screens/crew/tab.tsx')],
      contextPaths: ['app/hooks/use-crew.ts'],
      reviewSet: emptySet(),
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
      sections: [],
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

  it('lets the agent drive the feature view grouping + order via per-file layers', () => {
    // `app/` would regex into Pages, `store/`/`infra/` would fall into Other; the
    // agent's explicit layers + declared order win for the feature view (the Changes
    // tab still uses the regex layers). This is the user's Q2 outcome.
    const reviewSet: ReviewSet = {
      name: 'Account access',
      files: [
        { path: 'app/core/AppAccessProvider.tsx', source: 'context', layer: 'Bootstrap' },
        { path: 'store/registration/index.tsx', source: 'context', layer: 'Store' },
        { path: 'infra/auth/createAccountDraft.ts', source: 'shipped', layer: 'Infra' },
      ],
      sections: [],
    }
    const view = buildFeatureView({
      name: 'Account access',
      changed: [],
      contextPaths: [],
      reviewSet,
      sources: new Map(),
      stats: noStats,
      layers,
    })
    expect(view.groups.map((g) => g.layer)).toEqual(['Bootstrap', 'Store', 'Infra'])
    expect(view.groups.flatMap((g) => g.files.map((f) => f.path))).toEqual([
      'app/core/AppAccessProvider.tsx',
      'store/registration/index.tsx',
      'infra/auth/createAccountDraft.ts',
    ])
  })

  it('honours declared order and regex-fills an un-layered file in agent mode', () => {
    const reviewSet: ReviewSet = {
      name: 'X',
      files: [
        { path: 'app/screens/crew/tab.tsx' }, // no layer → regex → Pages
        { path: 'server/services/crew.service.ts', source: 'shipped', layer: 'Services' },
      ],
      sections: [],
    }
    const view = buildFeatureView({
      name: 'X',
      changed: [changed('app/screens/crew/tab.tsx')],
      contextPaths: [],
      reviewSet,
      sources: new Map(),
      stats: noStats,
      layers,
    })
    expect(view.groups.map((g) => g.layer)).toEqual(['Pages', 'Services'])
  })

  it('connects files within the view via their imports', () => {
    const view = buildFeatureView({
      name: 'Feature view',
      changed: [changed('app/screens/crew/tab.tsx')],
      contextPaths: ['app/hooks/use-crew.ts'],
      reviewSet: emptySet(),
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
      reviewSet: emptySet(),
      sources: new Map(),
      stats: new Map([['app/hooks/use-crew.ts', { additions: 74, deletions: 3 }]]),
      layers,
    })
    expect(view.groups[0]?.files[0]).toMatchObject({ additions: 74, deletions: 3 })
  })

  it('carries the thesis and a per-section outline (title + anchor count)', () => {
    const reviewSet: ReviewSet = {
      name: 'Login flow',
      thesis: 'One round-trip instead of three.',
      files: [{ path: 'app/login.tsx' }],
      sections: [
        { title: 'Entry point', prose: 'starts here', anchors: [{ path: 'app/login.tsx' }] },
        { title: 'Server half', prose: 'the seam', anchors: [] },
      ],
    }
    const view = buildFeatureView({
      name: 'Login flow',
      changed: [changed('app/login.tsx')],
      contextPaths: [],
      reviewSet,
      sources: new Map(),
      stats: noStats,
      layers,
    })
    expect(view.thesis).toBe('One round-trip instead of three.')
    expect(view.sections).toEqual([
      { title: 'Entry point', anchorCount: 1 },
      { title: 'Server half', anchorCount: 0 },
    ])
  })
})

describe('buildFeatureReading', () => {
  const sources = new Map([
    ['app/page.tsx', "import { greet } from './svc'"],
    ['app/svc.ts', 'export function greet() {\n  return 1\n}\nexport const UNUSED = 2'],
  ])
  const view = buildFeatureView({
    name: 'Feature',
    changed: [changed('app/page.tsx')],
    contextPaths: ['app/svc.ts'],
    reviewSet: emptySet('Feature'),
    sources,
    stats: new Map(),
    layers: DEFAULT_LAYERS,
  })
  const diffs = new Map<string, DiffHunk[]>([
    [
      'app/page.tsx',
      [{ header: '@@ -1 +1 @@', lines: [{ kind: 'add', oldLine: null, newLine: 1, text: 'x' }] }],
    ],
  ])

  it('passes diff hunks through for changed files and slices the rest', () => {
    const reading = buildFeatureReading({ view, sections: [], sources, diffs, evidence: null })
    const files = reading.groups.flatMap((g) => g.files)

    const page = files.find((f) => f.path === 'app/page.tsx')
    expect(page?.source).toBe('changed')
    expect(page?.hunks).toHaveLength(1)
    expect(page?.ranges).toBeUndefined()

    const svc = files.find((f) => f.path === 'app/svc.ts')
    expect(svc?.source).toBe('context')
    expect(svc?.hunks).toBeUndefined()
    const sliced = svc?.ranges?.flatMap((r) => r.lines).join('\n') ?? ''
    // page imports only `greet`, so the slice keeps it and drops the UNUSED export
    expect(sliced).toContain('export function greet')
    expect(sliced).not.toContain('UNUSED')
  })

  it('carries the thesis, the sections with prose/diagram, and the evidence meta', () => {
    const thesisView = buildFeatureView({
      name: 'Feature',
      changed: [changed('app/page.tsx')],
      contextPaths: [],
      reviewSet: { name: 'Feature', thesis: 'The why.', files: [], sections: [] },
      sources,
      stats: new Map(),
      layers: DEFAULT_LAYERS,
    })
    const reading = buildFeatureReading({
      view: thesisView,
      sections: [
        {
          title: 'Entry',
          prose: 'starts here',
          diagram: '<svg />',
          html: '<table><tr><td>ok</td></tr></table>',
          htmlHeight: 320,
          anchors: [],
        },
      ],
      sources,
      diffs,
      evidence: {
        title: 'Loop closed',
        updatedAt: '2026-07-18T00:00:00Z',
        checks: [{ label: 'pnpm test', status: 'pass', detail: '1348 passed' }],
        medium: 'html',
      },
    })
    expect(reading.thesis).toBe('The why.')
    expect(reading.sections).toEqual([
      {
        title: 'Entry',
        prose: 'starts here',
        diagram: '<svg />',
        html: '<table><tr><td>ok</td></tr></table>',
        htmlHeight: 320,
        files: [],
      },
    ])
    expect(reading.evidence).toEqual({
      title: 'Loop closed',
      updatedAt: '2026-07-18T00:00:00Z',
      checks: [{ label: 'pnpm test', status: 'pass', detail: '1348 passed' }],
      medium: 'html',
    })
  })

  it("gives a rangeless anchor the file's normal reading block and removes it from groups", () => {
    const reading = buildFeatureReading({
      view,
      sections: [{ title: 'Entry', prose: 'the page', anchors: [{ path: 'app/page.tsx' }] }],
      sources,
      diffs,
      evidence: null,
    })
    const anchored = reading.sections[0]?.files[0]
    expect(anchored).toMatchObject({ path: 'app/page.tsx', source: 'changed' })
    expect(anchored?.hunks).toHaveLength(1)
    // anchored files do not repeat in the leftover groups; the rest stays
    const leftover = reading.groups.flatMap((g) => g.files.map((f) => f.path))
    expect(leftover).toEqual(['app/svc.ts'])
  })

  it('resolves a ranged anchor on a changed file to the intersecting hunks', () => {
    const twoHunks = new Map<string, DiffHunk[]>([
      [
        'app/page.tsx',
        [
          { header: '@@ -1 +1 @@', lines: [{ kind: 'add', oldLine: null, newLine: 1, text: 'a' }] },
          {
            header: '@@ -40 +40 @@',
            lines: [{ kind: 'add', oldLine: null, newLine: 40, text: 'b' }],
          },
        ],
      ],
    ])
    const reading = buildFeatureReading({
      view,
      sections: [
        {
          title: 'Tail',
          prose: 'the bottom half',
          anchors: [{ path: 'app/page.tsx', startLine: 39, endLine: 45 }],
        },
      ],
      sources,
      diffs: twoHunks,
      evidence: null,
    })
    const anchored = reading.sections[0]?.files[0]
    expect(anchored?.hunks).toHaveLength(1)
    expect(anchored?.hunks?.[0]?.header).toBe('@@ -40 +40 @@')
  })

  it('resolves a ranged anchor on an unchanged file to a single clamped slice', () => {
    const reading = buildFeatureReading({
      view,
      sections: [
        {
          title: 'Service',
          prose: 'the greet body',
          // endLine runs past the 4-line file — clamped to its length
          anchors: [{ path: 'app/svc.ts', startLine: 2, endLine: 99 }],
        },
      ],
      sources,
      diffs,
      evidence: null,
    })
    const anchored = reading.sections[0]?.files[0]
    expect(anchored?.source).toBe('context')
    expect(anchored?.ranges).toEqual([
      {
        startLine: 2,
        lines: ['  return 1', '}', 'export const UNUSED = 2'],
        gapBefore: 1,
      },
    ])
    expect(anchored?.truncated).toBeFalsy()
  })
})

describe('buildDiffReading', () => {
  const groups: FlowGroup[] = [
    {
      layer: 'Pages',
      files: [
        {
          path: 'app/page.tsx',
          status: 'modified',
          connects: [],
          additions: 2,
          deletions: 1,
        },
      ],
    },
    {
      layer: 'Data',
      files: [
        {
          path: 'schema.prisma',
          status: 'deleted',
          connects: [],
          deletions: 5,
        },
      ],
    },
  ]
  const diffs = new Map<string, DiffHunk[]>([
    [
      'app/page.tsx',
      [{ header: '@@ -1 +1 @@', lines: [{ kind: 'add', oldLine: null, newLine: 1, text: 'x' }] }],
    ],
  ])

  it('keeps flow order and tags every file as changed with its hunks/status', () => {
    const reading = buildDiffReading({ name: 'Changes', groups, diffs })
    expect(reading.name).toBe('Changes')
    expect(reading.groups.map((g) => g.layer)).toEqual(['Pages', 'Data'])
    const [page, schema] = reading.groups.flatMap((g) => g.files)
    expect(page).toMatchObject({
      path: 'app/page.tsx',
      source: 'changed',
      status: 'modified',
      additions: 2,
      deletions: 1,
    })
    expect(page?.hunks).toHaveLength(1)
    expect(schema).toMatchObject({
      path: 'schema.prisma',
      source: 'changed',
      status: 'deleted',
      hunks: [],
    })
  })
})
