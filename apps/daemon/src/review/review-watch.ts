import { watch } from 'node:fs'
import { stat } from 'node:fs/promises'
import { basename } from 'node:path'
import type { SessionChange } from '@porcelain/contracts/session'
import { settleBackground } from '@porcelain/shared/background'
import { PROJECT_FILES, projectPorcelainDir } from '@shared/project-porcelain'
import { configuredProjectsRecentsStore } from '../features/projects'
import { publishSessionChange } from '../session/live-session'

type CompanionChangeKind = Extract<
  SessionChange,
  { kind: `files.${string}` | 'review.changed' }
>['kind']
const FILE_CHANGES: Record<string, CompanionChangeKind> = {
  [PROJECT_FILES.comments]: 'review.changed',
  [PROJECT_FILES.reviewed]: 'review.changed',
  [PROJECT_FILES.layers]: 'review.changed',
}
const watched = new Map<string, () => void>()

function publish(kind: CompanionChangeKind, projectPath: string): void {
  if (kind === 'files.tree-changed' || kind === 'files.content-changed') {
    publishSessionChange({ kind, projectPath, paths: ['.'] })
  } else publishSessionChange({ kind, projectPath })
}

async function watchRepo(repoPath: string): Promise<void> {
  if (watched.has(repoPath)) return
  try {
    if (!(await stat(repoPath)).isDirectory()) return
    const dir = projectPorcelainDir(repoPath)
    if (!(await stat(dir)).isDirectory()) return
    const watcher = watch(dir, (_event, filename) => {
      const name = typeof filename === 'string' ? basename(filename) : null
      const kind = name === null ? undefined : FILE_CHANGES[name]
      if (kind) publish(kind, repoPath)
    })
    watched.set(repoPath, () => watcher.close())
  } catch {
    // Polling remains the backstop for missing or unsupported companion roots.
  }
}

export async function watchAgentChannels(): Promise<void> {
  await syncProjectWatches()
}

export async function syncProjectWatches(extraRepo?: string): Promise<void> {
  const recents = await configuredProjectsRecentsStore().readPaths()
  const paths = new Set(recents.ok ? recents.value : [])
  if (extraRepo) paths.add(extraRepo)
  await Promise.all([...paths].map((repo) => watchRepo(repo)))
}

export function watchProjectCompanion(repoPath: string): void {
  settleBackground(watchRepo(repoPath), 'watcher')
}
