import { watch } from 'node:fs'
import { mkdir, stat } from 'node:fs/promises'
import { basename } from 'node:path'
import { PROJECT_FILES, projectEvidenceDir, projectPorcelainDir } from '@shared/project-porcelain'
import { type AppEvent, emitAppEvent } from '../app-events'
import { loadConfig } from '../stores/config-store'

/**
 * Watch each open project's `.porcelain/` directory for agent/app channel writes
 * so the UI live-refreshes. Watches the directory (atomic tmp+rename replaces
 * inodes). Evidence is a tree under `.porcelain/evidence/`.
 *
 * Never create a repo root that does not already exist — mkdir of `.porcelain`
 * is recursive and would materialize e2e "absent" paths (and any stale recent)
 * into real directories, skipping Welcome.
 *
 * Re-syncs watches when recent repos change (openRepoPath updates config).
 */

const watched = new Map<string, { close: () => void }>()

const FILE_EVENTS: Record<string, AppEvent> = {
  [PROJECT_FILES.review]: 'feature-view',
  [PROJECT_FILES.comments]: 'comments',
  [PROJECT_FILES.board]: 'board',
  [PROJECT_FILES.actions]: 'actions',
  [PROJECT_FILES.layers]: 'layers',
  [PROJECT_FILES.scope]: 'scope',
  [PROJECT_FILES.featureView]: 'feature-view',
  [PROJECT_FILES.notes]: 'feature-view',
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
  // Repo root must already exist. Creating `.porcelain` under a missing path
  // would invent the parent directory (recursive mkdir).
  if (!(await isDirectory(repoPath))) return

  const dir = projectPorcelainDir(repoPath)
  // Do not mkdir `.porcelain` here — an empty shell blocks home→repo migrate
  // (ensureProjectCompanion used to treat any existing dir as "already done").
  // Re-invoke after ensure/write once the dir exists.
  if (!(await isDirectory(dir))) return

  const evidenceDir = projectEvidenceDir(repoPath)
  const closers: Array<() => void> = []

  try {
    const w = watch(dir, (_event, filename) => {
      if (!filename) {
        for (const event of new Set(Object.values(FILE_EVENTS))) emitAppEvent(event)
        emitAppEvent('evidence')
        return
      }
      const name = typeof filename === 'string' ? filename : null
      if (!name) return
      const base = basename(name)
      const event = FILE_EVENTS[base]
      if (event) emitAppEvent(event)
      if (base === 'evidence' || name.startsWith('evidence') || name.startsWith('reviews')) {
        emitAppEvent('evidence')
        emitAppEvent('feature-view')
      }
    })
    closers.push(() => w.close())
  } catch {
    // unsupported FS — polls still cover discovery
  }

  // Evidence tree may not exist yet; create under an existing companion only.
  void mkdir(evidenceDir, { recursive: true })
    .then(() => {
      try {
        const w = watch(evidenceDir, () => {
          emitAppEvent('evidence')
        })
        closers.push(() => w.close())
      } catch {
        // unsupported FS
      }
    })
    .catch(() => {})

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
