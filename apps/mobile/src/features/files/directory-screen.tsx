import { Stack, useLocalSearchParams } from 'expo-router'

import { DaemonGate } from '@/components/daemon-gate'
import { HeaderToolbar } from '@/components/header-toolbar'
import { useActiveRepo } from '@/lib/daemon/repo'
import { usePreferences } from '@/lib/preferences'
import { absoluteRepoPath, basename, routeSegments } from './file-paths'
import { FileTree } from './file-tree'
import { FilesLoading } from './files-empty-states'

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

/** A folder opened by deep link or from search: the same tree, rooted at that folder. */
function DirectoryBody({ relativePath }: { relativePath: string }): React.JSX.Element {
  const repo = useActiveRepo()
  const preferences = usePreferences()

  if (repo === null) return <FilesLoading />

  return (
    <FileTree
      repoPath={repo.path}
      rootPath={absoluteRepoPath(repo.path, relativePath)}
      showHidden={preferences.filesShowHidden}
    />
  )
}
