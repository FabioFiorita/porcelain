import type { Dirent } from 'node:fs'
import { access, cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import {
  activeReviewPath,
  PROJECT_EVIDENCE_DIR,
  PROJECT_FILES,
  PROJECT_INTENT_DIR,
  projectActiveReviewDir,
  projectArchivedReviewDir,
  projectReviewsDir,
} from '@shared/project-porcelain'
import { z } from 'zod'
import { readReviewSet } from '../../stores/review-store'
import type {
  ArchivedReviewMeta,
  ReviewArchiveStore,
  ReviewPublishCost,
} from './review-lifecycle-capabilities'

/**
 * Filesystem adapter for the Review lifecycle: `.porcelain/active-review/` and
 * `.porcelain/reviews/<id>/`. Every operation-visible behavior lives here, so the
 * operations stay pure orchestration over the port.
 */

const archivedMetaSchema = z.object({
  id: z.string(),
  name: z.string(),
  thesis: z.string().optional(),
  archivedAt: z.string(),
})

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/**
 * An archive id addresses one directory under `.porcelain/reviews/`; anything that
 * could traverse out of it is refused before a write, even though the wire schema
 * already rejects the empty case.
 */
function assertArchiveId(id: string): void {
  if (id.includes('/') || id.includes('..') || id === '') {
    throw new Error('invalid review id')
  }
}

/** Recursive byte + file count for a directory. Missing dir reads as zero. */
async function dirCost(dir: string): Promise<ReviewPublishCost> {
  let bytes = 0
  let files = 0
  const walk = async (current: string): Promise<void> => {
    let entries: Dirent[]
    try {
      entries = await readdir(current, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) {
        await walk(path)
        continue
      }
      try {
        bytes += (await stat(path)).size
        files += 1
      } catch {
        // vanished mid-walk — the estimate is advisory
      }
    }
  }
  await walk(dir)
  return { bytes, files }
}

export function createFsReviewArchiveStore(): ReviewArchiveStore {
  return Object.freeze({
    async archiveActive(repoPath, id, archivedAt) {
      const set = await readReviewSet(repoPath)
      const activeDir = projectActiveReviewDir(repoPath)
      if (!(await pathExists(activeDir))) return null

      const dest = projectArchivedReviewDir(repoPath, id)
      await mkdir(join(dest, '..'), { recursive: true })

      // A directory copy, because the active review is shaped exactly like an
      // archived one — no per-slot list to keep in sync as the shape grows.
      await cp(activeDir, dest, { recursive: true })

      const meta: ArchivedReviewMeta = {
        id,
        name: set?.name ?? 'Untitled review',
        ...(set?.thesis ? { thesis: set.thesis } : {}),
        archivedAt,
      }
      await writeFile(join(dest, 'meta.json'), JSON.stringify(meta, null, 2))

      // The copy already landed; a failure here would leave the review both archived
      // and active, so it must reach the caller instead of settling quietly.
      await rm(activeDir, { recursive: true, force: true })
      return id
    },

    activeCost(repoPath) {
      // One walk: the active review is a single directory now.
      return dirCost(projectActiveReviewDir(repoPath))
    },

    async list(repoPath) {
      const root = projectReviewsDir(repoPath)
      let entries: string[]
      try {
        entries = await readdir(root)
      } catch {
        return []
      }
      const metas: ArchivedReviewMeta[] = []
      for (const id of entries) {
        try {
          const raw = await readFile(join(root, id, 'meta.json'), 'utf8')
          const parsed = archivedMetaSchema.safeParse(JSON.parse(raw))
          if (parsed.success) metas.push(parsed.data)
        } catch {
          // skip corrupt / partial archives
        }
      }
      return metas.sort((a, b) => (a.archivedAt < b.archivedAt ? 1 : -1))
    },

    /**
     * Directory existence, not list visibility: an archive whose `meta.json` is
     * corrupt is skipped by `list` yet still restorable, exactly as before.
     */
    async has(repoPath, id) {
      assertArchiveId(id)
      return pathExists(projectArchivedReviewDir(repoPath, id))
    },

    /**
     * Promote an archive into the active slots and drop the source entry. The
     * destinations are the ACTIVE-review paths, not the companion root: an archive
     * is shaped exactly like `active-review/`, and every reader (`ACTIVE_FILES` /
     * `activeReviewPath`) looks inside that directory — restoring to the flat legacy
     * companion paths landed the files where nothing reads them, so a restored review came
     * back empty. Archiving whatever is currently active belongs to the operation.
     */
    async restore(repoPath, id) {
      assertArchiveId(id)
      const src = projectArchivedReviewDir(repoPath, id)
      if (!(await pathExists(src))) throw new Error(`archived review not found: ${id}`)

      await mkdir(projectActiveReviewDir(repoPath), { recursive: true })

      // Same shape on both sides: the archive's file name is its active name.
      for (const file of [PROJECT_FILES.review, PROJECT_FILES.comments, PROJECT_FILES.reviewed]) {
        const from = join(src, file)
        if (await pathExists(from)) await cp(from, activeReviewPath(repoPath, file))
      }
      for (const dir of [PROJECT_EVIDENCE_DIR, PROJECT_INTENT_DIR]) {
        const from = join(src, dir)
        if (await pathExists(from)) {
          await cp(from, activeReviewPath(repoPath, dir), { recursive: true })
        }
      }

      // Drop the archive entry after promote (it is now active).
      await rm(src, { recursive: true, force: true })
    },

    async remove(repoPath, id) {
      assertArchiveId(id)
      await rm(projectArchivedReviewDir(repoPath, id), { recursive: true, force: true })
    },

    archiveRelativePath(repoPath, id) {
      return relative(repoPath, projectArchivedReviewDir(repoPath, id))
    },
  })
}
