import { ContentUnavailableView, Host, ProgressView, Text, VStack } from '@expo/ui/swift-ui'
import { frame, padding } from '@expo/ui/swift-ui/modifiers'
import { daemonErrorMessage } from '@/lib/daemon/errors'
import type { DirEntry } from '@/lib/daemon/procedures/files'
import { useActiveRepo } from '@/lib/daemon/repo'
import { useAccentColor } from '@/theme/colors'
import { secondary } from '@/theme/modifiers'
import { EntryList } from './entry-list'
import { basename, parentRelativePath, repoRelativePath } from './file-paths'
import { useFileEntryActions, useFileSearch } from './use-files'

/** Search hits for the Files Search face. Parent pins the query field above this list. */
export function SearchResults({ query }: { query: string }): React.JSX.Element {
  const repo = useActiveRepo()
  const actions = useFileEntryActions(repo?.path ?? null)
  const results = useFileSearch(repo?.path ?? '', query, repo !== null && query.trim() !== '')
  const accentColor = useAccentColor()

  if (query.trim() === '') {
    return (
      <Host seedColor={accentColor} style={{ flex: 1 }}>
        <Text modifiers={[padding({ horizontal: 20, vertical: 12 }), secondary]}>
          Filename search in this repository. Re-tap Search to return to Files.
        </Text>
      </Host>
    )
  }

  if (repo === null) {
    return (
      <Host seedColor={accentColor} style={{ flex: 1 }}>
        <Text modifiers={[padding({ horizontal: 20, vertical: 12 }), secondary]}>
          Choose a project first.
        </Text>
      </Host>
    )
  }

  if (results.data === undefined) {
    if (results.error !== null && results.error !== undefined) {
      return (
        <Host seedColor={accentColor} style={{ flex: 1 }}>
          <VStack
            alignment="center"
            modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity }), padding({ all: 24 })]}
            spacing={12}
          >
            <ContentUnavailableView
              description={daemonErrorMessage(results.error)}
              systemImage="wifi.exclamationmark"
              title="Could not search files"
            />
            <Text modifiers={[secondary]}>
              Search is filename-only and stays scoped to this repository.
            </Text>
          </VStack>
        </Host>
      )
    }
    return (
      <Host seedColor={accentColor} style={{ flex: 1 }}>
        <VStack
          alignment="center"
          modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity }), padding({ all: 24 })]}
          spacing={12}
        >
          <ProgressView />
          <Text modifiers={[secondary]}>Searching filenames in the repository.</Text>
        </VStack>
      </Host>
    )
  }

  if (results.data.length === 0) {
    return (
      <Host seedColor={accentColor} style={{ flex: 1 }}>
        <ContentUnavailableView
          description="Try a different filename or folder."
          systemImage="magnifyingglass"
          title={`No files match “${query}”`}
        />
      </Host>
    )
  }

  return (
    <EntryList
      actions={actions}
      detailForEntry={(entry: DirEntry): string => searchResultDetail(repo.path, entry.path)}
      embedded
      entries={results.data.map((result) => ({
        hidden: false,
        kind: result.kind,
        name: basename(result.path),
        path: result.path,
        pinned: false,
      }))}
      repoPath={repo.path}
    />
  )
}

function searchResultDetail(repoPath: string, absolutePath: string): string {
  const relative = repoRelativePath(repoPath, absolutePath) ?? absolutePath
  return parentRelativePath(relative) || 'Repository root'
}
