import { Stack, useLocalSearchParams } from 'expo-router'

import { DaemonGate } from '@/components/daemon-gate'
import { HeaderToolbar } from '@/components/header-toolbar'
import { useActiveRepo } from '@/lib/daemon/repo'
import { usePreferences } from '@/lib/preferences'
import { EntryList } from './entry-list'
import { absoluteRepoPath, basename, routeSegments } from './file-paths'
import { FilesLoading, FilesQueryState, NoVisibleFiles } from './files-empty-states'
import { useFileEntryActions, useFilesDirectory } from './use-files'

export function DirectoryScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ path?: string | string[] }>()
  const relativePath = routeSegments(params.path).join('/')
  const title = basename(relativePath) || 'Files'

  return (
    <>
      <Stack.Screen options={{ title }} />
      <DaemonGate requires="repo">
        <DirectoryBody relativePath={relativePath} />
      </DaemonGate>
      <HeaderToolbar />
    </>
  )
}

function DirectoryBody({ relativePath }: { relativePath: string }): React.JSX.Element {
  const repo = useActiveRepo()
  const preferences = usePreferences()
  const actions = useFileEntryActions(repo?.path ?? null)
  const path = repo === null ? '' : absoluteRepoPath(repo.path, relativePath)
  const listing = useFilesDirectory(
    repo?.path ?? '',
    path,
    preferences.filesShowHidden,
    repo !== null,
  )

  if (repo === null) return <FilesLoading />
  if (listing.data === undefined) {
    if (listing.error !== null && listing.error !== undefined) {
      return (
        <FilesQueryState
          description="The daemon may have changed this directory while you were browsing."
          error={listing.error}
          onRetry={(): void => {
            listing.refetch()
          }}
          title="Could not read this folder"
        />
      )
    }
    return <FilesLoading />
  }
  if (listing.data.length === 0) return <NoVisibleFiles />

  return <EntryList actions={actions} entries={listing.data} repoPath={repo.path} />
}
