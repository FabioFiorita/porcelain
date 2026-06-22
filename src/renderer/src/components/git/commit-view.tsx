import { useCommitDiff } from '@renderer/hooks/use-diff'
import { useCommitFlow, useCommitMessage } from '@renderer/hooks/use-history'
import { fileName } from '@renderer/lib/paths'
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
  const { groups } = useCommitFlow(hash)
  const message = useCommitMessage(hash)

  if (groups === undefined) {
    return <p className="p-4 text-sm text-muted-foreground">Loading…</p>
  }

  const allFiles = groups.flatMap((g) => g.files)
  const selectedFile = selected ?? allFiles[0]?.path ?? null

  return (
    <div className="flex h-full min-h-0">
      <div className="w-64 shrink-0 overflow-y-auto border-r">
        <div className="border-b px-3 py-2">
          <p className="whitespace-pre-wrap break-words text-sm-minus text-foreground">
            {message ?? '…'}
          </p>
          <p className="mt-1 font-mono text-xs-minus text-muted-foreground">{hash.slice(0, 12)}</p>
        </div>
        {groups.map((group) => (
          <div key={group.layer}>
            <p className="h-6 px-2 text-2xs uppercase tracking-wider text-muted-foreground/70 flex items-center">
              {group.layer}
            </p>
            {group.files.map((file) => (
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
                {fileName(file.path)}
              </button>
            ))}
          </div>
        ))}
        {allFiles.length === 0 && (
          <p className="px-3 py-2 text-xs text-muted-foreground">No files changed</p>
        )}
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
