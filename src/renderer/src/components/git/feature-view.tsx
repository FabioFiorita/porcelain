import type { FeatureFile } from '@main/feature-view'
import type { FileSource } from '@main/review-set'
import { Button } from '@renderer/components/ui/button'
import { useDiffFilePrefetch } from '@renderer/hooks/use-diff'
import { useFeatureView } from '@renderer/hooks/use-feature-view'
import { cn } from '@renderer/lib/utils'
import { useRepoStore } from '@renderer/stores/repo'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { Flag, RefreshCw, Sparkles } from 'lucide-react'

const SOURCE_LABEL: Record<FileSource, string> = {
  changed: 'changed',
  context: 'context',
  shipped: 'shipped',
}

function SourceMarker({ source }: { source: FileSource }): React.JSX.Element {
  if (source === 'changed') return <span className="size-2 shrink-0 rounded-full bg-primary" />
  if (source === 'shipped') return <span className="size-[7px] shrink-0 rotate-45 bg-info" />
  return <span className="size-2 shrink-0 rounded-full border border-muted-foreground/70" />
}

function FileRow({ file, repoPath }: { file: FeatureFile; repoPath: string }): React.JSX.Element {
  const openTab = useTabsStore((s) => s.openTab)
  const prefetchDiff = useDiffFilePrefetch()
  const name = file.path.split('/').at(-1) ?? file.path
  const dir = file.path.split('/').slice(0, -1).join('/')
  const connects = file.connects.map((c) => c.split('/').at(-1)).join(', ')

  // Changed files open their working-tree diff (relative path, like the Changes
  // list); context/shipped files have no diff to show, so open the file itself
  // (absolute path, like the file tree).
  const open = (): void => {
    if (file.source === 'changed') {
      openTab({ id: tabId('diff', file.path), kind: 'diff', title: name, path: file.path })
    } else {
      const absolute = `${repoPath}/${file.path}`
      openTab({ id: tabId('file', absolute), kind: 'file', title: name, path: absolute })
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={open}
        onMouseEnter={() => {
          if (file.source === 'changed') prefetchDiff(file.path)
        }}
        className="flex w-full items-center gap-2.5 rounded-md px-2 py-1 text-left hover:bg-sidebar-accent/50"
      >
        <SourceMarker source={file.source} />
        <span
          className={cn(
            'truncate text-sm',
            file.source === 'changed' ? 'font-medium' : 'text-muted-foreground',
          )}
        >
          {name}
        </span>
        {file.additions !== undefined && file.additions > 0 && (
          <span className="shrink-0 font-mono text-[10px] text-success">+{file.additions}</span>
        )}
        {file.deletions !== undefined && file.deletions > 0 && (
          <span className="shrink-0 font-mono text-[10px] text-destructive">−{file.deletions}</span>
        )}
        {dir && (
          <span className="ml-auto truncate font-mono text-[10px] text-muted-foreground/60">
            {dir}
          </span>
        )}
      </button>
      {connects && (
        <p className="ml-[18px] truncate px-2 text-xs text-muted-foreground/70">→ {connects}</p>
      )}
      {file.note && (
        <p className="ml-[18px] my-1 flex items-start gap-1.5 border-l-2 border-warning bg-card px-2.5 py-1.5 text-xs text-muted-foreground">
          <Flag className="mt-0.5 size-3 shrink-0 text-warning" />
          {file.note}
        </p>
      )}
    </div>
  )
}

export function FeatureView(): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const { view, refresh } = useFeatureView()

  if (!repo || view === undefined) {
    return <p className="p-4 text-sm text-muted-foreground">Loading…</p>
  }

  const files = view.groups.flatMap((g) => g.files)
  const counts: Record<FileSource, number> = {
    changed: files.filter((f) => f.source === 'changed').length,
    context: files.filter((f) => f.source === 'context').length,
    shipped: files.filter((f) => f.source === 'shipped').length,
  }

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-2xl p-6">
        <div className="mb-1 flex items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-lg font-medium">
            {view.name}
            {view.fromAgent && (
              <span className="flex items-center gap-1 rounded-md bg-info/15 px-1.5 py-0.5 text-[10px] font-normal text-info">
                <Sparkles className="size-3" />
                from agent
              </span>
            )}
          </h1>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={refresh}
            aria-label="Refresh feature view"
          >
            <RefreshCw />
          </Button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {(['changed', 'context', 'shipped'] as const).map((source) => (
            <span key={source} className="flex items-center gap-1.5">
              <SourceMarker source={source} />
              {counts[source]} {SOURCE_LABEL[source]}
            </span>
          ))}
        </div>

        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No changes yet. The feature view appears once you have working-tree changes — or when
            your agent pushes a review set over MCP.
          </p>
        ) : (
          <div className="space-y-4">
            {view.groups.map((group) => (
              <div key={group.layer}>
                <p className="mb-1 px-2 text-[10px] uppercase tracking-wider text-muted-foreground/80">
                  {group.layer}
                </p>
                <div className="space-y-0.5">
                  {group.files.map((file) => (
                    <FileRow key={file.path} file={file} repoPath={repo.path} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {!view.fromAgent && files.length > 0 && (
          <p className="mt-6 border-t border-border pt-3 text-xs text-muted-foreground/70">
            This is the static baseline — changed files plus what they import. Connect Porcelain's
            MCP server to let your agent pull in the rest of the feature (server files, cross-seam
            contracts) and annotate the invariants to check.
          </p>
        )}
      </div>
    </div>
  )
}
