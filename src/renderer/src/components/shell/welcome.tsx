import { Button } from '@renderer/components/ui/button'
import { useRepoStore } from '@renderer/stores/repo'
import { FolderOpen } from 'lucide-react'

export function Welcome(): React.JSX.Element {
  const openRepo = useRepoStore((s) => s.openRepo)

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
    </div>
  )
}
