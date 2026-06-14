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
