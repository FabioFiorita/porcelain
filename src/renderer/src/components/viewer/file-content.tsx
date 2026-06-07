import { useReadFile } from '@renderer/hooks/use-files'
import { TextFileView } from './text-file-view'

export function FileContent({ path, line }: { path: string; line?: number }): React.JSX.Element {
  const { view, error } = useReadFile(path)

  if (error) {
    return <p className="p-4 text-sm text-destructive">{error.message}</p>
  }
  if (view === undefined) {
    return <p className="p-4 text-sm text-muted-foreground">Loading…</p>
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
