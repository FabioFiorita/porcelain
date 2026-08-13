import { PROJECT_FILES } from '@shared/project-porcelain'
import { readProjectJson } from './project-io'

// Active-review snapshot — <repo>/.porcelain/active-review.json (app writes; CLI reads).
// Read by `comments list` to tag each comment with the source of the file it anchors.

const FILE_SOURCES = new Set(['changed', 'context', 'shipped'])

interface ActiveReviewFile {
  path: string
  source: string
  layer: string
}

export interface ActiveReviewSnapshot {
  name: string
  files: ActiveReviewFile[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseFiles(value: unknown): ActiveReviewFile[] {
  if (!Array.isArray(value)) return []
  const files: ActiveReviewFile[] = []
  for (const item of value) {
    if (!isRecord(item)) continue
    if (typeof item.path !== 'string') continue
    if (typeof item.source !== 'string' || !FILE_SOURCES.has(item.source)) continue
    files.push({
      path: item.path,
      source: item.source,
      layer: typeof item.layer === 'string' ? item.layer : 'Other',
    })
  }
  return files
}

export function readActiveReviewSnapshot(repoPath: string): ActiveReviewSnapshot | null {
  const value = readProjectJson(repoPath, PROJECT_FILES.activeReview)
  if (!isRecord(value)) return null
  const files = parseFiles(value.files)
  if (files.length === 0 && (typeof value.name !== 'string' || value.name === '')) return null
  return {
    name: typeof value.name === 'string' ? value.name : 'Active review',
    files,
  }
}

export function sourceByPath(snapshot: ActiveReviewSnapshot | null): Map<string, string> {
  const map = new Map<string, string>()
  for (const file of snapshot?.files ?? []) map.set(file.path, file.source)
  return map
}
