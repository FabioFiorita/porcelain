import { watch } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import { actionsPath } from './actions-store'
import { type AppEvent, emitAppEvent } from './app-events'
import { boardPath } from './board-store'
import { chatPath } from './chat-store'
import { commentsPath } from './comment-store'
import { evidencePath, loopEvidenceRoot } from './evidence-store'
import { layersPath } from './layers-store'
import { reviewSetsPath } from './review-store'

/**
 * Watch the agent channels in `~/.porcelain` — `review-sets.json` (→ `feature-view`),
 * `comments.json` (→ `comments`), `board.json` (→ `board`), `actions.json`
 * (→ `actions`), `layers.json` (→ `layers`), `evidence.json` + `loop-evidence/`
 * (→ `evidence`), and `chat.json` (→ `chat`) —
 * and push an app-event when any changes, so an agent write live-refreshes the open
 * view. We watch the DIRECTORY, not the file: writes are atomic (tmp + rename),
 * which replaces the inode and breaks a direct file watch. The paths usually share a
 * directory, watched once. Loop evidence is primarily a **tree** of files under
 * `loop-evidence/<key>/` (index.html + screenshots); that root is watched recursively.
 */
export async function watchAgentChannels(): Promise<void> {
  const targets: { path: string; event: AppEvent }[] = [
    { path: reviewSetsPath(), event: 'feature-view' },
    { path: commentsPath(), event: 'comments' },
    { path: boardPath(), event: 'board' },
    { path: actionsPath(), event: 'actions' },
    { path: layersPath(), event: 'layers' },
    { path: evidencePath(), event: 'evidence' },
    { path: chatPath(), event: 'chat' },
  ]
  const byDir = new Map<string, Map<string, AppEvent>>()
  for (const target of targets) {
    const dir = dirname(target.path)
    const files = byDir.get(dir) ?? new Map<string, AppEvent>()
    files.set(basename(target.path), target.event)
    byDir.set(dir, files)
  }
  for (const [dir, files] of byDir) {
    await mkdir(dir, { recursive: true }).catch(() => {})
    try {
      watch(dir, (_event, filename) => {
        if (!filename) {
          // some platforms don't report the filename — refresh every channel here
          for (const event of new Set(files.values())) emitAppEvent(event)
          return
        }
        const event = files.get(filename)
        if (event) emitAppEvent(event)
      })
    } catch {
      // fs.watch is unsupported on some platforms/filesystems; agent pushes still
      // surface on the views' own polls, just not instantly.
    }
  }

  // Loop-evidence directory tree (agent Write tools drop index.html + screenshots).
  // Recursive watch when available; Feature list also polls every 3s as a backstop.
  const evidenceRoot = loopEvidenceRoot()
  await mkdir(evidenceRoot, { recursive: true }).catch(() => {})
  try {
    watch(evidenceRoot, { recursive: true }, () => {
      emitAppEvent('evidence')
    })
  } catch {
    try {
      watch(evidenceRoot, () => {
        emitAppEvent('evidence')
      })
    } catch {
      // polls still cover discovery
    }
  }
}
