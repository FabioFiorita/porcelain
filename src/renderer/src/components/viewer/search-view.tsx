import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'
import { useTabsStore } from '@renderer/stores/tabs'

/** Repo-wide literal search results (git grep); rows open the file at the line. */
export function SearchView({ query }: { query: string }): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const openTab = useTabsStore((s) => s.openTab)
  const { data: matches, error } = trpc.searchText.useQuery(
    { repoPath: repo?.path ?? '', query },
    { enabled: repo !== null },
  )

  if (error) return <p className="p-4 text-sm text-destructive">{error.message}</p>
  if (matches === undefined) {
    return <p className="p-4 text-sm text-muted-foreground">Searching…</p>
  }

  const open = (path: string, line: number): void => {
    if (!repo) return
    const name = path.split('/').at(-1) ?? path
    openTab({
      id: `${repo.path}/${path}`,
      kind: 'file',
      title: name,
      path: `${repo.path}/${path}`,
      line,
    })
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
          onClick={() => open(match.path, match.line)}
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
