import type { DirEntry } from '@/lib/daemon/procedures/files'
import { useActiveRepo } from '@/lib/daemon/repo'
import { EntryList } from './entry-list'
import { basename, parentRelativePath, repoRelativePath } from './file-paths'
import { FilesLoading, FilesQueryState, NoSearchResults } from './files-empty-states'
import { useFileEntryActions, useFileSearch } from './use-files'

export function SearchResults({ query }: { query: string }): React.JSX.Element {
  const repo = useActiveRepo()
  const actions = useFileEntryActions(repo?.path ?? null)
  const results = useFileSearch(repo?.path ?? '', query, repo !== null)

  if (repo === null) return <FilesLoading />
  if (results.data === undefined) {
    if (results.error !== null && results.error !== undefined) {
      return (
        <FilesQueryState
          description="Search is filename-only and stays scoped to this repository."
          error={results.error}
          onRetry={(): void => {
            results.refetch()
          }}
          title="Could not search files"
        />
      )
    }
    return <FilesLoading description="Searching filenames in the repository." />
  }
  if (results.data.length === 0) return <NoSearchResults query={query} />

  return (
    <EntryList
      actions={actions}
      entries={results.data.map((result) => ({
        hidden: false,
        kind: result.kind,
        name: basename(result.path),
        path: result.path,
        pinned: false,
      }))}
      detailForEntry={(entry: DirEntry): string => searchResultDetail(repo.path, entry.path)}
      repoPath={repo.path}
    />
  )
}

function searchResultDetail(repoPath: string, absolutePath: string): string {
  const relative = repoRelativePath(repoPath, absolutePath) ?? absolutePath
  return parentRelativePath(relative) || 'Repository root'
}
