import { watch } from 'node:fs'
import { mkdir, stat } from 'node:fs/promises'
import { basename } from 'node:path'
import type { SessionChange } from '@porcelain/contracts/session'
import {
  PROJECT_FILES,
  projectActiveReviewDir,
  projectEvidenceAssetsDir,
  projectEvidenceDir,
  projectEvidenceResultsDir,
  projectPorcelainDir,
} from '@shared/project-porcelain'
import { publishSessionChange } from '../session/live-session'
import { loadConfig } from '../stores/config-store'

/**
 * Watch each open project's `.porcelain/` directory for agent/app channel writes
 * so the UI live-refreshes. Publishes project-scoped session change facts through
 * the RT-002 publisher (RT-005 activation).
 *
 * Never create a repo root that does not already exist — mkdir of `.porcelain`
 * is recursive and would materialize e2e "absent" paths (and any stale recent)
 * into real directories, skipping Welcome.
 *
 * Re-syncs watches when recent repos change (openRepoPath updates config).
 */

const watched = new Map<string, { close: () => void }>()

/** Map a companion file basename to the domain change kind it makes stale. */
const FILE_CHANGES: Record<string, SessionChange['kind']> = {
  [PROJECT_FILES.review]: 'review.changed',
  [PROJECT_FILES.comments]: 'review.changed',
  [PROJECT_FILES.board]: 'board.changed',
  [PROJECT_FILES.actions]: 'actions.changed',
  [PROJECT_FILES.layers]: 'review.changed',
  [PROJECT_FILES.scope]: 'files.scope-changed',
  [PROJECT_FILES.featureView]: 'review.changed',
  [PROJECT_FILES.notes]: 'review.changed',
}

function publish(kind: SessionChange['kind'], projectPath: string): void {
  if (kind === 'files.tree-changed' || kind === 'files.content-changed') {
    publishSessionChange({ kind, projectPath, paths: [projectPath] })
    return
  }
  publishSessionChange({ kind, projectPath })
}

function publishReview(projectPath: string): void {
  publish('review.changed', projectPath)
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}

async function watchRepo(repoPath: string): Promise<void> {
  if (watched.has(repoPath)) return
  if (!(await isDirectory(repoPath))) return

  const dir = projectPorcelainDir(repoPath)
  if (!(await isDirectory(dir))) return

  const evidenceDir = projectEvidenceDir(repoPath)
  const closers: Array<() => void> = []
  try {
    const active = watch(projectActiveReviewDir(repoPath), (_event, filename) => {
      const base = typeof filename === 'string' ? basename(filename) : null
      const kind = base === null ? undefined : FILE_CHANGES[base]
      if (kind) publish(kind, repoPath)
      publishReview(repoPath)
    })
    closers.push(() => active.close())
  } catch {
    // absent until the first review write — the poll path still discovers it
  }

  try {
    const w = watch(dir, (_event, filename) => {
      if (!filename) {
        for (const kind of new Set(Object.values(FILE_CHANGES))) publish(kind, repoPath)
        publishReview(repoPath)
        return
      }
      const name = typeof filename === 'string' ? filename : null
      if (!name) return
      const base = basename(name)
      const kind = FILE_CHANGES[base]
      if (kind) publish(kind, repoPath)
      if (base === 'evidence' || name.startsWith('evidence') || name.startsWith('reviews')) {
        publishReview(repoPath)
      }
    })
    closers.push(() => w.close())
  } catch {
    // unsupported FS — polls still cover discovery
  }

  for (const dirToWatch of [
    evidenceDir,
    projectEvidenceResultsDir(repoPath),
    projectEvidenceAssetsDir(repoPath),
  ]) {
    void mkdir(dirToWatch, { recursive: true })
      .then(() => {
        try {
          const w = watch(dirToWatch, () => {
            publishReview(repoPath)
          })
          closers.push(() => w.close())
        } catch {
          // unsupported FS
        }
      })
      .catch(() => {})
  }

  watched.set(repoPath, {
    close: () => {
      for (const c of closers) c()
    },
  })
}

export async function watchAgentChannels(): Promise<void> {
  await syncProjectWatches()
}

/** Start watches for recent repos (and any newly opened path). */
export async function syncProjectWatches(extraRepo?: string): Promise<void> {
  const config = await loadConfig()
  const paths = new Set(config.recentRepos)
  if (extraRepo) paths.add(extraRepo)
  await Promise.all([...paths].map((repo) => watchRepo(repo)))
}

export function watchProjectCompanion(repoPath: string): void {
  void watchRepo(repoPath)
}
