import { describe, expect, it } from 'vitest'
import type { ChangedFile } from './diff'
import {
  buildFlow,
  DEFAULT_LAYERS,
  groupByLayer,
  groupByLayerOrdered,
  type Layer,
  layerFor,
  OTHER_LABEL,
  parseImports,
  resolveImport,
} from './flow'

/** A small product-shaped stack for tests that need multi-layer story order. */
const STORY_LAYERS: Layer[] = [
  { label: 'Components', pattern: '(^|/)components?/' },
  { label: 'Services', pattern: '(^|/)services?/' },
  { label: 'Data', pattern: '(^|/)(prisma|schema|models?)/' },
  { label: 'Tests', pattern: '\\.(test|spec)\\.[a-z]+$' },
]

describe('DEFAULT_LAYERS (starters)', () => {
  it('is only Docs + Agents — not a fat framework stack', () => {
    expect(DEFAULT_LAYERS.map((l) => l.label)).toEqual(['Docs', 'Agents'])
    expect(DEFAULT_LAYERS.some((l) => l.label === 'Components')).toBe(false)
    expect(DEFAULT_LAYERS.some((l) => l.label === 'Pages')).toBe(false)
  })

  it('buckets docs and agent paths; product code falls to Other', () => {
    expect(layerFor('README.md', DEFAULT_LAYERS)).toBe('Docs')
    expect(layerFor('docs/guide.md', DEFAULT_LAYERS)).toBe('Docs')
    expect(layerFor('CONTRIBUTING.md', DEFAULT_LAYERS)).toBe('Docs')
    expect(layerFor('AGENTS.md', DEFAULT_LAYERS)).toBe('Agents')
    expect(layerFor('CLAUDE.md', DEFAULT_LAYERS)).toBe('Agents')
    expect(layerFor('.agents/skills/foo/SKILL.md', DEFAULT_LAYERS)).toBe('Agents')
    expect(layerFor('.claude/settings.json', DEFAULT_LAYERS)).toBe('Agents')
    expect(layerFor('src/components/Widget.tsx', DEFAULT_LAYERS)).toBe(OTHER_LABEL)
    expect(layerFor('prisma/schema.prisma', DEFAULT_LAYERS)).toBe(OTHER_LABEL)
  })
})

describe('layerFor', () => {
  it('maps paths to layers on a custom set', () => {
    expect(layerFor('src/components/Widget.tsx', STORY_LAYERS)).toBe('Components')
    expect(layerFor('libs/core/services/billing.ts', STORY_LAYERS)).toBe('Services')
    expect(layerFor('prisma/schema.prisma', STORY_LAYERS)).toBe('Data')
  })

  it('classifies tests by filename over directory', () => {
    expect(layerFor('src/components/Widget.spec.tsx', STORY_LAYERS)).toBe('Tests')
  })

  it('lets a custom filename layer win over the containing directory', () => {
    const layers = [...STORY_LAYERS, { label: 'Stories', pattern: '\\.stories\\.[a-z]+$' }]
    expect(layerFor('src/components/Widget.stories.tsx', layers)).toBe('Stories')
    expect(layerFor('src/components/Widget.tsx', layers)).toBe('Components')
  })

  it('falls back to Other', () => {
    expect(layerFor('package.json', STORY_LAYERS)).toBe(OTHER_LABEL)
  })
})

describe('parseImports', () => {
  it('finds static, dynamic, and require imports', () => {
    const src = `
      import { a } from './a'
      export { b } from '@lib/b'
      const c = await import('../c')
      const d = require('pkg/d')
    `
    expect(parseImports(src).sort()).toEqual(['../c', './a', '@lib/b', 'pkg/d'])
  })
})

describe('resolveImport', () => {
  const changed = ['src/services/user.ts', 'src/components/Widget.tsx', 'libs/db/client/index.ts']

  it('resolves relative imports', () => {
    expect(resolveImport('../services/user', 'src/components/Widget.tsx', changed)).toBe(
      'src/services/user.ts',
    )
  })

  it('resolves aliased imports by trailing segments', () => {
    expect(resolveImport('@app/services/user', 'x.ts', changed)).toBe('src/services/user.ts')
  })

  it('resolves index files', () => {
    expect(resolveImport('@libs/db/client', 'x.ts', changed)).toBe('libs/db/client/index.ts')
  })

  it('returns null for unknown imports', () => {
    expect(resolveImport('react', 'x.ts', changed)).toBeNull()
  })
})

describe('buildFlow', () => {
  it('groups files in layer order with import edges', () => {
    const files: ChangedFile[] = [
      { path: 'src/services/user.ts', status: 'modified' },
      { path: 'src/components/Profile.tsx', status: 'modified' },
      { path: 'prisma/schema.prisma', status: 'modified' },
    ]
    const sources = new Map([
      ['src/components/Profile.tsx', "import { getUser } from '../services/user'"],
    ])

    const groups = buildFlow(files, sources, STORY_LAYERS)
    expect(groups.map((g) => g.layer)).toEqual(['Components', 'Services', 'Data'])
    expect(groups[0]?.files[0]?.connects).toEqual(['src/services/user.ts'])
  })

  it('with starters, product files sit in Other', () => {
    const files: ChangedFile[] = [
      { path: 'README.md', status: 'modified' },
      { path: 'src/app.ts', status: 'modified' },
    ]
    const groups = buildFlow(files, new Map(), DEFAULT_LAYERS)
    expect(groups.map((g) => g.layer)).toEqual(['Docs', OTHER_LABEL])
  })
})

describe('groupByLayer', () => {
  it('orders groups by declared layer with Other last and sorts files by path', () => {
    const items = [
      { path: 'src/services/b.ts' },
      { path: 'src/components/a.tsx' },
      { path: 'README.md' },
      { path: 'src/components/c.tsx' },
    ]
    const groups = groupByLayer(items, STORY_LAYERS)
    expect(groups.map((g) => g.layer)).toEqual(['Components', 'Services', OTHER_LABEL])
    expect(groups[0]?.files.map((f) => f.path)).toEqual([
      'src/components/a.tsx',
      'src/components/c.tsx',
    ])
  })
})

describe('groupByLayerOrdered', () => {
  it('honours an explicit per-item layer over the regex match', () => {
    const items = [
      { path: 'app/core/AppAccessProvider.tsx', layer: 'Bootstrap' },
      { path: 'store/registration/index.tsx', layer: 'Store' },
    ]
    const groups = groupByLayerOrdered(items, DEFAULT_LAYERS)
    expect(groups.map((g) => g.layer)).toEqual(['Bootstrap', 'Store'])
  })

  it('keeps the caller order within a group (no alphabetical sort)', () => {
    const items = [
      { path: 'src/components/z.tsx' },
      { path: 'src/components/a.tsx' },
      { path: 'src/components/m.tsx' },
    ]
    const groups = groupByLayerOrdered(items, STORY_LAYERS)
    expect(groups[0]?.files.map((f) => f.path)).toEqual([
      'src/components/z.tsx',
      'src/components/a.tsx',
      'src/components/m.tsx',
    ])
  })

  it('emits groups in first-appearance order and falls back to Other for un-layered misses', () => {
    const items = [
      { path: 'src/services/b.ts' },
      { path: 'README.md' },
      { path: 'src/components/a.tsx', layer: 'UI' },
    ]
    const groups = groupByLayerOrdered(items, STORY_LAYERS)
    expect(groups.map((g) => g.layer)).toEqual(['Services', OTHER_LABEL, 'UI'])
  })
})

describe('compileLayers + layerFor parity', () => {
  it('layerFor matches a precompiled scan', () => {
    const path = 'libs/core/services/billing.ts'
    expect(layerFor(path, STORY_LAYERS)).toBe('Services')
  })
})
