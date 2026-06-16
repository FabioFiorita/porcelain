import { useReadFile, useRefreshTree } from '@renderer/hooks/use-files'
import { useEffect } from 'react'
import { TextFileView } from './text-file-view'

export function FileContent({ path, line }: { path: string; line?: number }): React.JSX.Element {
  const { view, error } = useReadFile(path)
  const refreshTree = useRefreshTree()

  // Opening a row for a file that's already gone refreshes the tree, so the
  // phantom row (and any siblings deleted alongside it) drops on the next read.
  useEffect(() => {
    if (view?.type === 'not-found') refreshTree()
  }, [view, refreshTree])

  if (error) {
    return <p className="p-4 text-sm text-destructive">{error.message}</p>
  }
  if (view === undefined) {
    return <p className="p-4 text-sm text-muted-foreground">Loading…</p>
  }

  if (view.type === 'not-found') {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        This file no longer exists.
      </div>
    )
  }

  if (view.type === 'image') {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <img src={view.dataUrl} alt={path} className="max-h-full max-w-full object-contain" />
      </div>
    )
  }

  if (view.type === 'binary') {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Binary file · {(view.size / 1024).toFixed(1)} KB
      </div>
    )
  }

  if (view.type === 'too-large') {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        File too large to preview · {(view.size / (1024 * 1024)).toFixed(1)} MB
      </div>
    )
  }

  return <TextFileView path={path} content={view.content} line={line} />
}
