import { watch } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import { emitAppEvent } from './app-events'
import { reviewSetsPath } from './review-store'

/**
 * Watch the agent channel (`~/.porcelain/review-sets.json`) and push a `feature-view`
 * event when it changes, so an MCP write from the user's coding agent live-refreshes
 * the open feature view. We watch the DIRECTORY, not the file: the MCP server writes
 * atomically (tmp + rename), which replaces the inode and breaks a direct file watch.
 */
export async function watchReviewSets(): Promise<void> {
  const path = reviewSetsPath()
  const dir = dirname(path)
  const file = basename(path)
  await mkdir(dir, { recursive: true }).catch(() => {})
  try {
    watch(dir, (_event, filename) => {
      if (!filename || filename === file) emitAppEvent('feature-view')
    })
  } catch {
    // fs.watch is unsupported on some platforms/filesystems; agent pushes still
    // surface on the feature view's own poll, just not instantly.
  }
}
