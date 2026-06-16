import type { ChangedFile } from './diff'

export interface Layer {
  label: string
  pattern: string
}

/**
 * Default review-flow layers, ordered entry-point → database. A changed file
 * belongs to the first layer whose pattern matches its path.
 */
export const DEFAULT_LAYERS: Layer[] = [
  { label: 'Pages', pattern: '(^|/)(pages|views|screens|app)/' },
  { label: 'Components', pattern: '(^|/)components?/' },
  { label: 'Hooks', pattern: '(^|/)hooks?/' },
  { label: 'Queries', pattern: '(^|/)(queries|mutations|api-client|client)/' },
  { label: 'Routes', pattern: '(^|/)(routes?|router|api)/' },
  { label: 'Controllers', pattern: '(^|/)controllers?/' },
  { label: 'Services', pattern: '(^|/)services?/' },
  { label: 'Modules', pattern: '(^|/)modules?/' },
  { label: 'Data', pattern: '(^|/)(prisma|schema|models?|entities|repositories)/' },
  { label: 'Tests', pattern: '\\.(test|spec)\\.[a-z]+$' },
]

export const OTHER_LABEL = 'Other'

interface CompiledLayer {
  label: string
  re: RegExp
}

/** Compile a layer set's patterns once (reuse across many `layerForCompiled` calls). */
export function compileLayers(layers: readonly Layer[]): CompiledLayer[] {
  return layers.map((layer) => ({ label: layer.label, re: new RegExp(layer.pattern, 'g') }))
}

function layerForCompiled(path: string, compiled: readonly CompiledLayer[]): string {
  let best: { label: string; index: number } | null = null
  for (const { label, re } of compiled) {
    re.lastIndex = 0 // `g` regexes are stateful — reset before each path scan
    let last: RegExpExecArray | null = null
    for (let m = re.exec(path); m !== null; m = re.exec(path)) last = m
    if (last && (best === null || last.index > best.index)) {
      best = { label, index: last.index }
    }
  }
  return best?.label ?? OTHER_LABEL
}

export function layerFor(path: string, layers: readonly Layer[]): string {
  // The deepest (right-most) matching segment wins: apps/api/controllers/x.ts
  // is a controller, not a route, even though api/ also matches. Filename
  // patterns (e.g. \.spec\. or \.stories\.) match right of any directory, so
  // they win over the directory the file sits in.
  return layerForCompiled(path, compileLayers(layers))
}

/**
 * Group files into flow layers: bucket by the deepest-matching layer, then emit
 * groups in declared layer order (with `Other` last), each file list sorted by
 * path. The ONE grouping implementation — shared by buildFlow, buildFeatureView,
 * and buildExploreReading.
 */
export function groupByLayer<T extends { path: string }>(
  items: readonly T[],
  layers: readonly Layer[],
): { layer: string; files: T[] }[] {
  const compiled = compileLayers(layers) // compile once for the whole batch
  const order = [...layers.map((l) => l.label), OTHER_LABEL]
  const byLayer = new Map<string, T[]>()
  for (const item of items) {
    const layer = layerForCompiled(item.path, compiled)
    const group = byLayer.get(layer) ?? []
    group.push(item)
    byLayer.set(layer, group)
  }
  return order
    .filter((layer) => byLayer.has(layer))
    .map((layer) => ({
      layer,
      files: (byLayer.get(layer) ?? []).sort((a, b) => a.path.localeCompare(b.path)),
    }))
}

export interface FlowFile extends ChangedFile {
  /** Relative paths of other changed files this file imports. */
  connects: string[]
  additions?: number
  deletions?: number
}

export interface FlowGroup {
  layer: string
  files: FlowFile[]
}

/** Extract import/require specifiers from source text. */
export function parseImports(source: string): string[] {
  const specs = new Set<string>()
  const patterns = [
    /(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  for (const re of patterns) {
    for (const match of source.matchAll(re)) {
      const spec = match[1]
      if (spec) specs.add(spec)
    }
  }
  return [...specs]
}

const stripExt = (p: string): string => p.replace(/\.(tsx?|jsx?|mts|cts|mjs|cjs)$/, '')

/**
 * Resolve an import specifier against the set of changed files.
 * Relative specs resolve against the importer's directory; aliased/absolute
 * specs match any changed file whose extension-less path ends with the spec's
 * trailing segments (heuristic — good enough to connect a feature's files).
 */
export function resolveImport(
  spec: string,
  importerPath: string,
  changedPaths: readonly string[],
): string | null {
  let candidate: string
  if (spec.startsWith('.')) {
    const dir = importerPath.split('/').slice(0, -1)
    for (const segment of spec.split('/')) {
      if (segment === '.' || segment === '') continue
      if (segment === '..') dir.pop()
      else dir.push(segment)
    }
    candidate = dir.join('/')
  } else {
    candidate = spec.replace(/^@[^/]+\//, '')
  }
  if (candidate === '') return null

  return (
    changedPaths.find((p) => {
      const base = stripExt(p)
      return (
        base === candidate ||
        base.endsWith(`/${candidate}`) ||
        base === `${candidate}/index` ||
        base.endsWith(`/${candidate}/index`)
      )
    }) ?? null
  )
}

export function buildFlow(
  files: readonly ChangedFile[],
  sources: ReadonlyMap<string, string>,
  layers: readonly Layer[],
): FlowGroup[] {
  const paths = files.map((f) => f.path)
  const flowFiles: FlowFile[] = files.map((file) => {
    const source = sources.get(file.path)
    const connects = source
      ? parseImports(source)
          .map((spec) => resolveImport(spec, file.path, paths))
          .filter((p): p is string => p !== null && p !== file.path)
      : []
    return { ...file, connects: [...new Set(connects)] }
  })

  return groupByLayer(flowFiles, layers)
}
