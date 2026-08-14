import { changesetTabKey } from '@renderer/components/git/changeset-view'
import { useReviewStartStore } from '@renderer/features/review'
import { fileName } from '@renderer/lib/paths'
import { targetedTab } from '@renderer/stores/hub-tabs'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { useTabsStore } from '@renderer/stores/tabs'

/**
 * Connected-app handoffs: open the *canonical* surface for a concern.
 * Previews (Next strip, Glance, board cards) must call these so destinations
 * never drift into a second Diff panel / commit UX / etc.
 */

export type OpenChangesOptions = {
  /** Repo-relative path to open as a diff tab (and focus Changes). */
  path?: string
  /** Also open the continuous "All changes" reading surface. */
  continuousReview?: boolean
}

export type OpenReviewOptions = {
  /**
   * Prefill the empty-canvas start prompt (Board Doing → Review handoff).
   * Does not publish a Review — agents still run `review set`.
   */
  suggestedName?: string
}

/** Sidebar → Changes; optional continuous review and/or a single-file diff tab. */
export function openChanges(options: OpenChangesOptions = {}): void {
  usePreferencesStore.getState().setSidebarTab('changes')
  const { openTab } = useTabsStore.getState()
  if (options.continuousReview) {
    const key = changesetTabKey({ type: 'working' })
    openTab(targetedTab('changeset', key, { title: 'All changes' }))
  }
  if (options.path !== undefined && options.path !== '') {
    openDiff(options.path)
  }
}

/** Sidebar → Review (Review list + inbox). Does not open the canvas tab. */
export function openReviewSidebar(): void {
  usePreferencesStore.getState().setSidebarTab('review')
}

/** Sidebar → Review and open the Review canvas for the current repo. */
export function openReview(options: OpenReviewOptions = {}): void {
  const repoPath = useProjectSelectionStore.getState().project?.path
  if (repoPath === undefined) return
  if (options.suggestedName !== undefined && options.suggestedName.trim() !== '') {
    useReviewStartStore.getState().setSuggestedName(options.suggestedName.trim())
  }
  openReviewSidebar()
  useTabsStore.getState().openTab(targetedTab('review', repoPath, { title: 'Review' }))
}

/** Open a working-tree diff tab for a repo-relative path. */
export function openDiff(relPath: string): void {
  useTabsStore.getState().openTab(targetedTab('diff', relPath, { title: fileName(relPath) }))
}

/** Open a file tab (absolute path). Preview by default (single-click semantics). */
export function openFile(absolutePath: string, preview = true): void {
  useTabsStore
    .getState()
    .openTab(targetedTab('file', absolutePath, { title: fileName(absolutePath), preview }))
}
