import type { FeatureFile } from '@main/feature-view'
import type { FileSource } from '@main/review-set'
import { Button } from '@renderer/components/ui/button'
import {
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@renderer/components/ui/sidebar'
import { useDiffFilePrefetch } from '@renderer/hooks/use-diff'
import { useClearFeatureReview, useFeatureView } from '@renderer/hooks/use-feature-view'
import { cn } from '@renderer/lib/utils'
import { useRepoStore } from '@renderer/stores/repo'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { BookOpen, Eraser, Flag, RefreshCw, Sparkles } from 'lucide-react'
import { useState } from 'react'

const SOURCE_LABEL: Record<FileSource, string> = {
  changed: 'changed',
  context: 'context',
  shipped: 'shipped',
}

// The legend marker for a file's source: a filled dot for a changed file, a
// rotated square for an agent-shipped cross-seam file, a hollow ring for the
// unchanged context the change reaches.
export function SourceMarker({ source }: { source: FileSource }): React.JSX.Element {
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
  // list); context/shipped files are unchanged, so open the file itself (absolute
  // path, like the file tree).
  const open = (): void => {
    if (file.source === 'changed') {
      openTab({ id: tabId('diff', file.path), kind: 'diff', title: name, path: file.path })
    } else {
      const absolute = `${repoPath}/${file.path}`
      openTab({ id: tabId('file', absolute), kind: 'file', title: name, path: absolute })
    }
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        className="h-auto py-1"
        onClick={open}
        onMouseEnter={() => {
          if (file.source === 'changed') prefetchDiff(file.path)
        }}
      >
        <div className="flex min-w-0 flex-col items-start gap-0.5">
          <span className="flex max-w-full items-center gap-1.5">
            <SourceMarker source={file.source} />
            <span className={cn('truncate', file.source !== 'changed' && 'text-muted-foreground')}>
              {name}
            </span>
            {file.additions !== undefined && file.additions > 0 && (
              <span className="shrink-0 font-mono text-[10px] text-success">+{file.additions}</span>
            )}
            {file.deletions !== undefined && file.deletions > 0 && (
              <span className="shrink-0 font-mono text-[10px] text-destructive">
                −{file.deletions}
              </span>
            )}
          </span>
          {dir && (
            <span className="max-w-full truncate text-xs text-muted-foreground" dir="rtl">
              {dir}
            </span>
          )}
          {connects && (
            <span className="max-w-full truncate text-xs text-muted-foreground/70">
              → {connects}
            </span>
          )}
        </div>
      </SidebarMenuButton>
      {file.note && (
        <p className="mx-2 my-1 flex items-start gap-1.5 border-l-2 border-warning bg-card px-2 py-1.5 text-xs text-muted-foreground">
          <Flag className="mt-0.5 size-3 shrink-0 text-warning" />
          {file.note}
        </p>
      )}
    </SidebarMenuItem>
  )
}

// The Feature sidebar tab: the whole feature in flow order as a navigation list
// (peer of Files/Changes/History). The viewer's `feature` tab is the expanded
// read; this is the index you scan and click from.
export function FeatureList(): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const openTab = useTabsStore((s) => s.openTab)
  const { view, refresh } = useFeatureView()
  const { clear, isClearing } = useClearFeatureReview()
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearError, setClearError] = useState<string | null>(null)

  if (!repo || view === undefined) {
    return <p className="p-3 text-sm text-muted-foreground">Loading…</p>
  }

  // The inline reading surface is MCP-only, so the opener appears only when an
  // agent has pushed a review set; the baseline stays a plain navigation list.
  const openReading = (): void => {
    openTab({
      id: tabId('feature', repo.path),
      kind: 'feature',
      title: 'Feature view',
      path: repo.path,
    })
  }

  // Clear discards the agent's curated set + notes (reverting to the baseline), so
  // it's two-step: the first click arms it, the second confirms. The agent can
  // always re-push, and blurring the button cancels.
  const handleClear = async (): Promise<void> => {
    if (!confirmClear) {
      setConfirmClear(true)
      return
    }
    setClearError(null)
    try {
      await clear()
    } catch (e) {
      setClearError(e instanceof Error ? e.message : String(e))
    } finally {
      setConfirmClear(false)
    }
  }

  const files = view.groups.flatMap((g) => g.files)
  const counts: Record<FileSource, number> = {
    changed: files.filter((f) => f.source === 'changed').length,
    context: files.filter((f) => f.source === 'context').length,
    shipped: files.filter((f) => f.source === 'shipped').length,
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between px-2">
        <h2 className="flex min-w-0 items-center gap-1.5 text-xs font-medium">
          <span className="truncate">{view.name}</span>
          {view.fromAgent && (
            <span className="flex shrink-0 items-center gap-1 rounded bg-info/15 px-1 py-0.5 text-[9px] font-normal text-info">
              <Sparkles className="size-2.5" />
              agent
            </span>
          )}
        </h2>
        <Button variant="ghost" size="icon-sm" onClick={refresh} aria-label="Refresh feature view">
          <RefreshCw />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 pb-1 text-xs text-muted-foreground">
        {(['changed', 'context', 'shipped'] as const).map((source) => (
          <span key={source} className="flex items-center gap-1.5">
            <SourceMarker source={source} />
            {counts[source]} {SOURCE_LABEL[source]}
          </span>
        ))}
      </div>

      {view.fromAgent && (
        <>
          <div className="mx-2 mb-1 flex items-center gap-2">
            {files.length > 0 && (
              <button
                type="button"
                onClick={openReading}
                className="flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-xs text-info hover:bg-sidebar-accent/50"
              >
                <BookOpen className="size-3.5" />
                Open inline read
              </button>
            )}
            <button
              type="button"
              onClick={handleClear}
              onBlur={() => setConfirmClear(false)}
              disabled={isClearing}
              aria-label="Clear agent review set"
              title="Clear the agent review set (back to the baseline)"
              className={cn(
                'ml-auto flex items-center gap-1 rounded-md px-2 py-1.5 text-xs hover:bg-sidebar-accent/50',
                confirmClear ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              <Eraser className="size-3.5" />
              {confirmClear ? (isClearing ? 'Clearing…' : 'Clear?') : 'Clear'}
            </button>
          </div>
          {clearError && (
            <p className="mx-2 mb-1 whitespace-pre-wrap font-mono text-[10px] text-destructive">
              {clearError}
            </p>
          )}
        </>
      )}

      {files.length === 0 ? (
        <p className="px-3 py-2 text-sm text-muted-foreground">
          No changes yet. The feature view appears once you have working-tree changes — or when your
          agent pushes a review set over MCP.
        </p>
      ) : (
        view.groups.map((group) => (
          <div key={group.layer}>
            <SidebarGroupLabel className="h-6 px-2 text-[10px] uppercase tracking-wider">
              {group.layer}
            </SidebarGroupLabel>
            <SidebarMenu>
              {group.files.map((file) => (
                <FileRow key={file.path} file={file} repoPath={repo.path} />
              ))}
            </SidebarMenu>
          </div>
        ))
      )}

      {!view.fromAgent && files.length > 0 && (
        <p className="mx-2 mt-2 border-t border-border pt-2 text-xs text-muted-foreground/70">
          Static baseline — changed files plus what they import. Connect Porcelain's MCP server to
          pull in the rest of the feature (server files, cross-seam contracts).
        </p>
      )}
    </div>
  )
}
