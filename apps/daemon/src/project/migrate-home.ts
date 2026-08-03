import { access, cp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { porcelainHomePath } from '@shared/porcelain-home'
import {
  DEFAULT_PROJECT_GITIGNORE,
  PROJECT_EVIDENCE_DIR,
  PROJECT_FILES,
  projectPorcelainDir,
  projectPorcelainPath,
} from '@shared/project-porcelain'
import { z } from 'zod'

/**
 * One-way home → repo migration for companion channels.
 *
 * After a successful migrate (or when `.porcelain/` already exists), the repo is
 * the only source of truth for that project. Home keys for the repo path are
 * purged. There is no move-back.
 *
 * Machine state (token, remotes, config) stays in PORCELAIN_HOME forever.
 */

const migratedMarker = '.migrated-from-home'

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function readHomeRecord(fileName: string): Promise<Record<string, unknown>> {
  const path = porcelainHomePath(fileName)
  try {
    const raw = JSON.parse(await readFile(path, 'utf8')) as unknown
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}
    return raw as Record<string, unknown>
  } catch {
    return {}
  }
}

async function writeHomeRecord(fileName: string, all: Record<string, unknown>): Promise<void> {
  const path = porcelainHomePath(fileName)
  const tmp = `${path}.tmp`
  await mkdir(join(path, '..'), { recursive: true }).catch(() => {})
  await writeFile(tmp, JSON.stringify(all, null, 2))
  await rename(tmp, path)
}

async function purgeHomeKey(fileName: string, repoPath: string): Promise<void> {
  const all = await readHomeRecord(fileName)
  if (!(repoPath in all)) return
  delete all[repoPath]
  if (Object.keys(all).length === 0) {
    await rm(porcelainHomePath(fileName), { force: true }).catch(() => {})
    return
  }
  await writeHomeRecord(fileName, all)
}

function toRelativePaths(repoPath: string, paths: unknown): string[] {
  if (!Array.isArray(paths)) return []
  const out: string[] = []
  for (const p of paths) {
    if (typeof p !== 'string' || p === '') continue
    if (p === repoPath) continue
    if (p.startsWith(`${repoPath}/`)) out.push(p.slice(repoPath.length + 1))
    else if (!p.startsWith('/')) out.push(p)
    // absolute paths outside the repo are dropped (not shareable)
  }
  return out
}

/**
 * Ensure `<repo>/.porcelain` exists. If it already does, no-op (repo is
 * canonical). Otherwise, if home still has companion data for this absolute
 * path, copy it in, write the default gitignore, and purge home keys.
 *
 * Safe to call on every open / channel access — cheap when already migrated.
 */
export async function ensureProjectCompanion(repoPath: string): Promise<{ migrated: boolean }> {
  const dir = projectPorcelainDir(repoPath)
  if (await exists(dir)) {
    return { migrated: false }
  }

  const homeChannels = [
    'actions.json',
    'board.json',
    'layers.json',
    'scope.json',
    'notes.json',
    'comments.json',
    'reviewed.json',
    'review-sets.json',
    'feature-view.json',
  ] as const

  const snapshots = await Promise.all(
    homeChannels.map(async (f) => [f, await readHomeRecord(f)] as const),
  )
  const hasAny = snapshots.some(([, all]) => repoPath in all)

  // Also check home loop-evidence for this path key.
  const { createHash } = await import('node:crypto')
  const evidenceKey = createHash('sha256').update(repoPath).digest('hex').slice(0, 16)
  const homeEvidence = porcelainHomePath('loop-evidence', evidenceKey)
  const hasEvidence = await exists(homeEvidence)

  if (!hasAny && !hasEvidence) {
    return { migrated: false }
  }

  await mkdir(dir, { recursive: true })
  await writeFile(
    projectPorcelainPath(repoPath, PROJECT_FILES.gitignore),
    DEFAULT_PROJECT_GITIGNORE,
  )

  const actions = snapshots.find(([f]) => f === 'actions.json')?.[1][repoPath]
  if (Array.isArray(actions)) {
    await writeJson(projectPorcelainPath(repoPath, PROJECT_FILES.actions), actions)
  }

  const board = snapshots.find(([f]) => f === 'board.json')?.[1][repoPath]
  if (Array.isArray(board)) {
    await writeJson(projectPorcelainPath(repoPath, PROJECT_FILES.board), board)
  }

  const layers = snapshots.find(([f]) => f === 'layers.json')?.[1][repoPath]
  if (Array.isArray(layers)) {
    await writeJson(projectPorcelainPath(repoPath, PROJECT_FILES.layers), layers)
  }

  const scopeRaw = snapshots.find(([f]) => f === 'scope.json')?.[1][repoPath]
  const scopeParsed = z
    .object({
      hiddenPaths: z.array(z.string()).default([]),
      pinnedPaths: z.array(z.string()).default([]),
    })
    .safeParse(scopeRaw)
  if (scopeParsed.success) {
    await writeJson(projectPorcelainPath(repoPath, PROJECT_FILES.scope), {
      hiddenPaths: toRelativePaths(repoPath, scopeParsed.data.hiddenPaths),
      pinnedPaths: toRelativePaths(repoPath, scopeParsed.data.pinnedPaths),
    })
  }

  const notes = snapshots.find(([f]) => f === 'notes.json')?.[1][repoPath]
  if (typeof notes === 'string' && notes !== '') {
    await writeFile(projectPorcelainPath(repoPath, PROJECT_FILES.notes), notes)
  }

  const comments = snapshots.find(([f]) => f === 'comments.json')?.[1][repoPath]
  if (Array.isArray(comments)) {
    await writeJson(projectPorcelainPath(repoPath, PROJECT_FILES.comments), comments)
  }

  const reviewed = snapshots.find(([f]) => f === 'reviewed.json')?.[1][repoPath]
  if (Array.isArray(reviewed)) {
    await writeJson(projectPorcelainPath(repoPath, PROJECT_FILES.reviewed), reviewed)
  }

  const review = snapshots.find(([f]) => f === 'review-sets.json')?.[1][repoPath]
  if (review !== undefined) {
    await writeJson(projectPorcelainPath(repoPath, PROJECT_FILES.review), review)
  }

  const featureView = snapshots.find(([f]) => f === 'feature-view.json')?.[1][repoPath]
  if (featureView !== undefined) {
    await writeJson(projectPorcelainPath(repoPath, PROJECT_FILES.featureView), featureView)
  }

  if (hasEvidence) {
    const dest = projectPorcelainPath(repoPath, PROJECT_EVIDENCE_DIR)
    await cp(homeEvidence, dest, { recursive: true }).catch(() => {})
    await rm(homeEvidence, { recursive: true, force: true }).catch(() => {})
  }

  // Purge home keys for this repo — one-way.
  for (const file of homeChannels) {
    await purgeHomeKey(file, repoPath)
  }

  await writeFile(projectPorcelainPath(repoPath, migratedMarker), new Date().toISOString())

  return { migrated: true }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  const tmp = `${path}.tmp`
  await writeFile(tmp, JSON.stringify(value, null, 2))
  await rename(tmp, path)
}

/** Whether the repo already has a project companion directory. */
export async function hasProjectCompanion(repoPath: string): Promise<boolean> {
  return exists(projectPorcelainDir(repoPath))
}
