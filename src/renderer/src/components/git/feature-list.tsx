import type { FeatureFile } from '@backend/feature-view'
import type { FileSource } from '@backend/review-set'
import { SidebarHeaderActions } from '@renderer/components/shell/sidebar-header-actions'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@renderer/components/ui/context-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useFeatureArtifact } from '@renderer/hooks/use-artifact'
import { useDiffFilePrefetch } from '@renderer/hooks/use-diff'
import { useLoopEvidence } from '@renderer/hooks/use-evidence'
import { useClearFeatureReview, useFeatureView } from '@renderer/hooks/use-feature-view'
import { useReviewedPaths, useToggleReviewed } from '@renderer/hooks/use-reviewed'
import { compactButtonClass } from '@renderer/lib/controls'
import { dirName, fileName } from '@renderer/lib/paths'
import { cn } from '@renderer/lib/utils'
import { useRepoStore } from '@renderer/stores/repo'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import {
  BookOpen,
  Check,
  Eraser,
  FileText,
  MessageSquarePlus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Square,
  SquareCheck,
} from 'lucide-react'
import { memo, useState } from 'react'
import { CommentComposer } from './comment-composer'

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

// A node on the flow timeline: a source marker threaded on the spine, the file
// (filename + a layer "station" tag when the layer changes), its path, and any
// agent note. The whole feature reads top-to-bottom as one connected flow rather
// than a stack of per-layer groups.
function FlowNodeImpl({
  file,
  repoPath,
  layer,
  isReviewed,
  onComment,
}: {
  file: FeatureFile
  repoPath: string
  layer: string | null
  isReviewed: boolean
  onComment: (path: string) => void
}): React.JSX.Element {
  const openTab = useTabsStore((s) => s.openTab)
  const prefetchDiff = useDiffFilePrefetch()
  const { mark, unmark } = useToggleReviewed()
  const name = fileName(file.path)
  const dir = dirName(file.path)
  const connects = file.connects.map((c) => fileName(c)).join(', ')

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
    <div className="relative pl-6">
      {/* marker sits on the spine; z-10 so solid markers mask the line behind them */}
      <span className="absolute left-[3px] top-2.5 z-10 flex">
        <SourceMarker source={file.source} />
      </span>
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <button
              type="button"
              onClick={open}
              onMouseEnter={() => {
                if (file.source === 'changed') prefetchDiff(file.path)
              }}
              className="flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1 text-left hover:bg-sidebar-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          }
        >
          <span className="flex max-w-full items-center gap-1.5">
            {isReviewed && (
              <Check className="size-3 shrink-0 self-center text-success" aria-label="Reviewed" />
            )}
            <span
              className={cn(
                'truncate text-sm-minus',
                (file.source !== 'changed' || isReviewed) && 'text-muted-foreground',
                isReviewed && 'line-through',
              )}
            >
              {name}
            </span>
            {layer && (
              <Badge
                variant="outline"
                className="shrink-0 rounded-md border-border/60 px-1.5 py-0 text-4xs uppercase tracking-wider text-muted-foreground"
              >
                {layer}
              </Badge>
            )}
            {file.additions !== undefined && file.additions > 0 && (
              <span className="shrink-0 font-mono text-2xs text-success">+{file.additions}</span>
            )}
            {file.deletions !== undefined && file.deletions > 0 && (
              <span className="shrink-0 font-mono text-2xs text-destructive">
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
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          {isReviewed ? (
            <ContextMenuItem onClick={async () => unmark(file.path)}>
              <Square />
              Unmark reviewed
            </ContextMenuItem>
          ) : (
            <ContextMenuItem onClick={async () => mark(file.path)}>
              <SquareCheck />
              Mark reviewed
            </ContextMenuItem>
          )}
          <ContextMenuItem onClick={() => onComment(file.path)}>
            <MessageSquarePlus /> Comment on file
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      {file.note && (
        <div className="mx-2 mb-1 rounded-lg border border-border/60 bg-black/20 px-2.5 py-2">
          <span className="text-3xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Note
          </span>
          <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
            {file.note}
          </p>
        </div>
      )}
    </div>
  )
}

const FlowNode = memo(FlowNodeImpl)

// The Feature sidebar tab: the whole feature in flow order as a navigation list
// (peer of Files/Changes/History). The viewer's `feature` tab is the expanded
// read; this is the index you scan and click from.
export function FeatureList(): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const openTab = useTabsStore((s) => s.openTab)
  const { view, refresh } = useFeatureView()
  const { artifact } = useFeatureArtifact()
  const { evidence } = useLoopEvidence()
  const reviewed = useReviewedPaths()
  const { clear, isClearing } = useClearFeatureReview()
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearError, setClearError] = useState<string | null>(null)
  const [commentPath, setCommentPath] = useState<string | null>(null)

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

  // The agent-authored artifact (a self-contained HTML explainer) opens pinned, like
  // the feature view — it's a document to keep, not a preview. Shown only when the
  // agent has pushed one; independent of the review set.
  const openArtifact = (): void => {
    if (!artifact) return
    openTab({
      id: tabId('artifact', repo.path),
      kind: 'artifact',
      title: 'Feature artifact',
      path: repo.path,
    })
  }

  // Loop evidence is the ephemeral proof the agent closed the loop (browser /
  // simulator validation). Same open pattern as the artifact; clear lives on the
  // evidence view header (Eraser), not here.
  const openEvidence = (): void => {
    if (!evidence) return
    openTab({
      id: tabId('evidence', repo.path),
      kind: 'evidence',
      title: 'Loop evidence',
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
  // Flatten to a single flow (groups are already in entry-point→data order); each
  // node carries its layer so the timeline can tag the first node of each layer.
  const flow = view.groups.flatMap((g) => g.files.map((file) => ({ file, layer: g.layer })))
  const counts: Record<FileSource, number> = {
    changed: files.filter((f) => f.source === 'changed').length,
    context: files.filter((f) => f.source === 'context').length,
    shipped: files.filter((f) => f.source === 'shipped').length,
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start justify-between gap-1.5 px-2">
        {/* The title is the agent's own name for the feature — shown only in agent
            mode (the baseline is already labelled "Feature review" by the sidebar
            header, so repeating a generic title there is just noise). It wraps to
            multiple lines rather than truncating. */}
        {view.fromAgent ? (
          <h2 className="flex min-w-0 flex-wrap items-center gap-1.5 pt-1 text-xs font-medium">
            <span className="min-w-0">{view.name}</span>
            <Badge
              variant="outline"
              className="shrink-0 rounded-md border-info/20 bg-info/15 text-3xs font-normal text-info"
            >
              <Sparkles className="size-2.5" />
              agent
            </Badge>
          </h2>
        ) : (
          <span aria-hidden />
        )}
        <SidebarHeaderActions>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={refresh}
            aria-label="Refresh feature view"
          >
            <RefreshCw />
          </Button>
        </SidebarHeaderActions>
      </div>

      {(artifact || evidence) && (
        <div className="mx-2 mb-1 flex flex-col gap-1">
          {artifact && (
            <Button
              variant="outline"
              size="sm"
              className={cn(compactButtonClass, 'w-full justify-start rounded-md')}
              onClick={openArtifact}
            >
              <FileText />
              <span className="truncate">Feature artifact</span>
            </Button>
          )}
          {evidence && (
            <Button
              variant="outline"
              size="sm"
              className={cn(compactButtonClass, 'w-full justify-start rounded-md')}
              onClick={openEvidence}
            >
              <ShieldCheck />
              <span className="truncate">Loop evidence</span>
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 pb-1 text-xs text-muted-foreground">
        {(['changed', 'context', 'shipped'] as const).map((source) => (
          <span key={source} className="flex items-center gap-1.5">
            <SourceMarker source={source} />
            {counts[source]} {SOURCE_LABEL[source]}
          </span>
        ))}
      </div>

      {view.fromAgent && (
        <div className="mx-2 mb-1 flex flex-col gap-1">
          {/* Mirrors the Stage all / Commit pairing: a primary action filling the
              row, with the destructive clear reduced to an icon-only button beside
              it. The clear stays two-step (arm then confirm) — confirm flips it to
              the destructive variant. */}
          <div className="flex gap-2">
            {files.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className={cn(compactButtonClass, 'flex-1 rounded-md')}
                onClick={openReading}
              >
                <BookOpen />
                Open inline read
              </Button>
            )}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-sm"
                    variant={confirmClear ? 'destructive' : 'outline'}
                    className="rounded-md"
                    onClick={handleClear}
                    onBlur={() => setConfirmClear(false)}
                    disabled={isClearing}
                    aria-label={
                      confirmClear ? 'Confirm clear agent review set' : 'Clear agent review set'
                    }
                  >
                    <Eraser />
                  </Button>
                }
              />
              <TooltipContent>
                Removes the agent's files &amp; notes — your working-tree changes still show as the
                baseline.
              </TooltipContent>
            </Tooltip>
          </div>
          {clearError && (
            <p className="whitespace-pre-wrap font-mono text-2xs text-destructive">{clearError}</p>
          )}
        </div>
      )}

      {files.length === 0 ? (
        <p className="px-3 py-2 text-sm text-muted-foreground">
          No changes yet. The feature view appears once you have working-tree changes — or when your
          agent pushes a review set over MCP.
        </p>
      ) : (
        <div className="px-2 pt-1">
          <div className="px-1 pb-1 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
            Flow
          </div>
          <div className="relative">
            {/* the spine the markers thread through, inset so it stops at the
                first/last node rather than running the full column height */}
            <span
              aria-hidden
              className="absolute bottom-3 left-[7px] top-3 w-px bg-sidebar-border"
            />
            {flow.map(({ file, layer }, i) => (
              <FlowNode
                key={file.path}
                file={file}
                repoPath={repo.path}
                layer={layer === flow[i - 1]?.layer ? null : layer}
                isReviewed={reviewed.has(file.path)}
                onComment={setCommentPath}
              />
            ))}
          </div>
        </div>
      )}

      <CommentComposer
        anchor={commentPath ? { path: commentPath } : null}
        open={commentPath !== null}
        onOpenChange={(open) => {
          if (!open) setCommentPath(null)
        }}
      />

      {!view.fromAgent && files.length > 0 && (
        <p className="mx-2 mt-2 border-t border-border pt-2 text-xs text-muted-foreground/70">
          Static baseline — changed files plus what they import. Connect Porcelain's MCP server to
          pull in the rest of the feature (server files, cross-seam contracts).
        </p>
      )}
    </div>
  )
}
