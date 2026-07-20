import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

// Builtins only — see cli.ts for why this server must stay dependency-free.
// This file owns the agent channel that Porcelain reads (src/main/review-store.ts
// reads the same path); both honour PORCELAIN_REVIEW_SETS so tests and dev can
// redirect it. Default lives in ~/.porcelain (the user's home, NOT a work repo).
// Porcelain re-validates this file with zod on read, so reads here stay lenient.

const FILE_SOURCES = new Set(['changed', 'context', 'shipped'])

export interface ReviewFile {
  path: string
  source?: string
  note?: string
  layer?: string
}

export interface ReviewSectionAnchor {
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

/** Freeform Overview canvas — html or excalidraw scene (mirrors backend review-set). */
export type ReviewCanvas =
  | { medium: 'html'; html: string }
  | { medium: 'excalidraw'; scene: Record<string, unknown> & { elements: unknown[] } }

export interface ReviewSet {
  name: string
  thesis?: string
  files: ReviewFile[]
  sections: ReviewSection[]
  canvas?: ReviewCanvas
}

// Caps mirrored from src/backend/review-set.ts (the zod schema Porcelain re-validates
// with on read) so a too-big write fails HERE with an actionable message instead of
// being silently dropped by the app.
const MAX_SECTIONS = 30
const MAX_TITLE_CHARS = 200
const MAX_PROSE_CHARS = 32_768
const MAX_DIAGRAM_CHARS = 262_144
const MAX_HTML_CHARS = 524_288
const MAX_SCENE_BYTES = 1_048_576
const MIN_HTML_HEIGHT = 160
const MAX_HTML_HEIGHT = 1600
const MAX_ANCHORS = 40

type ReviewSets = Record<string, ReviewSet>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function reviewSetsPath(): string {
  return process.env.PORCELAIN_REVIEW_SETS ?? join(homedir(), '.porcelain', 'review-sets.json')
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

function parseReviewCanvas(value: unknown): ReviewCanvas | undefined {
  if (!isRecord(value) || typeof value.medium !== 'string') return undefined
  if (value.medium === 'html') {
    if (typeof value.html !== 'string' || value.html.length === 0) return undefined
    if (value.html.length > MAX_HTML_CHARS) return undefined
    return { medium: 'html', html: value.html }
  }
  if (value.medium === 'excalidraw') {
    if (!isRecord(value.scene) || !Array.isArray(value.scene.elements)) return undefined
    const bytes = Buffer.byteLength(JSON.stringify(value.scene), 'utf8')
    if (bytes > MAX_SCENE_BYTES) return undefined
    return {
      medium: 'excalidraw',
      scene: value.scene as Record<string, unknown> & { elements: unknown[] },
    }
  }
  return undefined
}

/**
 * Validate + build a canvas payload from CLI flags. Throws with an actionable
 * message (never silently drop).
 */
export function toReviewCanvas(
  medium: string,
  opts: { html?: string; sceneRaw?: string },
): ReviewCanvas {
  if (medium === 'html') {
    if (typeof opts.html !== 'string' || opts.html.length === 0) {
      throw new Error('html medium requires --html or --html-file with non-empty content')
    }
    if (opts.html.length > MAX_HTML_CHARS) {
      throw new Error(`html is ${opts.html.length} chars, over the ${MAX_HTML_CHARS}-char limit`)
    }
    return { medium: 'html', html: opts.html }
  }
  if (medium === 'excalidraw') {
    if (typeof opts.sceneRaw !== 'string' || opts.sceneRaw.trim().length === 0) {
      throw new Error('excalidraw medium requires --file <scene.excalidraw> with non-empty JSON')
    }
    const bytes = Buffer.byteLength(opts.sceneRaw, 'utf8')
    if (bytes > MAX_SCENE_BYTES) {
      throw new Error(`scene is ${bytes} bytes, over the ${MAX_SCENE_BYTES}-byte limit`)
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(opts.sceneRaw)
    } catch {
      throw new Error('scene file is not valid JSON')
    }
    if (!isRecord(parsed) || !Array.isArray(parsed.elements)) {
      throw new Error('scene must be an Excalidraw export object with an elements array')
    }
    return {
      medium: 'excalidraw',
      scene: parsed as Record<string, unknown> & { elements: unknown[] },
    }
  }
  throw new Error('medium must be html or excalidraw')
}

function readAll(): ReviewSets {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(reviewSetsPath(), 'utf8'))
  } catch {
    return {}
  }
  if (!isRecord(parsed)) return {}
  const sets: ReviewSets = {}
  for (const [repoPath, value] of Object.entries(parsed)) {
    if (!isRecord(value)) continue
    const set: ReviewSet = {
      name: typeof value.name === 'string' ? value.name : 'Feature view',
      files: parseReviewFiles(value.files),
      sections: parseReviewSections(value.sections),
    }
    if (typeof value.thesis === 'string') set.thesis = value.thesis
    const canvas = parseReviewCanvas(value.canvas)
    if (canvas) set.canvas = canvas
    sets[repoPath] = set
  }
  return sets
}

function writeAll(sets: ReviewSets): void {
  const path = reviewSetsPath()
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(sets, null, 2))
  renameSync(tmp, path)
}

export function setReview(repoPath: string, set: ReviewSet): void {
  const sets = readAll()
  // Preserve a freeform Overview canvas unless the new set explicitly carries one
  // (set-canvas is the dedicated verb; a plain review set shouldn't wipe it).
  const prev = sets[repoPath]
  sets[repoPath] = {
    ...set,
    canvas: set.canvas ?? prev?.canvas,
  }
  writeAll(sets)
}

/** Merge files into the existing set; name/thesis/sections are whole-set (replaced by `review set`). */
export function addReviewFiles(repoPath: string, files: ReviewFile[]): number {
  const sets = readAll()
  const current = sets[repoPath] ?? { name: 'Feature view', files: [], sections: [] }
  const merged = mergeReviewFiles(current.files, files)
  sets[repoPath] = { ...current, files: merged }
  writeAll(sets)
  return merged.length
}

/** Attach or replace the freeform Overview canvas on an existing (or empty) set. */
export function setReviewCanvas(repoPath: string, canvas: ReviewCanvas): void {
  const sets = readAll()
  const current = sets[repoPath] ?? { name: 'Feature view', files: [], sections: [] }
  sets[repoPath] = { ...current, canvas }
  writeAll(sets)
}

/** Drop the freeform Overview canvas; thesis/sections/files stay. */
export function clearReviewCanvas(repoPath: string): boolean {
  const sets = readAll()
  const current = sets[repoPath]
  if (!current?.canvas) return false
  const { canvas: _drop, ...rest } = current
  sets[repoPath] = rest
  writeAll(sets)
  return true
}

export function clearReview(repoPath: string): void {
  const sets = readAll()
  if (!(repoPath in sets)) return
  delete sets[repoPath]
  writeAll(sets)
}

/** Read back the stored review set for a repo (null when none is set). */
export function readReview(repoPath: string): ReviewSet | null {
  return readAll()[repoPath] ?? null
}

/**
 * Render a repo's stored review set for the read tool: a one-line summary (name,
 * counts, per-source breakdown) followed by the thesis, files, and sections as one
 * JSON object so an agent can verify what it pushed and round-trip an idempotent
 * update (`review set --thesis --files --sections`). The stored source is what the
 * agent declared; Porcelain still auto-detects working-tree files as `changed` when
 * it renders, which the summary calls out.
 */
export function describeReview(repoPath: string, review: ReviewSet | null): string {
  if (!review || (review.files.length === 0 && review.sections.length === 0 && !review.canvas)) {
    return `No feature review set for ${repoPath}. Porcelain shows the no-review empty state until one is pushed. Use \`porcelain review set\` to define one.`
  }
  const counts = new Map<string, number>()
  for (const file of review.files) {
    const key = file.source ?? 'auto-detected'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const breakdown = [...counts.entries()].map(([source, n]) => `${n} ${source}`).join(', ')
  const roundTrip: Record<string, unknown> = { files: review.files, sections: review.sections }
  if (review.thesis !== undefined) roundTrip.thesis = review.thesis
  if (review.canvas !== undefined) roundTrip.canvas = { medium: review.canvas.medium }
  const json = JSON.stringify(roundTrip, null, 2)
  const fileCount = `${review.files.length} file(s)${breakdown ? ` (${breakdown})` : ''}`
  const canvasNote = review.canvas ? `, overview canvas=${review.canvas.medium}` : ''
  return `Feature review "${review.name}" for ${repoPath}: ${fileCount}, ${review.sections.length} section(s), thesis ${review.thesis ? 'set' : 'not set'}${canvasNote}. Working-tree files render as "changed" regardless of declared source.\n${json}`
}
