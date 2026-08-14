import { useTextSearch } from '@renderer/features/search'
import { fileName } from '@renderer/lib/paths'
import { useHubRepoPath } from '@renderer/stores/hub-repo'
import { targetedTab } from '@renderer/stores/hub-tabs'
import { useTabsStore } from '@renderer/stores/tabs'

/** Repo-wide literal search results (git grep); rows open the file at the line. */
export function SearchView({ query }: { query: string }): React.JSX.Element {
  const repoPath = useHubRepoPath()
  const openTab = useTabsStore((s) => s.openTab)
  const { matches, error } = useTextSearch(query)

  if (error) return <p className="p-4 text-sm text-destructive">{error.message}</p>
  if (matches === undefined) {
    return <p className="p-4 text-sm text-muted-foreground">Searching…</p>
  }

  const handleOpen = (path: string, line: number): void => {
    if (repoPath === null) return
    const name = fileName(path)
    openTab(targetedTab('file', `${repoPath}/${path}`, { title: name, line }))
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-2">
      <p className="pb-2 text-xs text-muted-foreground">
        {matches.length} {matches.length === 1 ? 'match' : 'matches'} for{' '}
        <span className="font-mono text-foreground">{query}</span>
      </p>
      {matches.map((match) => (
        <button
          key={`${match.path}:${match.line}`}
          type="button"
          onClick={() => handleOpen(match.path, match.line)}
          className="block w-full truncate rounded-sm px-1 py-0.5 text-left font-mono text-xs hover:bg-accent/50"
        >
          <span className="text-muted-foreground">
            {match.path}:{match.line}
          </span>{' '}
          {match.text.trim()}
        </button>
      ))}
    </div>
  )
}
