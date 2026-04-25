import { Button } from '@renderer/components/ui/button'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'
import { Folder, FolderOpen } from 'lucide-react'

export function Welcome(): React.JSX.Element {
  const openRepo = useRepoStore((s) => s.openRepo)
  const openRepoPath = useRepoStore((s) => s.openRepoPath)
  const { data: recents = [] } = trpc.recentRepos.useQuery()

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">porcelain</h1>
        <p className="mt-1 text-sm text-muted-foreground">viewer · git · agent companion</p>
      </div>
      <Button onClick={openRepo}>
        <FolderOpen />
        Open repository
      </Button>
      {recents.length > 0 && (
        <div className="flex w-72 flex-col gap-1">
          <p className="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Recent
          </p>
          {recents.map((repo) => (
            <Button
              key={repo.path}
              variant="ghost"
              className="justify-start"
              onClick={() => openRepoPath(repo.path)}
            >
              <Folder className="text-muted-foreground" />
              <span className="truncate">{repo.name}</span>
              <span className="ml-auto truncate text-xs text-muted-foreground">{repo.path}</span>
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
