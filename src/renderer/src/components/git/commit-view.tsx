import { useCommitDiff } from '@renderer/hooks/use-diff'
import { useCommitFiles } from '@renderer/hooks/use-history'
import { cn } from '@renderer/lib/utils'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useState } from 'react'
import { DiffModeToggle } from './diff-mode-toggle'
import { HunksView } from './hunks-view'

function CommitFileDiff({ hash, filePath }: { hash: string; filePath: string }): React.JSX.Element {
  const diffMode = usePreferencesStore((s) => s.diffMode)
  const { hunks, error } = useCommitDiff(hash, filePath)

  if (error) return <p className="p-4 text-sm text-destructive">{error.message}</p>
  if (hunks === undefined) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>

  return <HunksView hunks={hunks} filePath={filePath} diffMode={diffMode} />
}

export function CommitView({ hash }: { hash: string }): React.JSX.Element {
  const [selected, setSelected] = useState<string | null>(null)
  const files = useCommitFiles(hash)

  if (files === undefined) {
    return <p className="p-4 text-sm text-muted-foreground">Loading…</p>
  }

  const selectedFile = selected ?? files[0]?.path ?? null

  return (
    <div className="flex h-full min-h-0">
      <div className="w-64 shrink-0 overflow-y-auto border-r">
        <p className="px-3 py-2 font-mono text-xs text-muted-foreground">{hash.slice(0, 12)}</p>
        {files.map((file) => (
          <button
            key={file.path}
            type="button"
            onClick={() => setSelected(file.path)}
            className={cn(
              'block w-full truncate px-3 py-1 text-left text-xs',
              file.path === selectedFile
                ? 'bg-sidebar-accent text-foreground'
                : 'text-muted-foreground hover:bg-sidebar-accent/50',
            )}
          >
            {file.path}
          </button>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b px-3 py-1">
          <span className="truncate font-mono text-xs text-muted-foreground">{selectedFile}</span>
          <DiffModeToggle />
        </div>
        <div className="min-h-0 flex-1">
          {selectedFile ? (
            <CommitFileDiff hash={hash} filePath={selectedFile} />
          ) : (
            <p className="p-4 text-sm text-muted-foreground">Empty commit</p>
          )}
        </div>
      </div>
    </div>
  )
}
