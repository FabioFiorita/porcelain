// Read-only "explore a feature's flow": seed from a symbol (or a whole file) and
// walk the import/reference graph to assemble the connected files — no working-tree
// change, no agent needed. Heuristic and regex-based (no LSP, by design): the
// symbol walk follows a definition's references through RELATIVE imports only, so
// it traces the reachable subgraph on one side of a seam (it can't cross an
// alias/route-string seam — that's the agent's job) and may miss dynamic/indirect
// calls. Bounded by depth + file count to stay fast on a big monorepo.

import { sliceSource } from './feature-slice'
import type { FeatureReading, ReadingFile, ReadingGroup } from './feature-view'
import { resolveRelativeImport } from './feature-view'
import { groupByLayer, type Layer, parseImports } from './flow'

const MAX_DEPTH = 5
const MAX_FILES = 60

export type ExploreSeed =
  | { kind: 'file'; path: string }
  | { kind: 'symbol'; path: string; symbol: string }

export interface ExploreNode {
  path: string
  /** Exported symbols of this file the walk reached (for slicing). Empty ⇒ all exports. */
  symbols: string[]
  /** Distance from the seed (0 = the seed file). */
  depth: number
}

interface LocalBinding {
  /** The name used in code — the alias, or the imported name when there's no alias. */
  local: string
  /** The exported name in the module — what to follow/slice there (`default`/`*` too). */
  imported: string
  spec: string
}

/**
 * Parse import statements capturing the LOCAL name each binding introduces, mapped
 * to its module + the exported name. The reference walk matches identifiers in a
 * symbol's body against these locals to follow edges (so `import { a as b }` is
 * matched on `b` in the body but followed to `a` in the target).
 */
export function parseImportLocals(source: string): LocalBinding[] {
  const out: LocalBinding[] = []
  const re = /(?:^|\n)\s*import\b([^'"]*?)\bfrom\s*['"]([^'"]+)['"]/g
  for (const m of source.matchAll(re)) {
    const clause = m[1] ?? ''
    const spec = m[2]
    if (!spec) continue
    const ns = clause.match(/\*\s+as\s+(\w+)/)
    if (ns?.[1]) out.push({ local: ns[1], imported: '*', spec })
    const brace = clause.match(/\{([\s\S]*?)\}/)
    if (brace?.[1]) {
      for (const part of brace[1].split(',')) {
        const cleaned = part.trim().replace(/^type\s+/, '')
        if (!cleaned) continue
        const [importedRaw, aliasRaw] = cleaned.split(/\s+as\s+/)
        const imported = importedRaw?.trim()
        const local = (aliasRaw ?? importedRaw)?.trim()
        if (imported && local && /^\w+$/.test(local)) out.push({ local, imported, spec })
      }
    }
    // a leading identifier before the brace is a default import (unless it's `* as`)
    if (!ns) {
      const before = clause.split('{')[0]?.trim() ?? ''
      const def = before.match(/^(\w+)/)
      if (def?.[1]) out.push({ local: def[1], imported: 'default', spec })
    }
  }
  return out
}

/** Resolvable relative-import file targets from a source (one hop, file-level). */
export function relativeImportTargets(
  source: string,
  importerPath: string,
  repoFiles: ReadonlySet<string>,
): string[] {
  const targets = new Set<string>()
  for (const spec of parseImports(source)) {
    const resolved = resolveRelativeImport(spec, importerPath, repoFiles)
    if (resolved && resolved !== importerPath) targets.add(resolved)
  }
  return [...targets]
}

export interface SymbolTarget {
  path: string
  symbol: string
}

/**
 * One-hop reference targets of a symbol: slice the symbol's definition, find the
 * identifiers it uses that came from a relative import, and resolve each to the
 * file + exported name it references.
 */
export function symbolReferenceTargets(
  source: string,
  symbol: string,
  importerPath: string,
  repoFiles: ReadonlySet<string>,
): SymbolTarget[] {
  const body = sliceSource(source, new Set([symbol]))
    .ranges.flatMap((r) => r.lines)
    .join('\n')
  const used = new Set(body.match(/[A-Za-z_$][\w$]*/g) ?? [])
  const targets = new Map<string, SymbolTarget>()
  for (const binding of parseImportLocals(source)) {
    if (!used.has(binding.local)) continue
    const resolved = resolveRelativeImport(binding.spec, importerPath, repoFiles)
    if (!resolved || resolved === importerPath) continue
    targets.set(`${resolved}#${binding.imported}`, { path: resolved, symbol: binding.imported })
  }
  return [...targets.values()]
}

/**
 * Breadth-first walk from the seed, collecting the connected files (and, per file,
 * the symbols the walk reached — for slicing). `readSource` is injected so the walk
 * stays unit-testable; the procedure passes a bounded `readFile`. Capped at
 * `maxFiles` files and `maxDepth` hops.
 */
export async function walkExplore(
  seed: ExploreSeed,
  readSource: (path: string) => Promise<string | undefined>,
  repoFiles: ReadonlySet<string>,
  opts: { maxDepth?: number; maxFiles?: number } = {},
): Promise<ExploreNode[]> {
  const maxDepth = opts.maxDepth ?? MAX_DEPTH
  const maxFiles = opts.maxFiles ?? MAX_FILES
  const result = new Map<string, { symbols: Set<string>; depth: number }>()
  const visited = new Set<string>()
  interface Item {
    path: string
    symbol?: string
    depth: number
  }
  const queue: Item[] =
    seed.kind === 'symbol'
      ? [{ path: seed.path, symbol: seed.symbol, depth: 0 }]
      : [{ path: seed.path, depth: 0 }]

  for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
    const key = item.symbol ? `${item.path}#${item.symbol}` : `file:${item.path}`
    if (visited.has(key)) continue
    visited.add(key)

    const existing = result.get(item.path)
    if (!existing && result.size >= maxFiles) continue // at the file cap — drop new files
    const node = existing ?? { symbols: new Set<string>(), depth: item.depth }
    node.symbols.add(item.symbol ?? '*') // a file node reaches all exports
    node.depth = Math.min(node.depth, item.depth)
    result.set(item.path, node)

    if (item.depth >= maxDepth) continue
    const source = await readSource(item.path)
    if (source === undefined) continue

    const next: Item[] = item.symbol
      ? symbolReferenceTargets(source, item.symbol, item.path, repoFiles).map((t) => ({
          path: t.path,
          symbol: t.symbol,
          depth: item.depth + 1,
        }))
      : relativeImportTargets(source, item.path, repoFiles).map((path) => ({
          path,
          depth: item.depth + 1,
        }))
    for (const t of next) queue.push(t)
  }

  return [...result.entries()].map(([path, n]) => ({
    path,
    symbols: n.symbols.has('*') ? [] : [...n.symbols],
    depth: n.depth,
  }))
}

/**
 * Turn explore nodes into the same `FeatureReading` the inline reading surface
 * renders: every file is `context` (nothing changed), sliced to the symbols the
 * walk reached (empty ⇒ all exports), then flow-ordered by layer. No diff hunks —
 * exploration is read-only.
 */
export function buildExploreReading(
  name: string,
  nodes: readonly ExploreNode[],
  sources: ReadonlyMap<string, string>,
  layers: readonly Layer[],
): FeatureReading {
  const files: ReadingFile[] = nodes.map((node) => {
    const source = sources.get(node.path)
    if (source === undefined) return { path: node.path, source: 'context', ranges: [] }
    const slice = sliceSource(source, new Set(node.symbols))
    return {
      path: node.path,
      source: 'context',
      ranges: slice.ranges,
      truncated: slice.truncated,
      whole: slice.whole,
    }
  })

  const groups: ReadingGroup[] = groupByLayer(files, layers)
  return { name, sections: [], groups, evidence: null }
}
