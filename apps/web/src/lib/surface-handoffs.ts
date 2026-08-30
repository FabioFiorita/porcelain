import { changesetTabKey } from '@renderer/components/git/changeset-tab-key'
import { fileName } from '@renderer/lib/paths'
import { activeTabTarget, targetedTab } from '@renderer/stores/hub-tabs'
import { usePreferencesStore } from '@renderer/stores/preferences'
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

/** Sidebar → Changes; optional continuous review and/or a single-file diff tab. */
export function openChanges(options: OpenChangesOptions = {}): void {
  usePreferencesStore.getState().setSidebarTab('changes')
  const { openTab } = useTabsStore.getState()
  if (options.continuousReview) {
    const key = changesetTabKey({ type: 'working' })
    openTab(targetedTab('changeset', key, { title: 'All changes' }, activeTabTarget()))
  }
  if (options.path !== undefined && options.path !== '') {
    openDiff(options.path)
  }
}

/** Open a working-tree diff tab for a repo-relative path. */
export function openDiff(relPath: string): void {
  useTabsStore
    .getState()
    .openTab(targetedTab('diff', relPath, { title: fileName(relPath) }, activeTabTarget()))
}

/** Open a file tab (absolute path). Preview by default (single-click semantics). */
export function openFile(absolutePath: string, preview = true): void {
  useTabsStore
    .getState()
    .openTab(
      targetedTab(
        'file',
        absolutePath,
        { title: fileName(absolutePath), preview },
        activeTabTarget(),
      ),
    )
}
