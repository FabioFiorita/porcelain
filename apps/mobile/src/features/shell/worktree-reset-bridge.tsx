import { useEffect, useRef } from 'react'

import { useChangesStore } from '@/features/changes/changes-store'
import { useFilesStore } from '@/features/files/files-store'
import { useHistoryStore } from '@/features/history/history-store'
import { useHubRepoPath } from '@/features/projects'
import { useActiveEnvironment } from '@/features/remote'
import { useSearchStore } from '@/features/search/search-store'

/**
 * Drop every per-checkout cursor when the Worktree changes.
 *
 * Three stores hold a position INSIDE a repository — the directory the Files panel is standing
 * in, the diff Changes has open, the commit History is reading — and none of them carries the
 * repository it belongs to. Nothing cleared them on a switch, which had no consequence while
 * those cursors only drove a viewer column nobody could see; the Surfaces panel put them on
 * screen. Switching from a repo you had drilled into `apps/mobile/src` left the next one opening
 * at a path it may not have, with a commit hash from the previous checkout still marked in the
 * list beside it.
 *
 * The stores are imported from their own modules rather than through each feature's index: an
 * index re-exports that feature's components, so reaching one through it drags React Native into
 * a module whose whole job is four `getState()` calls — and into the jsdom suite that tests it.
 *
 * A bridge rather than an effect inside each panel: a panel that is not the active tab is not
 * rendering, so an effect there would fire late — when you next looked at it — and the first
 * frame would be the stale one. Mounted once, at the root, next to the other bridges.
 *
 * The reader's own settings survive: `showHidden`, the Changes scope, the Search query and its
 * recents are about how you work, not about where you are.
 */
export function WorktreeResetBridge(): null {
  const repoPath = useHubRepoPath()
  const environmentId = useActiveEnvironment()?.id ?? null
  const identity = `${environmentId ?? ''}\0${repoPath ?? ''}`
  const seen = useRef(identity)

  useEffect(() => {
    if (seen.current === identity) return
    seen.current = identity
    useFilesStore.getState().reset()
    useChangesStore.getState().reset()
    useHistoryStore.getState().clear()
    // The query is not a place, but the results on screen belong to the repo that answered
    // them; leaving it filled would show the last repo's hits under the new repo's name.
    useSearchStore.getState().setQuery('')
  }, [identity])

  return null
}
