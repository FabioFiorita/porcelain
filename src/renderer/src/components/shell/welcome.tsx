import logo from '@renderer/assets/logo.png'
import { Button } from '@renderer/components/ui/button'
import { useRecentRepos } from '@renderer/hooks/use-repo'
import { useRepoStore } from '@renderer/stores/repo'
import { Folder, FolderOpen } from 'lucide-react'

export function Welcome(): React.JSX.Element {
  const openRepo = useRepoStore((s) => s.openRepo)
  const openRepoPath = useRepoStore((s) => s.openRepoPath)
  const recents = useRecentRepos()

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6">
      <div className="flex flex-col items-center text-center">
        <img src={logo} alt="" className="size-24" draggable={false} />
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">porcelain</h1>
        <p className="mt-1 text-sm text-muted-foreground">Review changes as a story</p>
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
