import { ACTIVE_FILES } from '@shared/project-porcelain'
import { readProjectJson } from './project-io'

// Reviewed marks — <repo>/.porcelain/reviewed.json (app writes; CLI reads).

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function entryPath(entry: unknown): string | null {
  if (isRecord(entry) && typeof entry.path === 'string') return entry.path
  return null
}

export function readReviewed(repoPath: string): string[] {
  const value = readProjectJson(repoPath, ACTIVE_FILES.reviewed)
  if (!Array.isArray(value)) return []
  return value.map(entryPath).filter((p): p is string => p !== null)
}

export function describeReviewed(repoPath: string, paths: string[]): string {
  if (paths.length === 0) {
    return `No files marked reviewed for ${repoPath} (.porcelain/reviewed.json).`
  }
  const list = paths.map((path) => `- ${path}`).join('\n')
  return `${paths.length} file(s) marked reviewed for ${repoPath}:\n${list}`
}
