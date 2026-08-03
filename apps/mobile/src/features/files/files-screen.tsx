import { List, Section, Toggle } from '@expo/ui/swift-ui'
import { listStyle } from '@expo/ui/swift-ui/modifiers'
import { ObserveInteractiveMarker } from 'expo-observe'

import { DaemonGate } from '@/components/daemon-gate'
import { ScreenHeader } from '@/components/screen-header'
import { ScreenHost } from '@/components/screen-host'
import { useSurfaceFocus } from '@/components/use-surface-focus'
import { useActiveRepo } from '@/lib/daemon/repo'
import { setPreference, usePreferences } from '@/lib/preferences'
import { EntryList } from './entry-list'
import { FilesLoading, FilesQueryState, NoVisibleFiles } from './files-empty-states'
import { useFileEntryActions, useFilesDirectory, usePinnedFileEntries } from './use-files'

/**
 * Files browse face — directory listing with the same header chrome as every other tab root.
 * Search is the re-tap face (`FilesSearchScreen`), not a nav-bar search field (which fought
 * our title + workspace header for vertical space).
 */
export function FilesScreen(): React.JSX.Element {
  useSurfaceFocus('files')

  return (
    <>
      <DaemonGate requires="repo">
        <FilesBrowse />
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

function FilesBrowse(): React.JSX.Element {
  const repo = useActiveRepo()
  const preferences = usePreferences()
  const actions = useFileEntryActions(repo?.path ?? null)

  if (repo === null) return <FilesLoading />

  return (
    <ScreenHost>
      <RootListing
        actions={actions}
        repoPath={repo.path}
        showHidden={preferences.filesShowHidden}
      />
      <List modifiers={[listStyle('insetGrouped')]}>
        <Section>
          <Toggle
            isOn={preferences.filesShowHidden}
            label="Show hidden files"
            onIsOnChange={(value: boolean): void => {
              setPreference('filesShowHidden', value)
            }}
          />
        </Section>
      </List>
    </ScreenHost>
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
