import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

// Builtins only — see protocol.ts for why this server must stay dependency-free.
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

export interface ReviewSet {
  name: string
  files: ReviewFile[]
}

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

/** Merge incoming files into existing, replacing any with a path already present. */
export function mergeReviewFiles(
  existing: readonly ReviewFile[],
  incoming: readonly ReviewFile[],
): ReviewFile[] {
  const byPath = new Map(existing.map((file) => [file.path, file]))
  for (const file of incoming) byPath.set(file.path, file)
  return [...byPath.values()]
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
    sets[repoPath] = {
      name: typeof value.name === 'string' ? value.name : 'Feature view',
      files: parseReviewFiles(value.files),
    }
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

export function setReview(repoPath: string, name: string, files: ReviewFile[]): void {
  const sets = readAll()
  sets[repoPath] = { name, files }
  writeAll(sets)
}

export function addReviewFiles(repoPath: string, files: ReviewFile[]): number {
  const sets = readAll()
  const current = sets[repoPath] ?? { name: 'Feature view', files: [] }
  const merged = mergeReviewFiles(current.files, files)
  sets[repoPath] = { name: current.name, files: merged }
  writeAll(sets)
  return merged.length
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
 * count, per-source breakdown) followed by the files as JSON so an agent can
 * verify what it pushed and round-trip an idempotent update. The stored source is
 * what the agent declared; Porcelain still auto-detects working-tree files as
 * `changed` when it renders, which the summary calls out.
 */
export function describeReview(repoPath: string, review: ReviewSet | null): string {
  if (!review || review.files.length === 0) {
    return `No feature review set for ${repoPath}. Porcelain shows the static baseline (changed files plus the unchanged files they import). Use set_feature_review to define one.`
  }
  const counts = new Map<string, number>()
  for (const file of review.files) {
    const key = file.source ?? 'auto-detected'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const breakdown = [...counts.entries()].map(([source, n]) => `${n} ${source}`).join(', ')
  const json = JSON.stringify(review.files, null, 2)
  return `Feature review "${review.name}" for ${repoPath}: ${review.files.length} file(s) (${breakdown}). Working-tree files render as "changed" regardless of declared source.\n${json}`
}
