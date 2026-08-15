import { watch } from 'node:fs'
import { mkdir, stat } from 'node:fs/promises'
import { basename } from 'node:path'
import type { SessionChange } from '@porcelain/contracts/session'
import { settleBackground } from '@porcelain/shared/background'
import {
  PROJECT_FILES,
  projectActiveReviewDir,
  projectEvidenceAssetsDir,
  projectEvidenceDir,
  projectEvidenceResultsDir,
  projectPorcelainDir,
} from '@shared/project-porcelain'
import { configuredProjectsRecentsStore } from '../features/projects'
import { publishSessionChange } from '../session/live-session'

/**
 * Watch each open project's `.porcelain/` directory for agent/app channel writes
 * so the UI live-refreshes. Publishes project-scoped session change facts through
 * the RT-002 publisher (RT-005 activation).
 *
 * Never create a repo root that does not already exist — mkdir of `.porcelain`
 * is recursive and would materialize e2e "absent" paths (and any stale recent)
 * into real directories, skipping Welcome.
 *
 * Re-syncs watches when recent Projects change (openRepoPath updates the Projects-recents store).
 */

type WatchedRepo = {
  activeReview: boolean
  evidence: boolean
  closers: Array<() => void>
  close: () => void
}

const watched = new Map<string, WatchedRepo>()

/** Map a companion file basename to the domain change kind it makes stale. */
const FILE_CHANGES: Record<string, SessionChange['kind']> = {
  [PROJECT_FILES.review]: 'review.changed',
  [PROJECT_FILES.comments]: 'review.changed',
  [PROJECT_FILES.board]: 'board.changed',
  [PROJECT_FILES.actions]: 'actions.changed',
  [PROJECT_FILES.layers]: 'review.changed',
  [PROJECT_FILES.scope]: 'files.scope-changed',
  [PROJECT_FILES.activeReview]: 'review.changed',
  [PROJECT_FILES.notes]: 'review.changed',
}

function publish(kind: SessionChange['kind'], projectPath: string): void {
  if (kind === 'files.tree-changed' || kind === 'files.content-changed') {
    publishSessionChange({ kind, projectPath, paths: ['.'] })
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

/**
 * The evidence tree, watched only once a review is actually in flight.
 *
 * Watching is a read; `mkdir` is a WRITE into the human's repository. #26 made
 * `.porcelain/` something a human opts into by promoting a Canvas, so a promoted
 * repo that has never run a review must not sprout `active-review/evidence/`
 * merely because it was opened. Attached from `attachActiveReviewWatcher`, which
 * the root watcher re-runs the moment `active-review/` appears — exactly when
 * the tree is wanted.
 */
function attachEvidenceWatchers(repoPath: string, state: WatchedRepo): void {
  if (state.evidence) return
  state.evidence = true
  for (const dirToWatch of [
    projectEvidenceDir(repoPath),
    projectEvidenceResultsDir(repoPath),
    projectEvidenceAssetsDir(repoPath),
  ]) {
    settleBackground(
      mkdir(dirToWatch, { recursive: true }).then(() => {
        try {
          const w = watch(dirToWatch, () => {
            publishReview(repoPath)
          })
          state.closers.push(() => w.close())
        } catch {
          // unsupported FS
        }
      }),
      'watcher',
    )
  }
}

function attachActiveReviewWatcher(repoPath: string, state: WatchedRepo): void {
  if (state.activeReview) return
  try {
    const active = watch(projectActiveReviewDir(repoPath), (_event, filename) => {
      const base = typeof filename === 'string' ? basename(filename) : null
      const kind = base === null ? undefined : FILE_CHANGES[base]
      if (kind) publish(kind, repoPath)
      if (kind !== 'review.changed') publishReview(repoPath)
    })
    state.closers.push(() => active.close())
    state.activeReview = true
    // The active review exists, so its evidence tree is wanted; creating it now
    // is part of a review the human already started, not an unasked-for write.
    attachEvidenceWatchers(repoPath, state)
  } catch {
    // The root watcher retries when active-review is created or another companion event arrives.
  }
}

async function watchRepo(repoPath: string): Promise<void> {
  const existing = watched.get(repoPath)
  if (existing) {
    attachActiveReviewWatcher(repoPath, existing)
    return
  }
  if (!(await isDirectory(repoPath))) return

  const dir = projectPorcelainDir(repoPath)
  if (!(await isDirectory(dir))) return

  const closers: Array<() => void> = []
  const state: WatchedRepo = {
    activeReview: false,
    evidence: false,
    closers,
    close: () => {
      for (const close of closers) close()
    },
  }
  watched.set(repoPath, state)

  try {
    const w = watch(dir, (_event, filename) => {
      attachActiveReviewWatcher(repoPath, state)
      if (!filename) {
        for (const kind of new Set(Object.values(FILE_CHANGES))) publish(kind, repoPath)
        publishReview(repoPath)
        return
      }
      const name = typeof filename === 'string' ? filename : null
      if (!name) return
      const base = basename(name)
      if (base === basename(projectActiveReviewDir(repoPath))) publishReview(repoPath)
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

  attachActiveReviewWatcher(repoPath, state)
}

export async function watchAgentChannels(): Promise<void> {
  await syncProjectWatches()
}

/** Start watches for recent repos (and any newly opened path). */
export async function syncProjectWatches(extraRepo?: string): Promise<void> {
  const recents = await configuredProjectsRecentsStore().readPaths()
  const paths = new Set(recents.ok ? recents.value : [])
  if (extraRepo) paths.add(extraRepo)
  await Promise.all([...paths].map((repo) => watchRepo(repo)))
}

export function watchProjectCompanion(repoPath: string): void {
  // Best-effort registration — keep cleanup/reconnect paths intact; failures stay silent.
  settleBackground(watchRepo(repoPath), 'watcher')
}
