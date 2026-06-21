import { watch } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import { actionsPath } from './actions-store'
import { type AppEvent, emitAppEvent } from './app-events'
import { boardPath } from './board-store'
import { commentsPath } from './comment-store'
import { layersPath } from './layers-store'
import { reviewSetsPath } from './review-store'

/**
 * Watch the agent channels in `~/.porcelain` — `review-sets.json` (→ `feature-view`),
 * `comments.json` (→ `comments`), `board.json` (→ `board`), `actions.json`
 * (→ `actions`), and `layers.json` (→ `layers`) — and push an app-event when any
 * changes, so an MCP write from the user's coding agent live-refreshes the open view
 * (a pushed review set, a resolved comment, a moved card, a curated action, retuned
 * flow layers). We watch the
 * DIRECTORY, not the file: writes are atomic (tmp + rename), which replaces the inode
 * and breaks a direct file watch. The paths usually share a directory, watched once.
 */
export async function watchAgentChannels(): Promise<void> {
  const targets: { path: string; event: AppEvent }[] = [
    { path: reviewSetsPath(), event: 'feature-view' },
    { path: commentsPath(), event: 'comments' },
    { path: boardPath(), event: 'board' },
    { path: actionsPath(), event: 'actions' },
    { path: layersPath(), event: 'layers' },
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
}
