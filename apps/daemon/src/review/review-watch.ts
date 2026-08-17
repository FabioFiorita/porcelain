import { watch } from 'node:fs'
import { stat } from 'node:fs/promises'
import { basename } from 'node:path'
import type { SessionChange } from '@porcelain/contracts/session'
import { settleBackground } from '@porcelain/shared/background'
import { projectActiveReviewDir } from '@shared/project-porcelain'
import { publishSessionChange } from '../session/live-session'

type ReviewCompanionKind = Extract<SessionChange, { kind: 'review.changed' }>['kind']

const FILE_CHANGES: Record<string, ReviewCompanionKind> = {
  'comments.json': 'review.changed',
  'reviewed.json': 'review.changed',
}

const watched = new Map<string, () => void>()

function publish(kind: ReviewCompanionKind, projectPath: string): void {
  publishSessionChange({ kind, projectPath })
}

async function watchRepo(repoPath: string): Promise<void> {
  if (watched.has(repoPath)) return
  try {
    const dir = projectActiveReviewDir(repoPath)
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

export function watchProjectCompanion(repoPath: string): void {
  settleBackground(watchRepo(repoPath), 'watcher')
}
