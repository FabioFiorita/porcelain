import { trpc } from '@renderer/lib/trpc'
import { cn } from '@renderer/lib/utils'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useRepoStore } from '@renderer/stores/repo'
import { useState } from 'react'
import { DiffModeToggle, HunksView } from './diff-view'

function CommitFileDiff({ hash, filePath }: { hash: string; filePath: string }): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const diffMode = usePreferencesStore((s) => s.diffMode)
  const { data: hunks, error } = trpc.gitCommitDiff.useQuery(
    { repoPath: repo?.path ?? '', hash, filePath },
    { enabled: repo !== null },
  )

  if (error) return <p className="p-4 text-sm text-destructive">{error.message}</p>
  if (hunks === undefined) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>

  return <HunksView hunks={hunks} filePath={filePath} diffMode={diffMode} />
}

export function CommitView({ hash }: { hash: string }): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const [selected, setSelected] = useState<string | null>(null)
  const { data: files } = trpc.gitCommitFiles.useQuery(
    { repoPath: repo?.path ?? '', hash },
    { enabled: repo !== null },
  )

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
