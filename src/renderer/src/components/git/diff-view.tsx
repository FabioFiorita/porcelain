import { useDiffFile } from '@renderer/hooks/use-diff'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { DiffModeToggle } from './diff-mode-toggle'
import { HunksView } from './hunks-view'

export function DiffView({
  filePath,
  base,
}: {
  filePath: string
  base?: string
}): React.JSX.Element {
  const diffMode = usePreferencesStore((s) => s.diffMode)
  const { hunks, error } = useDiffFile(filePath, base)

  if (error) return <p className="p-4 text-sm text-destructive">{error.message}</p>
  if (hunks === undefined) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-1">
        <span className="truncate font-mono text-xs text-muted-foreground">{filePath}</span>
        <DiffModeToggle />
      </div>
      <div className="min-h-0 flex-1">
        <HunksView hunks={hunks} filePath={filePath} diffMode={diffMode} />
      </div>
    </div>
  )
}
