import { ObserveInteractiveMarker } from 'expo-observe'
import { Stack } from 'expo-router'
import { useEffect } from 'react'
import { Platform } from 'react-native'

import { DaemonGate } from '@/components/daemon-gate'
import { IPadDetailPlaceholder } from '@/components/ipad-detail-placeholder'
import { ScreenHeader } from '@/components/screen-header'
import { toolbarIcon } from '@/components/toolbar-icon'
import { useSurfaceFocus } from '@/components/use-surface-focus'
import { useActiveRepo } from '@/lib/daemon/repo'
import { useIPadDestination } from '@/lib/ipad-destination'
import { setPreference, usePreferences } from '@/lib/preferences'
import { EntryList } from './entry-list'
import { FilesLoading, FilesQueryState, NoVisibleFiles } from './files-empty-states'
import { useFileEntryActions, useFilesDirectory, usePinnedFileEntries } from './use-files'

function isIPad(): boolean {
  return 'isPad' in Platform && Platform.isPad
}

/**
 * Files browse face — directory listing with the same header chrome as every other tab root.
 * Search is the re-tap face (`FilesSearchScreen`), not a nav-bar search field.
 * On iPad the listing lives in the SplitView supplementary column.
 */
export function FilesScreen(): React.JSX.Element {
  const preferences = usePreferences()
  useSurfaceFocus('files')
  useEffect(() => {
    if (isIPad()) useIPadDestination.getState().setDestination('files')
  }, [])

  return (
    <>
      {isIPad() ? (
        <IPadDetailPlaceholder
          description="Choose a file from the list to open it."
          title="Select a file"
        />
      ) : (
        <DaemonGate requires="repo">
          <FilesBrowse />
        </DaemonGate>
      )}
      <ScreenHeader title="Files" />
      {/* Same right toolbar as ScreenHeader — Menu merges into the trailing cluster on iOS 26. */}
      {!isIPad() ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Menu accessibilityLabel="Files options" icon={toolbarIcon('more')}>
            <Stack.Toolbar.MenuAction
              icon={preferences.filesShowHidden ? 'eye.slash' : 'eye'}
              isOn={preferences.filesShowHidden}
              onPress={(): void => setPreference('filesShowHidden', !preferences.filesShowHidden)}
            >
              {preferences.filesShowHidden ? 'Hide hidden files' : 'Show hidden files'}
            </Stack.Toolbar.MenuAction>
          </Stack.Toolbar.Menu>
        </Stack.Toolbar>
      ) : null}
      <ObserveInteractiveMarker />
    </>
  )
}

/** The real directory listing used by the root SplitView supplementary column on iPad. */
export function FilesSplitColumn(): React.JSX.Element {
  const repo = useActiveRepo()
  const preferences = usePreferences()
  const actions = useFileEntryActions(repo?.path ?? null)

  return (
    <DaemonGate requires="repo">
      {repo === null ? (
        <FilesLoading />
      ) : (
        <RootListing
          actions={actions}
          repoPath={repo.path}
          showHidden={preferences.filesShowHidden}
        />
      )}
    </DaemonGate>
  )
}

function FilesBrowse(): React.JSX.Element {
  const repo = useActiveRepo()
  const preferences = usePreferences()
  const actions = useFileEntryActions(repo?.path ?? null)

  if (repo === null) return <FilesLoading />

  // EntryList owns ScreenHost + FlatList — do not wrap it in another Host/List or the
  // listing collapses to zero height.
  return (
    <RootListing actions={actions} repoPath={repo.path} showHidden={preferences.filesShowHidden} />
  )
}

function RootListing({
  actions,
  repoPath,
  showHidden,
}: {
  actions: ReturnType<typeof useFileEntryActions>
  repoPath: string
  showHidden: boolean
}): React.JSX.Element {
  const listing = useFilesDirectory(repoPath, repoPath, showHidden, true)
  const pinned = usePinnedFileEntries(repoPath, true)
  const visiblePinned = (pinned.data ?? []).filter((entry) => showHidden || !entry.hidden)

  if (listing.data === undefined) {
    if (listing.error !== null && listing.error !== undefined) {
      return (
        <FilesQueryState
          description="The root listing will update when the daemon is reachable again."
          error={listing.error}
          onRetry={(): void => {
            listing.refetch()
          }}
          title="Could not read this repo"
        />
      )
    }
    return <FilesLoading />
  }
  if (listing.data.length === 0 && visiblePinned.length === 0) return <NoVisibleFiles />

  return (
    <EntryList
      actions={actions}
      entries={listing.data}
      pinnedEntries={visiblePinned}
      repoPath={repoPath}
    />
  )
}
