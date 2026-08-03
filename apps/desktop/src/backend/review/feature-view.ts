import type { EvidenceCheck } from '@shared/evidence-check'
import type { ChangedFile, DiffHunk, FileStatus } from '../git/diff'
import { collectImportedSymbols, type SliceRange, sliceSource } from './feature-slice'
import {
  type FlowGroup,
  groupByLayerOrdered,
  type Layer,
  parseImports,
  resolveImport,
} from './flow'
import type { FileSource, ReviewCanvas, ReviewSection, ReviewSet } from './review-set'

// Resolution order for an extension-less import. Mirrors the resolver in flow.ts
// but checks set membership (O(1)) instead of scanning a list. Used by Explore's
// relative-import walk (and connect edges inside the agent-declared Execution set).
const RESOLVE_EXTS = ['', '.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs']

/**
 * Resolve a RELATIVE import specifier to a real repo file. Only relative specs are
 * resolved: they are unambiguous and cheap. Alias/bare specs (which is how a client
 * reaches a server route — e.g. `@acme/shared/...`) are deliberately not followed;
 * those cross-seam edges are exactly what the import graph can't see, and what the
 * agent-fed review set's `shipped` files exist to supply.
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

interface FeatureFile {
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

interface FeatureGroup {
  layer: string
  files: FeatureFile[]
}

/** Outline entry for one walkthrough section (the full section lives in the reading). */
interface FeatureSectionOutline {
  title: string
  anchorCount: number
}

export interface FeatureView {
  name: string
  /** Always true — the view is agent-curated only; kept until renderer consumers drop it. */
  fromAgent: boolean
  /** One-paragraph markdown thesis shown at the top of the Review. */
  thesis?: string
  /** The walkthrough outline, in section order. */
  sections: FeatureSectionOutline[]
  groups: FeatureGroup[]
}

/**
 * Assemble the Execution outline from the agent-fed review set only. Membership and
 * order are exactly `reviewSet.files` (first occurrence wins on duplicates). Git is
 * consulted only to tag a listed file as `changed` (and attach status/stats) when it
 * is dirty in the working tree — incidental unlisted changes never appear here (they
 * stay on the Changes tab). The caller returns null when no set exists.
 */
export function buildFeatureView(params: {
  name: string
  changed: readonly ChangedFile[]
  reviewSet: ReviewSet
  sources: ReadonlyMap<string, string>
  stats: ReadonlyMap<string, { additions: number; deletions: number }>
  layers: readonly Layer[]
}): FeatureView {
  const changedByPath = new Map(params.changed.map((f) => [f.path, f]))
  const files: FeatureFile[] = []
  const seen = new Set<string>()

  for (const file of params.reviewSet.files) {
    if (seen.has(file.path)) continue
    seen.add(file.path)
    const changedFile = changedByPath.get(file.path)
    const stat = params.stats.get(file.path)
    files.push({
      path: file.path,
      // Git wins on source for listed dirty files; otherwise the agent label (or shipped).
      source: changedFile ? 'changed' : (file.source ?? 'shipped'),
      status: changedFile?.status,
      note: file.note,
      layer: file.layer,
      additions: stat?.additions,
      deletions: stat?.deletions,
      connects: [],
    })
  }

  const unionPaths = files.map((f) => f.path)
  for (const file of files) {
    const source = params.sources.get(file.path)
    if (!source) continue
    const connects = parseImports(source)
      .map((spec) => resolveImport(spec, file.path, unionPaths))
      .filter((p): p is string => p !== null && p !== file.path)
    file.connects = [...new Set(connects)]
  }

  // Agent order + per-file `layer` render verbatim (groupByLayerOrdered). Repo-wide
  // regex layers still group Changes/History via `groupByLayer` in flow.ts.
  const groups = groupByLayerOrdered(files, params.layers)

  return {
    name: params.name,
    fromAgent: true,
    thesis: params.reviewSet.thesis,
    sections: params.reviewSet.sections.map((section) => ({
      title: section.title,
      anchorCount: section.anchors.length,
    })),
    groups,
  }
}

/** One file in the inline reading surface: changed files carry diff hunks, the
 *  rest carry symbol slices (only the lines the in-view files import from them). */
export interface ReadingFile {
  path: string
  source: FileSource
  note?: string
  additions?: number
  deletions?: number
  /** Git status when the surface is a pure diff review (open-file gating). */
  status?: FileStatus
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

/** One walkthrough section of the Review document: prose (+ optional diagram)
 *  followed by the anchored code blocks, one `ReadingFile` per anchor. */
interface ReviewSectionReading {
  title: string
  /** Markdown, rendered via react-markdown with default escaping (no raw HTML). */
  prose: string
  /** Inline SVG — rendered ONLY in the sandboxed `<iframe sandbox="" srcdoc>` path. */
  diagram?: string
  /** Self-contained HTML embed — rendered ONLY in the sandboxed `<iframe sandbox="" srcdoc>` path. */
  html?: string
  /** Pixel height hint for the embed well (default 448 when omitted). */
  htmlHeight?: number
  files: ReadingFile[]
}

export interface FeatureReading {
  name: string
  /** One-paragraph markdown thesis shown at the top of the Review. */
  thesis?: string
  /** The agent-authored walkthrough, in section order. */
  sections: ReviewSectionReading[]
  /** Files not anchored by any section, flow-grouped ("More files"). */
  groups: ReadingGroup[]
  /**
   * Optional freeform Intent body. When set, Feature Intent can render this
   * full-height instead of the structured narrative (outline still uses
   * thesis/sections/files).
   */
  canvas?: ReviewCanvas
  /** Evidence meta when present; full body fetched lazily via loopEvidenceHtml. */
  evidence: {
    title: string
    updatedAt: string
    checks: EvidenceCheck[]
    medium: 'html'
  } | null
}

// A ranged anchor renders at most this many lines — mirrors feature-slice's
// MAX_TOTAL_LINES so one anchor can't dwarf the rest of the document.
const MAX_ANCHOR_LINES = 400

/**
 * Assemble the Review document from an already-built feature view. Changed files
 * carry their working-tree diff hunks (passed in — they're async git reads);
 * context/shipped files carry symbol slices. Anchored files render inside their
 * section (a ranged anchor clamps to the intersecting hunks or one slice) and do
 * not repeat in `groups`; agent-declared files in no section land in `groups`.
 * Built only when a review set is present.
 */
export function buildFeatureReading(params: {
  view: FeatureView
  sections: readonly ReviewSection[]
  sources: ReadonlyMap<string, string>
  diffs: ReadonlyMap<string, DiffHunk[]>
  evidence: FeatureReading['evidence']
  canvas?: FeatureReading['canvas']
}): FeatureReading {
  const unionPaths = params.view.groups.flatMap((g) => g.files.map((f) => f.path))
  const resolve = (spec: string, importer: string): string | null =>
    resolveImport(spec, importer, unionPaths)

  const viewFileByPath = new Map(
    params.view.groups.flatMap((g) => g.files.map((f) => [f.path, f] as const)),
  )

  // The file's normal reading block: hunks for changed files, symbol slices otherwise.
  const readWhole = (file: {
    path: string
    source: FileSource
    note?: string
    additions?: number
    deletions?: number
  }): ReadingFile => {
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
  }

  // A file the agent anchored but never declared: fall back to git truth for the
  // source tag (a diffed file is `changed`; anything else is cross-seam `shipped`).
  const fileFor = (
    path: string,
  ): { path: string; source: FileSource; note?: string; additions?: number; deletions?: number } =>
    viewFileByPath.get(path) ?? { path, source: params.diffs.has(path) ? 'changed' : 'shipped' }

  const readAnchor = (anchor: {
    path: string
    startLine?: number
    endLine?: number
  }): ReadingFile => {
    const file = fileFor(anchor.path)
    if (anchor.startLine === undefined && anchor.endLine === undefined) return readWhole(file)
    const base = {
      path: file.path,
      source: file.source,
      note: file.note,
      additions: file.additions,
      deletions: file.deletions,
    }
    const start = anchor.startLine ?? 1
    if (file.source === 'changed') {
      const hunks = params.diffs.get(file.path) ?? []
      const end = anchor.endLine ?? Number.POSITIVE_INFINITY
      const intersecting = hunks.filter((hunk) =>
        hunk.lines.some((line) => {
          const at = line.newLine ?? line.oldLine
          return at !== null && at >= start && at <= end
        }),
      )
      return { ...base, hunks: intersecting }
    }
    const source = params.sources.get(file.path)
    if (source === undefined) return { ...base, ranges: [] }
    const lines = source.split('\n')
    if (lines.at(-1) === '') lines.pop()
    // Clamp the range to the file, then cap its length so one anchor stays readable.
    const from = Math.min(start, Math.max(lines.length, 1))
    const to = Math.min(anchor.endLine ?? lines.length, lines.length)
    const capped = Math.min(to, from + MAX_ANCHOR_LINES - 1)
    if (capped < from) return { ...base, ranges: [] }
    return {
      ...base,
      ranges: [{ startLine: from, lines: lines.slice(from - 1, capped), gapBefore: from - 1 }],
      truncated: capped < to,
    }
  }

  const anchoredPaths = new Set(
    params.sections.flatMap((section) => section.anchors.map((anchor) => anchor.path)),
  )

  const sections: ReviewSectionReading[] = params.sections.map((section) => ({
    title: section.title,
    prose: section.prose,
    diagram: section.diagram,
    html: section.html,
    htmlHeight: section.htmlHeight,
    files: section.anchors.map(readAnchor),
  }))

  const groups: ReadingGroup[] = params.view.groups
    .map((group) => ({
      layer: group.layer,
      files: group.files.filter((file) => !anchoredPaths.has(file.path)).map(readWhole),
    }))
    .filter((group) => group.files.length > 0)

  return {
    name: params.view.name,
    thesis: params.view.thesis,
    sections,
    groups,
    canvas: params.canvas,
    evidence: params.evidence,
  }
}

/**
 * Build a continuous stacked-diff reading surface from a flow-grouped file list
 * and pre-fetched per-file hunks. Used by the Changes / History "review all"
 * views — pure diffs only (every file is `changed`), same flow order as the list.
 */
export function buildDiffReading(params: {
  name: string
  groups: readonly FlowGroup[]
  diffs: ReadonlyMap<string, DiffHunk[]>
}): FeatureReading {
  return {
    name: params.name,
    sections: [],
    evidence: null,
    groups: params.groups.map((group) => ({
      layer: group.layer,
      files: group.files.map(
        (file): ReadingFile => ({
          path: file.path,
          source: 'changed',
          additions: file.additions,
          deletions: file.deletions,
          status: file.status,
          hunks: params.diffs.get(file.path) ?? [],
        }),
      ),
    })),
  }
}
