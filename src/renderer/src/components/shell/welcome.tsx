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
    <div className="flex h-full flex-col items-center justify-center gap-8 px-6">
      <div className="flex flex-col items-center text-center">
        {/* Same fired-tile treatment as the empty viewer: the mark rests on the
            void with a soft squircle shadow, so first run and blank tabs match. */}
        <img
          src={logo}
          alt=""
          draggable={false}
          className="size-20 [filter:drop-shadow(0_14px_30px_rgb(0_0_0/0.5))]"
        />
        <h1 className="mt-4 text-3xl font-medium tracking-tight">porcelain</h1>
        <p className="mt-1 text-sm text-muted-foreground">Review changes as a story</p>
      </div>
      <Button onClick={openRepo}>
        <FolderOpen />
        Open repository
      </Button>
      {recents.length > 0 && (
        <div className="flex w-80 flex-col gap-0.5">
          <p className="px-2 pb-1 text-2xs font-medium uppercase tracking-wider text-muted-foreground">
            Recent
          </p>
          {recents.map((repo) => (
            <Button
              key={repo.path}
              variant="ghost"
              className="h-auto justify-start gap-2.5 py-1.5"
              onClick={() => openRepoPath(repo.path)}
            >
              <Folder className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex min-w-0 flex-col items-start">
                <span className="truncate text-sm">{repo.name}</span>
                <span className="max-w-full truncate text-xs text-muted-foreground" dir="rtl">
                  {repo.path}
                </span>
              </span>
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
