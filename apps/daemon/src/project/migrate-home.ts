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
 * Home keys are purged only after the matching project file is present.
 */

const migratedMarker = '.migrated-from-home'

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

type HomeChannel = (typeof homeChannels)[number]

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
  }
  return out
}

async function writeJson(path: string, value: unknown): Promise<void> {
  const tmp = `${path}.tmp`
  await writeFile(tmp, JSON.stringify(value, null, 2))
  await rename(tmp, path)
}

/** Ensure dest has value (write only if missing). Returns true when dest exists. */
async function ensureFile(path: string, write: () => Promise<void>): Promise<boolean> {
  if (await exists(path)) return true
  await write()
  return exists(path)
}

/**
 * Copy remaining home companion data into `<repo>/.porcelain`. Runs even when the
 * project dir already exists (an empty shell used to block migrate forever).
 * Purges a home key only after its project file is on disk.
 */
export async function ensureProjectCompanion(repoPath: string): Promise<{ migrated: boolean }> {
  const snapshots = Object.fromEntries(
    await Promise.all(homeChannels.map(async (f) => [f, await readHomeRecord(f)] as const)),
  ) as Record<HomeChannel, Record<string, unknown>>

  const hasAny = homeChannels.some((f) => repoPath in snapshots[f])
  const { createHash } = await import('node:crypto')
  const evidenceKey = createHash('sha256').update(repoPath).digest('hex').slice(0, 16)
  const homeEvidence = porcelainHomePath('loop-evidence', evidenceKey)
  const hasEvidence = await exists(homeEvidence)

  if (!hasAny && !hasEvidence) {
    return { migrated: false }
  }

  await mkdir(projectPorcelainDir(repoPath), { recursive: true })
  await ensureFile(projectPorcelainPath(repoPath, PROJECT_FILES.gitignore), async () => {
    await writeFile(
      projectPorcelainPath(repoPath, PROJECT_FILES.gitignore),
      DEFAULT_PROJECT_GITIGNORE,
    )
  })

  const purgeable = new Set<HomeChannel>()
  const homeVal = (file: HomeChannel): unknown => snapshots[file][repoPath]
  const hasHome = (file: HomeChannel): boolean => repoPath in snapshots[file]

  const landJson = async (
    file: HomeChannel,
    projectFile: string,
    value: unknown,
  ): Promise<void> => {
    const path = projectPorcelainPath(repoPath, projectFile)
    if (await ensureFile(path, async () => writeJson(path, value))) purgeable.add(file)
  }

  const landIfPresent = async (file: HomeChannel, projectFile: string): Promise<void> => {
    if (!hasHome(file)) return
    if (await exists(projectPorcelainPath(repoPath, projectFile))) purgeable.add(file)
  }

  const actions = homeVal('actions.json')
  if (Array.isArray(actions)) await landJson('actions.json', PROJECT_FILES.actions, actions)
  else await landIfPresent('actions.json', PROJECT_FILES.actions)

  const board = homeVal('board.json')
  if (Array.isArray(board)) await landJson('board.json', PROJECT_FILES.board, board)
  else await landIfPresent('board.json', PROJECT_FILES.board)

  const layers = homeVal('layers.json')
  if (Array.isArray(layers)) await landJson('layers.json', PROJECT_FILES.layers, layers)
  else await landIfPresent('layers.json', PROJECT_FILES.layers)

  if (hasHome('scope.json')) {
    const parsed = z
      .object({
        hiddenPaths: z.array(z.string()).default([]),
        pinnedPaths: z.array(z.string()).default([]),
      })
      .safeParse(homeVal('scope.json'))
    if (parsed.success) {
      await landJson('scope.json', PROJECT_FILES.scope, {
        hiddenPaths: toRelativePaths(repoPath, parsed.data.hiddenPaths),
        pinnedPaths: toRelativePaths(repoPath, parsed.data.pinnedPaths),
      })
    } else {
      await landIfPresent('scope.json', PROJECT_FILES.scope)
    }
  }

  const notes = homeVal('notes.json')
  if (typeof notes === 'string' && notes !== '') {
    const path = projectPorcelainPath(repoPath, PROJECT_FILES.notes)
    if (await ensureFile(path, async () => writeFile(path, notes))) purgeable.add('notes.json')
  } else {
    await landIfPresent('notes.json', PROJECT_FILES.notes)
  }

  const comments = homeVal('comments.json')
  if (Array.isArray(comments)) await landJson('comments.json', PROJECT_FILES.comments, comments)
  else await landIfPresent('comments.json', PROJECT_FILES.comments)

  const reviewed = homeVal('reviewed.json')
  if (Array.isArray(reviewed)) await landJson('reviewed.json', PROJECT_FILES.reviewed, reviewed)
  else await landIfPresent('reviewed.json', PROJECT_FILES.reviewed)

  if (homeVal('review-sets.json') !== undefined) {
    await landJson('review-sets.json', PROJECT_FILES.review, homeVal('review-sets.json'))
  }

  if (homeVal('feature-view.json') !== undefined) {
    await landJson('feature-view.json', PROJECT_FILES.featureView, homeVal('feature-view.json'))
  }

  if (hasEvidence) {
    const dest = projectPorcelainPath(repoPath, PROJECT_EVIDENCE_DIR)
    if (!(await exists(dest))) {
      await cp(homeEvidence, dest, { recursive: true }).catch(() => {})
    }
    if (await exists(dest)) {
      await rm(homeEvidence, { recursive: true, force: true }).catch(() => {})
    }
  }

  for (const file of purgeable) {
    await purgeHomeKey(file, repoPath)
  }

  if (purgeable.size > 0 || hasEvidence) {
    await writeFile(projectPorcelainPath(repoPath, migratedMarker), new Date().toISOString())
    return { migrated: true }
  }
  return { migrated: false }
}

export async function hasProjectCompanion(repoPath: string): Promise<boolean> {
  return exists(projectPorcelainDir(repoPath))
}
