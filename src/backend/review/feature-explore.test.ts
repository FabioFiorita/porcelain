import { describe, expect, it } from 'vitest'
import {
  parseImportLocals,
  relativeImportTargets,
  symbolReferenceTargets,
  walkExplore,
} from './feature-explore'

describe('parseImportLocals', () => {
  it('maps the local (alias) name to its imported name + spec', () => {
    expect(parseImportLocals("import { a, b as c } from './x'")).toEqual([
      { local: 'a', imported: 'a', spec: './x' },
      { local: 'c', imported: 'b', spec: './x' },
    ])
  })

  it('handles default and namespace imports', () => {
    expect(parseImportLocals("import Def from './x'")).toEqual([
      { local: 'Def', imported: 'default', spec: './x' },
    ])
    expect(parseImportLocals("import * as ns from './x'")).toEqual([
      { local: 'ns', imported: '*', spec: './x' },
    ])
  })
})

describe('symbolReferenceTargets', () => {
  const repoFiles = new Set(['svc.ts', 'unused.ts'])
  const source = [
    "import { getCallouts } from './svc'",
    "import { neverUsed } from './unused'",
    'export function handler() {',
    '  return getCallouts()',
    '}',
  ].join('\n')

  it('follows only the imports the symbol body actually uses', () => {
    const targets = symbolReferenceTargets(source, 'handler', 'handler.ts', repoFiles)
    expect(targets).toEqual([{ path: 'svc.ts', symbol: 'getCallouts' }])
    // `neverUsed` is imported but not referenced in handler's body → not followed
    expect(targets.some((t) => t.path === 'unused.ts')).toBe(false)
  })
})

describe('relativeImportTargets', () => {
  it('resolves every relative import to a repo file (file-level, coarse)', () => {
    const repoFiles = new Set(['a.ts', 'b.ts'])
    const source = "import { x } from './a'\nimport y from './b'\nimport 'react'"
    expect(relativeImportTargets(source, 'seed.ts', repoFiles).sort()).toEqual(['a.ts', 'b.ts'])
  })
})

describe('walkExplore', () => {
  // page → use-user → api → db, each symbol referencing the next file's export
  const files = new Map([
    [
      'page.tsx',
      "import { useUser } from './use-user'\nexport function Page() {\n  return useUser()\n}",
    ],
    [
      'use-user.ts',
      "import { api } from './api'\nexport function useUser() {\n  return api.get()\n}",
    ],
    ['api.ts', "import { db } from './db'\nexport const api = { get: () => db.query() }"],
    ['db.ts', 'export const db = { query: () => 1 }'],
  ])
  const repoFiles = new Set(files.keys())
  const readSource = async (path: string): Promise<string | undefined> => files.get(path)

  it('walks a symbol seed through the reference chain', async () => {
    const nodes = await walkExplore(
      { kind: 'symbol', path: 'page.tsx', symbol: 'Page' },
      readSource,
      repoFiles,
    )
    expect(nodes.map((n) => n.path).sort()).toEqual(['api.ts', 'db.ts', 'page.tsx', 'use-user.ts'])
    // the seed file carries the seed symbol; downstream files carry what was referenced
    expect(nodes.find((n) => n.path === 'page.tsx')?.symbols).toEqual(['Page'])
    expect(nodes.find((n) => n.path === 'use-user.ts')?.symbols).toEqual(['useUser'])
  })

  it('respects the depth cap', async () => {
    const nodes = await walkExplore(
      { kind: 'symbol', path: 'page.tsx', symbol: 'Page' },
      readSource,
      repoFiles,
      { maxDepth: 1 },
    )
    // depth 0 = page, depth 1 = use-user; api/db are deeper and excluded
    expect(nodes.map((n) => n.path).sort()).toEqual(['page.tsx', 'use-user.ts'])
  })

  it('walks a file seed through every relative import (file-level)', async () => {
    const nodes = await walkExplore({ kind: 'file', path: 'page.tsx' }, readSource, repoFiles)
    expect(nodes.map((n) => n.path).sort()).toEqual(['api.ts', 'db.ts', 'page.tsx', 'use-user.ts'])
    // a file node reaches all exports → empty symbols (slices to everything)
    expect(nodes.find((n) => n.path === 'page.tsx')?.symbols).toEqual([])
  })
})
