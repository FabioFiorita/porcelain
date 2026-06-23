import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

// Builtins only — see protocol.ts. The feature-view SNAPSHOT channel: Porcelain's
// COMPUTED feature view (every file it renders, each tagged with its git-truth source
// and flow layer), READ-ONLY here. ONE-WAY, app→agent — the app computes the view and
// writes it (src/main/feature-snapshot-store.ts); the agent reads it to see the whole
// feature (not just the git diff) and to learn which files are actually `changed`
// (diffed) vs `context`/`shipped`. Like the reviewed/notes channels the app is the SOLE
// writer, so there is no write tool. Lenient parse of our own file: skip malformed rows.

const FILE_SOURCES = new Set(['changed', 'context', 'shipped'])

export interface FeatureViewFile {
  path: string
  source: string
  layer: string
}

export interface FeatureViewSnapshot {
  name: string
  files: FeatureViewFile[]
}

type Snapshots = Record<string, FeatureViewSnapshot>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function featureViewPath(): string {
  return process.env.PORCELAIN_FEATURE_VIEW ?? join(homedir(), '.porcelain', 'feature-view.json')
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

function readAll(): Snapshots {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(featureViewPath(), 'utf8'))
  } catch {
    return {}
  }
  if (!isRecord(parsed)) return {}
  const all: Snapshots = {}
  for (const [repoPath, value] of Object.entries(parsed)) {
    if (!isRecord(value)) continue
    all[repoPath] = {
      name: typeof value.name === 'string' ? value.name : 'Feature view',
      files: parseFiles(value.files),
    }
  }
  return all
}

/** Porcelain's last-computed feature view for a repo (null when none / file absent). */
export function readFeatureView(repoPath: string): FeatureViewSnapshot | null {
  return readAll()[repoPath] ?? null
}

/** Map a repo's feature files to their source, for tagging review comments by status. */
export function sourceByPath(snapshot: FeatureViewSnapshot | null): Map<string, string> {
  const map = new Map<string, string>()
  for (const file of snapshot?.files ?? []) map.set(file.path, file.source)
  return map
}

/**
 * Render the snapshot for `get_feature_view`: a one-line summary (count + per-source
 * breakdown, spelling out that `changed` means in the git diff) then the files grouped
 * in flow order. This is what Porcelain MADE of the feature after folding the agent's
 * pushed set into git status and the import baseline — the complement to
 * get_feature_review (which echoes what the agent declared).
 */
export function describeFeatureView(
  repoPath: string,
  snapshot: FeatureViewSnapshot | null,
): string {
  if (!snapshot || snapshot.files.length === 0) {
    return `No feature view computed for ${repoPath} yet. Open the Feature tab in Porcelain (or push a review set with set_feature_review); Porcelain then renders the feature and this snapshot reports every file with its source (changed = in the git diff, context/shipped = the unchanged rest of the feature) and flow layer.`
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
  return `Feature view "${snapshot.name}" for ${repoPath}: ${snapshot.files.length} file(s) (${breakdown}). "changed" files are in the git diff; "context"/"shipped" are not (the unchanged or cross-seam rest of the feature). In flow order:\n${lines.join('\n')}`
}
