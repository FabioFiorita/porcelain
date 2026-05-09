import { describe, expect, it } from 'vitest'
import type { ChangedFile } from './diff'
import { buildFlow, DEFAULT_LAYERS, layerFor, parseImports, resolveImport } from './flow'

describe('layerFor', () => {
  it('maps paths to layers', () => {
    expect(layerFor('src/components/Widget.tsx', DEFAULT_LAYERS)).toBe('Components')
    expect(layerFor('apps/api/controllers/user.ts', DEFAULT_LAYERS)).toBe('Controllers')
    expect(layerFor('libs/core/services/billing.ts', DEFAULT_LAYERS)).toBe('Services')
    expect(layerFor('prisma/schema.prisma', DEFAULT_LAYERS)).toBe('Data')
  })

  it('classifies tests by filename over directory', () => {
    expect(layerFor('src/components/Widget.spec.tsx', DEFAULT_LAYERS)).toBe('Tests')
  })

  it('falls back to Other', () => {
    expect(layerFor('README.md', DEFAULT_LAYERS)).toBe('Other')
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

    const groups = buildFlow(files, sources, DEFAULT_LAYERS)
    expect(groups.map((g) => g.layer)).toEqual(['Components', 'Services', 'Data'])
    expect(groups[0]?.files[0]?.connects).toEqual(['src/services/user.ts'])
  })
})
