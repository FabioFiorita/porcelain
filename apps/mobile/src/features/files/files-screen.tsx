import { ObserveInteractiveMarker } from 'expo-observe'
import { Stack } from 'expo-router'
import { useState } from 'react'

import { DaemonGate } from '@/components/daemon-gate'
import { ScreenHeader } from '@/components/screen-header'
import { toolbarIcon } from '@/components/toolbar-icon'
import { useSurfaceFocus } from '@/components/use-surface-focus'
import { useActiveRepo } from '@/lib/daemon/repo'
import { setPreference, usePreferences } from '@/lib/preferences'
import { EntryList } from './entry-list'
import { FilesLoading, FilesQueryState, NoVisibleFiles } from './files-empty-states'
import { SearchResults } from './search-results'
import {
  useDebouncedFileQuery,
  useFileEntryActions,
  useFilesDirectory,
  usePinnedFileEntries,
} from './use-files'

export function FilesScreen(): React.JSX.Element {
  const [searchText, setSearchText] = useState('')
  const debouncedQuery = useDebouncedFileQuery(searchText)
  useSurfaceFocus('files')

  return (
    <>
      <DaemonGate requires="repo">
        <FilesRoot
          debouncedQuery={debouncedQuery}
          onCancelSearch={(): void => setSearchText('')}
          onSearchChange={setSearchText}
        />
      </DaemonGate>
      <ScreenHeader title="Files" />
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

function FilesRoot({
  debouncedQuery,
  onCancelSearch,
  onSearchChange,
}: {
  debouncedQuery: string
  onCancelSearch: () => void
  onSearchChange: (value: string) => void
}): React.JSX.Element {
  const repo = useActiveRepo()
  const preferences = usePreferences()
  const actions = useFileEntryActions(repo?.path ?? null)

  if (repo === null) return <FilesLoading />

  return (
    <>
      <Stack.SearchBar
        onCancelButtonPress={onCancelSearch}
        onChangeText={(event: { nativeEvent: { text: string } }): void =>
          onSearchChange(event.nativeEvent.text)
        }
        placeholder="Search files"
      />
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
      {debouncedQuery.trim() === '' ? (
        <RootListing
          actions={actions}
          repoPath={repo.path}
          showHidden={preferences.filesShowHidden}
        />
      ) : (
        <SearchResults query={debouncedQuery} />
      )}
    </>
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
