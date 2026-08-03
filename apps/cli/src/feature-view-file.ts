import { PROJECT_FILES } from '@shared/project-porcelain'
import { readProjectJson } from './project-io'

// Feature-view snapshot — <repo>/.porcelain/feature-view.json (app writes; CLI reads).

const FILE_SOURCES = new Set(['changed', 'context', 'shipped'])

interface FeatureViewFile {
  path: string
  source: string
  layer: string
}

export interface FeatureViewSnapshot {
  name: string
  files: FeatureViewFile[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseFiles(value: unknown): FeatureViewFile[] {
  if (!Array.isArray(value)) return []
  const files: FeatureViewFile[] = []
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

export function readFeatureView(repoPath: string): FeatureViewSnapshot | null {
  const value = readProjectJson(repoPath, PROJECT_FILES.featureView)
  if (!isRecord(value)) return null
  const files = parseFiles(value.files)
  if (files.length === 0 && (typeof value.name !== 'string' || value.name === '')) return null
  return {
    name: typeof value.name === 'string' ? value.name : 'Feature view',
    files,
  }
}

export function sourceByPath(snapshot: FeatureViewSnapshot | null): Map<string, string> {
  const map = new Map<string, string>()
  for (const file of snapshot?.files ?? []) map.set(file.path, file.source)
  return map
}

export function describeFeatureView(
  repoPath: string,
  snapshot: FeatureViewSnapshot | null,
): string {
  if (!snapshot || snapshot.files.length === 0) {
    return `No feature view computed for ${repoPath} yet (.porcelain/feature-view.json). Open the Feature tab or push a review set.`
  }
  const counts = new Map<string, number>()
  for (const file of snapshot.files) counts.set(file.source, (counts.get(file.source) ?? 0) + 1)
  const breakdown = ['changed', 'context', 'shipped']
    .filter((s) => counts.has(s))
    .map((s) => `${counts.get(s)} ${s}`)
    .join(', ')

  const lines: string[] = []
  let layer: string | null = null
  for (const file of snapshot.files) {
    if (file.layer !== layer) {
      layer = file.layer
      lines.push(layer)
    }
    lines.push(`  - [${file.source}] ${file.path}`)
  }
  return `Feature view "${snapshot.name}" for ${repoPath}: ${snapshot.files.length} file(s) (${breakdown}):\n${lines.join('\n')}`
}
