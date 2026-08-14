import { describe, expect, it } from 'vitest'
import type { ChangedFile, DiffHunk } from '../git/diff'
import {
  buildActiveReview,
  buildDiffReading,
  buildReviewReading,
  resolveRelativeImport,
} from './active-review'
import type { FlowGroup, Layer } from './flow'
import type { ReviewSet } from './review-set'

const changed = (path: string, status: ChangedFile['status'] = 'modified'): ChangedFile => ({
  path,
  status,
})

const emptySet = (name = 'Active review'): ReviewSet => ({ name, files: [], sections: [] })

/** Product-shaped layers for tests that assert regex fallback grouping (not repo starters). */
const STORY_LAYERS: Layer[] = [
  { label: 'Pages', pattern: '(^|/)(pages|views|screens|app)/' },
  { label: 'Components', pattern: '(^|/)components?/' },
  { label: 'Hooks', pattern: '(^|/)hooks?/' },
  { label: 'Services', pattern: '(^|/)services?/' },
  { label: 'Data', pattern: '(^|/)(prisma|schema|models?)/' },
]

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

describe('buildActiveReview', () => {
  const layers = STORY_LAYERS
  const noStats = new Map<string, { additions: number; deletions: number }>()

  it('is empty when the agent listed no files, even if the working tree is dirty', () => {
    const view = buildActiveReview({
      name: 'Active review',
      changed: [changed('app/screens/crew/tab.tsx'), changed('app/hooks/use-crew.ts')],
      reviewSet: emptySet(),
      sources: new Map(),
      stats: noStats,
      layers,
    })
    expect(view.groups).toEqual([])
    expect(view.sections).toEqual([])
    expect(view.thesis).toBeUndefined()
  })

  it('does not auto-include unlisted working-tree or import-context files', () => {
    // The incidental e2e config fix that isn't part of the feature story.
    const reviewSet: ReviewSet = {
      name: 'Feature X',
      files: [{ path: 'app/screens/crew/tab.tsx', note: 'entry' }],
      sections: [],
    }
    const view = buildActiveReview({
      name: 'Feature X',
      changed: [
        changed('app/screens/crew/tab.tsx'),
        changed('e2e/helpers/ui-config.ts'),
        changed('app/hooks/use-crew.ts'),
      ],
      reviewSet,
      sources: new Map(),
      stats: noStats,
      layers,
    })
    const paths = view.groups.flatMap((g) => g.files.map((f) => f.path))
    expect(paths).toEqual(['app/screens/crew/tab.tsx'])
    expect(view.groups[0]?.files[0]).toMatchObject({
      path: 'app/screens/crew/tab.tsx',
      source: 'changed',
      note: 'entry',
    })
  })

  it('tags agent-listed files with git truth and keeps declared notes/sources', () => {
    const reviewSet: ReviewSet = {
      name: 'Call-outs',
      files: [
        { path: 'server/services/crew.service.ts', source: 'shipped', note: 'owns the labels' },
        { path: 'app/hooks/use-crew.ts', note: 'maps ISO date' },
        { path: 'app/types.ts', source: 'context' },
      ],
      sections: [],
    }
    const view = buildActiveReview({
      name: 'fallback',
      changed: [changed('app/hooks/use-crew.ts')],
      reviewSet,
      sources: new Map(),
      stats: noStats,
      layers,
    })
    expect(view.fromAgent).toBe(true)
    expect(view.name).toBe('fallback')
    const byPath = new Map(view.groups.flatMap((g) => g.files.map((f) => [f.path, f] as const)))
    expect(byPath.get('server/services/crew.service.ts')).toMatchObject({
      source: 'shipped',
      note: 'owns the labels',
    })
    // declared without source but git says changed → stays 'changed', note attaches
    expect(byPath.get('app/hooks/use-crew.ts')).toMatchObject({
      source: 'changed',
      note: 'maps ISO date',
    })
    expect(byPath.get('app/types.ts')).toMatchObject({ source: 'context' })
  })

  it('lets the agent drive grouping + order via per-file layers and --files order', () => {
    // `app/` would regex into Pages, `store/`/`infra/` into Other; the agent's
    // explicit layers + declared order win for the active review (Changes still
    // uses the regex layers).
    const reviewSet: ReviewSet = {
      name: 'Account access',
      files: [
        { path: 'app/core/AppAccessProvider.tsx', source: 'context', layer: 'Bootstrap' },
        { path: 'store/registration/index.tsx', source: 'context', layer: 'Store' },
        { path: 'infra/auth/createAccountDraft.ts', source: 'shipped', layer: 'Infra' },
      ],
      sections: [],
    }
    const view = buildActiveReview({
      name: 'Account access',
      changed: [],
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

  it('honours declared order and regex-fills an un-layered file', () => {
    const reviewSet: ReviewSet = {
      name: 'X',
      files: [
        { path: 'app/screens/crew/tab.tsx' }, // no layer → regex → Pages
        { path: 'server/services/crew.service.ts', source: 'shipped', layer: 'Services' },
      ],
      sections: [],
    }
    const view = buildActiveReview({
      name: 'X',
      changed: [changed('app/screens/crew/tab.tsx')],
      reviewSet,
      sources: new Map(),
      stats: noStats,
      layers,
    })
    expect(view.groups.map((g) => g.layer)).toEqual(['Pages', 'Services'])
  })

  it('keeps the first occurrence when the agent lists a path twice', () => {
    const reviewSet: ReviewSet = {
      name: 'X',
      files: [
        { path: 'app/a.ts', note: 'first' },
        { path: 'app/b.ts' },
        { path: 'app/a.ts', note: 'second' },
      ],
      sections: [],
    }
    const view = buildActiveReview({
      name: 'X',
      changed: [],
      reviewSet,
      sources: new Map(),
      stats: noStats,
      layers,
    })
    const paths = view.groups.flatMap((g) => g.files.map((f) => f.path))
    expect(paths).toEqual(['app/a.ts', 'app/b.ts'])
    expect(view.groups.flatMap((g) => g.files).find((f) => f.path === 'app/a.ts')?.note).toBe(
      'first',
    )
  })

  it('carries no import-graph edges on the wire', () => {
    const reviewSet: ReviewSet = {
      name: 'Active review',
      files: [
        { path: 'app/screens/crew/tab.tsx' },
        { path: 'app/hooks/use-crew.ts', source: 'context' },
      ],
      sections: [],
    }
    const view = buildActiveReview({
      name: 'Active review',
      changed: [changed('app/screens/crew/tab.tsx')],
      reviewSet,
      sources: new Map([
        ['app/screens/crew/tab.tsx', "import { useCrew } from '../../hooks/use-crew'"],
      ]),
      stats: noStats,
      layers,
    })
    for (const file of view.groups.flatMap((g) => g.files)) {
      expect(file).not.toHaveProperty('connects')
      expect(file).not.toHaveProperty('layer')
    }
  })

  it('attaches numstat additions/deletions to listed changed files', () => {
    const reviewSet: ReviewSet = {
      name: 'Active review',
      files: [{ path: 'app/hooks/use-crew.ts' }],
      sections: [],
    }
    const view = buildActiveReview({
      name: 'Active review',
      changed: [changed('app/hooks/use-crew.ts')],
      reviewSet,
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
    const view = buildActiveReview({
      name: 'Login flow',
      changed: [changed('app/login.tsx')],
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

describe('buildReviewReading', () => {
  const sources = new Map([
    ['app/page.tsx', "import { greet } from './svc'"],
    ['app/svc.ts', 'export function greet() {\n  return 1\n}\nexport const UNUSED = 2'],
  ])
  const reviewSet: ReviewSet = {
    name: 'Feature',
    files: [{ path: 'app/page.tsx' }, { path: 'app/svc.ts', source: 'context' }],
    sections: [],
  }
  const view = buildActiveReview({
    name: 'Feature',
    changed: [changed('app/page.tsx')],
    reviewSet,
    sources,
    stats: new Map(),
    layers: STORY_LAYERS,
  })
  const diffs = new Map<string, DiffHunk[]>([
    [
      'app/page.tsx',
      [{ header: '@@ -1 +1 @@', lines: [{ kind: 'add', oldLine: null, newLine: 1, text: 'x' }] }],
    ],
  ])

  it('passes diff hunks through for changed files and slices the rest', () => {
    const reading = buildReviewReading({ view, sections: [], sources, diffs, evidence: null })
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
    const thesisView = buildActiveReview({
      name: 'Feature',
      changed: [changed('app/page.tsx')],
      reviewSet: { name: 'Feature', thesis: 'The why.', files: [], sections: [] },
      sources,
      stats: new Map(),
      layers: STORY_LAYERS,
    })
    const reading = buildReviewReading({
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
    })
  })

  it("gives a rangeless anchor the file's normal reading block and removes it from groups", () => {
    const reading = buildReviewReading({
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
    const reading = buildReviewReading({
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
    const reading = buildReviewReading({
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
