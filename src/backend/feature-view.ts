import type { ChangedFile, DiffHunk, FileStatus } from './diff'
import { collectImportedSymbols, type SliceRange, sliceSource } from './feature-slice'
import { groupByLayer, groupByLayerOrdered, type Layer, parseImports, resolveImport } from './flow'
import type { FileSource, ReviewSet } from './review-set'

// Resolution order for an extension-less import. Mirrors the resolver in flow.ts
// but checks set membership (O(1)) instead of scanning a list — the baseline walks
// every changed file's imports against the full repo file list on each poll.
const RESOLVE_EXTS = ['', '.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs']

/**
 * Resolve a RELATIVE import specifier to a real repo file. Only relative specs are
 * resolved for the baseline: they are unambiguous and cheap. Alias/bare specs (which
 * is how a client reaches a server route — e.g. `@soaphealth/...`) are deliberately
 * not followed; those cross-seam edges are exactly what the import graph can't see,
 * and what the agent-fed review set exists to supply.
 */
export function resolveRelativeImport(
  spec: string,
  importerPath: string,
  repoFiles: ReadonlySet<string>,
): string | null {
  if (!spec.startsWith('.')) return null
  const dir = importerPath.split('/').slice(0, -1)
  for (const segment of spec.split('/')) {
    if (segment === '.' || segment === '') continue
    if (segment === '..') dir.pop()
    else dir.push(segment)
  }
  const base = dir.join('/')
  if (base === '') return null
  for (const ext of RESOLVE_EXTS) {
    if (repoFiles.has(base + ext)) return base + ext
  }
  for (const ext of RESOLVE_EXTS) {
    if (repoFiles.has(`${base}/index${ext}`)) return `${base}/index${ext}`
  }
  return null
}

/**
 * Walk one hop out from the changed files along their relative imports, collecting
 * unchanged repo files as review context. Bounded by `limit` so a hub file with many
 * imports can't balloon the view.
 */
export function expandContext(
  changedPaths: readonly string[],
  sources: ReadonlyMap<string, string>,
  repoFiles: ReadonlySet<string>,
  limit = 60,
): string[] {
  const changed = new Set(changedPaths)
  const context = new Set<string>()
  for (const importer of changedPaths) {
    const source = sources.get(importer)
    if (!source) continue
    for (const spec of parseImports(source)) {
      const resolved = resolveRelativeImport(spec, importer, repoFiles)
      if (resolved && !changed.has(resolved)) {
        context.add(resolved)
        if (context.size >= limit) return [...context]
      }
    }
  }
  return [...context]
}

export interface FeatureFile {
  path: string
  source: FileSource
  /** Git status, only for `changed` files. */
  status?: FileStatus
  /** A cross-file invariant the reviewer must check, supplied by the agent. */
  note?: string
  /** The agent-declared flow layer for the feature view (overrides the regex match). */
  layer?: string
  additions?: number
  deletions?: number
  /** Other files IN THIS VIEW that this file imports. */
  connects: string[]
}

export interface FeatureGroup {
  layer: string
  files: FeatureFile[]
}

export interface FeatureView {
  name: string
  /** True when an agent-fed review set contributed (cross-seam files + notes). */
  fromAgent: boolean
  groups: FeatureGroup[]
}

/**
 * Assemble the feature view from the change under review, the statically-expanded
 * context, and (optionally) an agent-fed review set. One render path for both:
 * the no-MCP baseline passes `reviewSet: null`; the MCP path overlays declared
 * files and notes. Git status always wins over a declared source — a file in the
 * working tree is `changed`, no matter what the agent labelled it.
 */
export function buildFeatureView(params: {
  name: string
  changed: readonly ChangedFile[]
  contextPaths: readonly string[]
  reviewSet: ReviewSet | null
  sources: ReadonlyMap<string, string>
  stats: ReadonlyMap<string, { additions: number; deletions: number }>
  layers: readonly Layer[]
}): FeatureView {
  const changedByPath = new Map(params.changed.map((f) => [f.path, f]))
  const files = new Map<string, FeatureFile>()

  const add = (
    path: string,
    source: FileSource,
    opts: { explicit?: boolean; note?: string; layer?: string } = {},
  ): void => {
    const existing = files.get(path)
    if (existing) {
      if (opts.note && !existing.note) existing.note = opts.note
      // The agent's layer applies to a changed file too (git owns the source, the
      // agent owns where it sits in the flow), so set it regardless of source.
      if (opts.layer && !existing.layer) existing.layer = opts.layer
      // An explicit (agent-declared) source can promote context→shipped, but
      // nothing overrides a file that git says is changed.
      if (opts.explicit && existing.source !== 'changed') existing.source = source
      return
    }
    const changedFile = changedByPath.get(path)
    const stat = params.stats.get(path)
    files.set(path, {
      path,
      source: changedFile ? 'changed' : source,
      status: changedFile?.status,
      note: opts.note,
      layer: opts.layer,
      additions: stat?.additions,
      deletions: stat?.deletions,
      connects: [],
    })
  }

  for (const file of params.changed) add(file.path, 'changed')
  for (const path of params.contextPaths) add(path, 'context')
  if (params.reviewSet) {
    for (const file of params.reviewSet.files) {
      add(file.path, file.source ?? 'shipped', {
        explicit: true,
        note: file.note,
        layer: file.layer,
      })
    }
  }

  const unionPaths = [...files.keys()]
  for (const file of files.values()) {
    const source = params.sources.get(file.path)
    if (!source) continue
    const connects = parseImports(source)
      .map((spec) => resolveImport(spec, file.path, unionPaths))
      .filter((p): p is string => p !== null && p !== file.path)
    file.connects = [...new Set(connects)]
  }

  // Two grouping paths by design (see the flow-layers skill + Q from the user):
  // the no-MCP baseline keeps the repo-wide regex layers (matching the Changes tab),
  // but once the agent pushes a review set it OWNS the feature view's flow — its
  // declared file order and per-file `layer` render verbatim (groupByLayerOrdered),
  // since the agent built the feature and knows its true shape better than a regex.
  const reviewSet = params.reviewSet
  const groups = reviewSet
    ? groupByLayerOrdered(orderByDeclared([...files.values()], reviewSet), params.layers)
    : groupByLayer([...files.values()], params.layers)

  return { name: params.name, fromAgent: reviewSet !== null, groups }
}

/**
 * Reorder the feature's files into the agent's DECLARED order: files listed in the
 * review set come first in review-set order, the rest (auto-added context, changed
 * files the agent didn't list) keep their original insertion order after. Stable, so
 * `groupByLayerOrdered` can render the agent's flow exactly as pushed.
 */
function orderByDeclared(files: readonly FeatureFile[], reviewSet: ReviewSet): FeatureFile[] {
  const declared = new Map(reviewSet.files.map((file, index) => [file.path, index]))
  return files
    .map((file, index) => ({ file, index }))
    .sort((a, b) => {
      const ad = declared.get(a.file.path)
      const bd = declared.get(b.file.path)
      if (ad !== undefined && bd !== undefined) return ad - bd
      if (ad !== undefined) return -1
      if (bd !== undefined) return 1
      return a.index - b.index // both undeclared — keep insertion order
    })
    .map((entry) => entry.file)
}

/** One file in the inline reading surface: changed files carry diff hunks, the
 *  rest carry symbol slices (only the lines the in-view files import from them). */
export interface ReadingFile {
  path: string
  source: FileSource
  note?: string
  additions?: number
  deletions?: number
  /** Changed files only: the working-tree diff. */
  hunks?: DiffHunk[]
  /** Context/shipped files only: the symbol-sliced ranges. */
  ranges?: SliceRange[]
  /** A slice was capped — more relevant lines exist than shown. */
  truncated?: boolean
  /** Slicing found no specific symbol and fell back to the whole file. */
  whole?: boolean
}

export interface ReadingGroup {
  layer: string
  files: ReadingFile[]
}

export interface FeatureReading {
  name: string
  groups: ReadingGroup[]
}

/**
 * Assemble the inline reading surface from an already-built feature view. Changed
 * files carry their working-tree diff hunks (passed in — they're async git reads);
 * context/shipped files carry symbol slices (only the lines the in-view files
 * import from them, falling back to all exports for cross-seam files no in-view
 * import resolves to). MCP-only: the caller builds this only when a review set is
 * present, so the slice heuristic runs only on the agent's curated, annotated set.
 */
export function buildFeatureReading(params: {
  view: FeatureView
  sources: ReadonlyMap<string, string>
  diffs: ReadonlyMap<string, DiffHunk[]>
}): FeatureReading {
  const unionPaths = params.view.groups.flatMap((g) => g.files.map((f) => f.path))
  const resolve = (spec: string, importer: string): string | null =>
    resolveImport(spec, importer, unionPaths)

  const groups: ReadingGroup[] = params.view.groups.map((group) => ({
    layer: group.layer,
    files: group.files.map((file): ReadingFile => {
      const base = {
        path: file.path,
        source: file.source,
        note: file.note,
        additions: file.additions,
        deletions: file.deletions,
      }
      if (file.source === 'changed') {
        return { ...base, hunks: params.diffs.get(file.path) ?? [] }
      }
      const source = params.sources.get(file.path)
      if (source === undefined) return { ...base, ranges: [] }
      const slice = sliceSource(source, collectImportedSymbols(file.path, params.sources, resolve))
      return { ...base, ranges: slice.ranges, truncated: slice.truncated, whole: slice.whole }
    }),
  }))

  return { name: params.view.name, groups }
}
