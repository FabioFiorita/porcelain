import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildReviewCanvas,
  emptySectionBody,
  type ReviewSectionId,
  renderReviewFiles,
} from '@shared/review-canvas'
import {
  type CanvasRecord,
  listCanvasesForRepo,
  privateCanvasBundlePath,
  removeCanvas,
  setCanvas,
} from './canvas-file'

// Builtins only — see cli.ts. `review set` writes the Review template as a
// daemon-root Canvas; the low-level helpers below remain for migration reads.

const FILE_SOURCES = new Set(['changed', 'context', 'shipped'])

export interface ReviewFile {
  path: string
  source?: string
  note?: string
  layer?: string
}

interface ReviewSectionAnchor {
  path: string
  startLine?: number
  endLine?: number
}

export interface ReviewSection {
  title: string
  prose: string
  diagram?: string
  html?: string
  htmlHeight?: number
  anchors: ReviewSectionAnchor[]
}

export interface ReviewSet {
  name: string
  thesis?: string
  files: ReviewFile[]
  sections: ReviewSection[]
}

/** The file carried inside a Review Canvas so the daemon can build its typed view. */
const REVIEW_CANVAS_METADATA = 'review.json'

function reviewKind(set: ReviewSet): 'html' | 'markdown' {
  return set.sections.some((section) => section.html !== undefined || section.diagram !== undefined)
    ? 'html'
    : 'markdown'
}

function reviewBodies(set: ReviewSet): {
  kind: 'html' | 'markdown'
  bodies: Readonly<Record<ReviewSectionId, string>>
} {
  const kind = reviewKind(set)
  const html = kind === 'html'
  const intent =
    set.thesis === undefined ? '' : html ? `<p>${escapeHtml(set.thesis)}</p>` : set.thesis
  const process = set.sections
    .map((section) => {
      if (!html) return `### ${section.title}\n\n${section.prose}`
      const parts = [
        `<h3>${escapeHtml(section.title)}</h3>`,
        section.prose === '' ? '' : `<pre>${escapeHtml(section.prose)}</pre>`,
        section.diagram ?? '',
        section.html === undefined ? '' : htmlFragment(section.html),
      ]
      return parts.filter((part) => part !== '').join('\n')
    })
    .join(html ? '\n' : '\n\n')
  return {
    kind,
    bodies: {
      intent: intent === '' ? emptySectionBody(kind) : intent,
      process: process === '' ? emptySectionBody(kind) : process,
      execution: renderReviewFiles(set.files, kind),
      evidence: emptySectionBody(kind),
    },
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function htmlFragment(document: string): string {
  const match = /<body\b[^>]*>([\s\S]*)<\/body>/i.exec(document)
  return (match?.[1] ?? document).trim()
}

function reviewCanvas(repoPath: string): { id?: string; metadata: ReviewSet | null } {
  let record: CanvasRecord | undefined
  try {
    record = listCanvasesForRepo(repoPath).find((canvas) => canvas.template === 'review')
  } catch {
    return { metadata: null }
  }
  if (record === undefined) return { metadata: null }
  try {
    const metadata = JSON.parse(
      readFileSync(
        join(privateCanvasBundlePath(repoPath, record.id), REVIEW_CANVAS_METADATA),
        'utf8',
      ),
    )
    return { id: record.id, metadata: parseReviewSet(metadata) }
  } catch {
    return { id: record.id, metadata: null }
  }
}

// Caps mirrored from apps/daemon/src/review/review-set.ts (the zod schema Porcelain re-validates
// with on read) so a too-big write fails HERE with an actionable message instead of
// being silently dropped by the app.
const MAX_SECTIONS = 30
const MAX_TITLE_CHARS = 200
const MAX_PROSE_CHARS = 32_768
const MAX_DIAGRAM_CHARS = 262_144
const MAX_HTML_CHARS = 524_288
const MIN_HTML_HEIGHT = 160
const MAX_HTML_HEIGHT = 1600
const MAX_ANCHORS = 40

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Coerce arbitrary tool input into validated review files; throws on bad shape. */
export function toReviewFiles(value: unknown): ReviewFile[] {
  if (!Array.isArray(value)) throw new Error('files must be an array')
  return value.map((item, index) => {
    if (!isRecord(item)) throw new Error(`files[${index}] must be an object`)
    const path = item.path
    if (typeof path !== 'string' || path.length === 0) {
      throw new Error(`files[${index}].path must be a non-empty string`)
    }
    const file: ReviewFile = { path }
    if (typeof item.source === 'string') {
      if (!FILE_SOURCES.has(item.source)) {
        throw new Error(`files[${index}].source must be one of changed|context|shipped`)
      }
      file.source = item.source
    }
    if (typeof item.note === 'string') file.note = item.note
    if (typeof item.layer === 'string') file.layer = item.layer
    return file
  })
}

/** Coerce arbitrary tool input into validated walkthrough sections; throws on bad shape. */
export function toReviewSections(value: unknown): ReviewSection[] {
  if (!Array.isArray(value)) throw new Error('sections must be an array')
  if (value.length > MAX_SECTIONS) {
    throw new Error(`sections must have at most ${MAX_SECTIONS} entries (got ${value.length})`)
  }
  return value.map((item, index) => {
    if (!isRecord(item)) throw new Error(`sections[${index}] must be an object`)
    const title = item.title
    if (typeof title !== 'string' || title.length === 0) {
      throw new Error(`sections[${index}].title must be a non-empty string`)
    }
    if (title.length > MAX_TITLE_CHARS) {
      throw new Error(`sections[${index}].title must be at most ${MAX_TITLE_CHARS} characters`)
    }
    const prose = item.prose
    if (typeof prose !== 'string') {
      throw new Error(`sections[${index}].prose must be a string (markdown)`)
    }
    if (prose.length > MAX_PROSE_CHARS) {
      throw new Error(`sections[${index}].prose must be at most ${MAX_PROSE_CHARS} characters`)
    }
    const section: ReviewSection = { title, prose, anchors: toSectionAnchors(item.anchors, index) }
    if (item.diagram !== undefined) {
      if (typeof item.diagram !== 'string') {
        throw new Error(`sections[${index}].diagram must be a string (inline SVG markup)`)
      }
      if (item.diagram.length > MAX_DIAGRAM_CHARS) {
        throw new Error(
          `sections[${index}].diagram must be at most ${MAX_DIAGRAM_CHARS} characters`,
        )
      }
      section.diagram = item.diagram
    }
    if (item.html !== undefined) {
      if (typeof item.html !== 'string') {
        throw new Error(`sections[${index}].html must be a string (self-contained HTML)`)
      }
      if (item.html.length > MAX_HTML_CHARS) {
        throw new Error(`sections[${index}].html must be at most ${MAX_HTML_CHARS} characters`)
      }
      section.html = item.html
    }
    if (item.htmlHeight !== undefined) {
      const height = item.htmlHeight
      if (
        typeof height !== 'number' ||
        !Number.isInteger(height) ||
        height < MIN_HTML_HEIGHT ||
        height > MAX_HTML_HEIGHT
      ) {
        throw new Error(
          `sections[${index}].htmlHeight must be an integer between ${MIN_HTML_HEIGHT} and ${MAX_HTML_HEIGHT}`,
        )
      }
      section.htmlHeight = height
    }
    return section
  })
}

function toSectionAnchors(value: unknown, sectionIndex: number): ReviewSectionAnchor[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new Error(`sections[${sectionIndex}].anchors must be an array`)
  if (value.length > MAX_ANCHORS) {
    throw new Error(
      `sections[${sectionIndex}].anchors must have at most ${MAX_ANCHORS} entries (got ${value.length})`,
    )
  }
  return value.map((item, index) => {
    const label = `sections[${sectionIndex}].anchors[${index}]`
    if (!isRecord(item)) throw new Error(`${label} must be an object`)
    if (typeof item.path !== 'string' || item.path.length === 0) {
      throw new Error(`${label}.path must be a non-empty string`)
    }
    const anchor: ReviewSectionAnchor = { path: item.path }
    for (const key of ['startLine', 'endLine'] as const) {
      const line = item[key]
      if (line === undefined) continue
      if (typeof line !== 'number' || !Number.isInteger(line) || line < 1) {
        throw new Error(`${label}.${key} must be a positive integer (1-based line number)`)
      }
      anchor[key] = line
    }
    return anchor
  })
}

/** Lenient variant for reading our own file back: skip malformed rows, never throw. */
function parseReviewFiles(value: unknown): ReviewFile[] {
  if (!Array.isArray(value)) return []
  const files: ReviewFile[] = []
  for (const item of value) {
    if (!isRecord(item) || typeof item.path !== 'string') continue
    const file: ReviewFile = { path: item.path }
    if (typeof item.source === 'string' && FILE_SOURCES.has(item.source)) file.source = item.source
    if (typeof item.note === 'string') file.note = item.note
    if (typeof item.layer === 'string') file.layer = item.layer
    files.push(file)
  }
  return files
}

/** Lenient section variant for reading our own file back: skip malformed rows, never throw. */
function parseReviewSections(value: unknown): ReviewSection[] {
  if (!Array.isArray(value)) return []
  const sections: ReviewSection[] = []
  for (const item of value) {
    if (!isRecord(item) || typeof item.title !== 'string' || typeof item.prose !== 'string') {
      continue
    }
    const section: ReviewSection = { title: item.title, prose: item.prose, anchors: [] }
    if (typeof item.diagram === 'string') section.diagram = item.diagram
    if (typeof item.html === 'string') section.html = item.html
    if (
      typeof item.htmlHeight === 'number' &&
      Number.isInteger(item.htmlHeight) &&
      item.htmlHeight >= MIN_HTML_HEIGHT &&
      item.htmlHeight <= MAX_HTML_HEIGHT
    ) {
      section.htmlHeight = item.htmlHeight
    }
    if (Array.isArray(item.anchors)) {
      for (const anchor of item.anchors) {
        if (!isRecord(anchor) || typeof anchor.path !== 'string') continue
        const parsed: ReviewSectionAnchor = { path: anchor.path }
        if (typeof anchor.startLine === 'number') parsed.startLine = anchor.startLine
        if (typeof anchor.endLine === 'number') parsed.endLine = anchor.endLine
        section.anchors.push(parsed)
      }
    }
    sections.push(section)
  }
  return sections
}

/** Merge incoming files into existing, replacing any with a path already present. */
export function mergeReviewFiles(
  existing: readonly ReviewFile[],
  incoming: readonly ReviewFile[],
): ReviewFile[] {
  const byPath = new Map(existing.map((file) => [file.path, file]))
  for (const file of incoming) byPath.set(file.path, file)
  return [...byPath.values()]
}

function parseReviewSet(value: unknown): ReviewSet | null {
  if (!isRecord(value)) return null
  if (typeof value.name !== 'string' || value.name === '') return null
  const set: ReviewSet = {
    name: value.name,
    files: parseReviewFiles(value.files),
    sections: parseReviewSections(value.sections),
  }
  if (typeof value.thesis === 'string') set.thesis = value.thesis
  return set
}

/**
 * Write the Review template as the Project-owned Canvas. The temporary source
 * directory is only a CLI staging area; `setCanvas` atomically copies it into
 * `$PORCELAIN_HOME/projects/<id>/canvases/<canvas-id>` and updates the daemon
 * index, so no repo-local active-review lifecycle remains on this path.
 */
export function setReviewCanvas(repoPath: string, set: ReviewSet): void {
  const { kind, bodies } = reviewBodies(set)
  const bundle = buildReviewCanvas({ title: set.name, kind, bodies })
  const sourceDir = mkdtempSync(join(tmpdir(), 'porcelain-review-canvas-'))
  try {
    writeFileSync(join(sourceDir, bundle.entryFile), bundle.entryContent)
    for (const section of bundle.sections) {
      const path = join(sourceDir, section.file)
      mkdirSync(join(sourceDir, 'sections'), { recursive: true })
      writeFileSync(path, section.content)
    }
    writeFileSync(join(sourceDir, REVIEW_CANVAS_METADATA), `${JSON.stringify(set, null, 2)}\n`)
    const existing = listCanvasesForRepo(repoPath).find((canvas) => canvas.template === 'review')
    setCanvas({
      repoPath,
      title: set.name,
      kind,
      sourceDir,
      id: existing?.id,
      template: 'review',
    })
  } finally {
    rmSync(sourceDir, { recursive: true, force: true })
  }
}

/** Remove the private Review Canvas, if one has been published by this CLI. */
export function clearReviewCanvas(repoPath: string): void {
  let existing: CanvasRecord | undefined
  try {
    existing = listCanvasesForRepo(repoPath).find((canvas) => canvas.template === 'review')
  } catch {
    return
  }
  if (existing === undefined) return
  removeCanvas(repoPath, existing.id)
}

/** Merge files into the existing set; name/thesis/sections are whole-set (replaced by `review set`). */
export function addReviewFiles(repoPath: string, files: ReviewFile[]): number {
  const current = readReview(repoPath) ?? { name: 'Active review', files: [], sections: [] }
  const merged = mergeReviewFiles(current.files, files)
  const next = { ...current, files: merged }
  setReviewCanvas(repoPath, next)
  return merged.length
}

/** Read back the stored review set for a repo (null when none is set). */
export function readReview(repoPath: string): ReviewSet | null {
  const canvas = reviewCanvas(repoPath)
  return canvas.metadata
}

/**
 * Render a repo's stored review set for the read tool: a one-line summary (name,
 * counts, per-source breakdown) followed by the thesis, files, and sections as one
 * JSON object so an agent can verify what it pushed and round-trip an idempotent
 * update (`review set --thesis --files --sections`). Execution shows exactly these
 * files in this order; listed paths that are dirty in the working tree render as
 * `changed` regardless of the declared source.
 */
export function describeReview(repoPath: string, review: ReviewSet | null): string {
  // A thesis alone is a real review: the app's `hasIntentContent` counts it, and an
  // Intent-first start has nothing else yet. Reporting it absent hid the whole opening move.
  const empty =
    review !== null &&
    review.files.length === 0 &&
    review.sections.length === 0 &&
    (review.thesis === undefined || review.thesis.trim() === '')
  if (!review || empty) {
    return `No review set for ${repoPath}. Porcelain shows the no-review empty state until one is pushed. Use \`porcelain review set\` to define one.`
  }
  const counts = new Map<string, number>()
  for (const file of review.files) {
    const key = file.source ?? 'auto-detected'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const breakdown = [...counts.entries()].map(([source, n]) => `${n} ${source}`).join(', ')
  const roundTrip: Record<string, unknown> = { files: review.files, sections: review.sections }
  if (review.thesis !== undefined) roundTrip.thesis = review.thesis
  const json = JSON.stringify(roundTrip, null, 2)
  const fileCount = `${review.files.length} file(s)${breakdown ? ` (${breakdown})` : ''}`
  return `Review "${review.name}" for ${repoPath}: ${fileCount}, ${review.sections.length} section(s), thesis ${review.thesis ? 'set' : 'not set'}. Execution shows only these listed files (in this order); listed dirty paths render as "changed".\n${json}`
}
