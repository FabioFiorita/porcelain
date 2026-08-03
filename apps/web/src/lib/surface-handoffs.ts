import { reviewTabKey } from '@renderer/components/git/review-view'
import { fileName } from '@renderer/lib/paths'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useRepoStore } from '@renderer/stores/repo'
import { useReviewStartStore } from '@renderer/stores/review-start'
import { tabId, useTabsStore } from '@renderer/stores/tabs'

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

export type OpenFeatureReviewOptions = {
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
    const key = reviewTabKey({ type: 'working' })
    openTab({
      id: tabId('review', key),
      kind: 'review',
      title: 'All changes',
      path: key,
    })
  }
  if (options.path !== undefined && options.path !== '') {
    openDiff(options.path)
  }
}

/** Sidebar → Feature (Review list + inbox). Does not open the canvas tab. */
export function openReviewSidebar(): void {
  usePreferencesStore.getState().setSidebarTab('feature')
}

/** Sidebar → Feature and open the Review canvas for the current repo. */
export function openFeatureReview(options: OpenFeatureReviewOptions = {}): void {
  const repoPath = useRepoStore.getState().repo?.path
  if (repoPath === undefined) return
  if (options.suggestedName !== undefined && options.suggestedName.trim() !== '') {
    useReviewStartStore.getState().setSuggestedName(options.suggestedName.trim())
  }
  openReviewSidebar()
  useTabsStore.getState().openTab({
    id: tabId('feature', repoPath),
    kind: 'feature',
    title: 'Review',
    path: repoPath,
  })
}

/** Open a working-tree diff tab for a repo-relative path. */
export function openDiff(relPath: string): void {
  useTabsStore.getState().openTab({
    id: tabId('diff', relPath),
    kind: 'diff',
    title: fileName(relPath),
    path: relPath,
  })
}

/** Open a file tab (absolute path). Preview by default (single-click semantics). */
export function openFile(absolutePath: string, preview = true): void {
  useTabsStore.getState().openTab({
    id: tabId('file', absolutePath),
    kind: 'file',
    title: fileName(absolutePath),
    path: absolutePath,
    preview,
  })
}
