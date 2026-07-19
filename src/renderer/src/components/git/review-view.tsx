import { type DiffReadingScope, useDiffReading } from '@renderer/hooks/use-diff-reading'
import { ReadingSurfaceBody } from './reading-surface'

/** Encode a review scope into the tab's path key (and parse it back). */
export function reviewTabKey(scope: DiffReadingScope): string {
  if (scope.type === 'commit') return `commit:${scope.hash}`
  return scope.type
}

export function parseReviewTabKey(path: string): DiffReadingScope {
  if (path === 'working') return { type: 'working' }
  if (path === 'branch') return { type: 'branch' }
  if (path.startsWith('commit:')) return { type: 'commit', hash: path.slice('commit:'.length) }
  // Defensive fallback — older or hand-built keys shouldn't blank the view.
  return { type: 'working' }
}

/**
 * Continuous stacked-diff reading surface opened from Changes or History.
 * Reuses the same ReadingSurfaceBody as Feature/Explore; file-name rows carry
 * mark-reviewed (working/branch only) and open-file actions.
 */
export function ReviewView({ path }: { path: string }): React.JSX.Element {
  const scope = parseReviewTabKey(path)
  const { reading, error } = useDiffReading(scope)

  if (error) return <p className="p-4 text-sm text-destructive">{error.message}</p>
  if (reading === undefined) {
    return <p className="p-4 text-sm text-muted-foreground">Loading…</p>
  }

  const fileCount = reading.groups.reduce((n, g) => n + g.files.length, 0)
  if (fileCount === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <p className="text-sm font-medium text-foreground">
            {scope.type === 'commit' ? 'Empty commit' : 'No changes to review'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {scope.type === 'commit'
              ? 'This commit doesn’t touch any files.'
              : 'Nothing to walk through in this range yet.'}
          </p>
        </div>
      </div>
    )
  }

  // File-name rows: mark reviewed + open file (stage/discard stay on the Changes
  // list only). Comments work on every line via the shared reading surface.
  return (
    <ReadingSurfaceBody
      reading={reading}
      fileActions={{
        reviewed: true,
        openFile: true,
        showSource: false,
      }}
    />
  )
}
