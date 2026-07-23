import type { InboxRow } from '@backend/worktree-inbox'
import { ProviderGlyph } from '@renderer/components/agent/provider-glyph'
import { reviewTabKey } from '@renderer/components/git/review-view'
import { useAgentThreads } from '@renderer/hooks/use-agents'
import { useBoardCards } from '@renderer/hooks/use-board'
import { useFeatureReading } from '@renderer/hooks/use-feature-reading'
import { useGitFlow } from '@renderer/hooks/use-git-flow'
import { useWorktreeInbox } from '@renderer/hooks/use-worktrees'
import { cn } from '@renderer/lib/utils'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useRepoStore } from '@renderer/stores/repo'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import type { ThreadInfo } from '@shared/agent-protocol'
import { TestIds } from '@shared/test-ids'
import { Columns3, FileDiff, GitBranch, Loader2, Waypoints } from 'lucide-react'
import { useMemo } from 'react'

// One tap-target recipe for every Glance row: full-width, touch-comfortable
// height, the app's one hover/pressed fill. Rows stay flat on the viewer
// background — the Glance is a document, not a dashboard of cards.
const rowClass =
  'flex w-full items-center gap-2 rounded-md px-2 py-2.5 text-left hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'

/** A Glance section: the quiet uppercase label idiom over its rows. Sections with
 *  nothing to show are omitted by the caller — no "empty" filler here. */
function GlanceSection({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="flex flex-col gap-0.5">
      <p className="px-2 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      {children}
    </section>
  )
}

/** One agent thread: provider mark + title, the worktree chip when bound, and a
 *  spinner while working (idle stays quiet). Tap opens the thread's agent tab. */
function ThreadGlanceRow({ thread }: { thread: ThreadInfo }): React.JSX.Element {
  const openTab = useTabsStore((s) => s.openTab)

  const openThread = (): void => {
    openTab({ id: tabId('agent', thread.id), kind: 'agent', title: thread.title, path: thread.id })
  }

  return (
    <button type="button" onClick={openThread} className={rowClass}>
      <ProviderGlyph provider={thread.provider} className="size-3.5 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-sm">{thread.title}</span>
      {thread.worktreeBranch && (
        <span
          className="flex min-w-0 max-w-24 shrink-0 items-center gap-0.5 font-mono text-2xs text-muted-foreground"
          title={`Worktree: ${thread.worktreeBranch}`}
        >
          <GitBranch className="size-3 shrink-0" />
          <span className="truncate">{thread.worktreeBranch}</span>
        </span>
      )}
      {thread.status === 'working' && (
        <Loader2
          className="size-3.5 shrink-0 animate-spin text-muted-foreground"
          aria-label="Working"
        />
      )}
    </button>
  )
}

/** One inbox row — the review-inbox row content on the Glance's tap-target recipe.
 *  Tap switches THIS window to that worktree (same call as review-inbox rows). */
function InboxGlanceRow({ row }: { row: InboxRow }): React.JSX.Element {
  const switchTo = useRepoStore((s) => s.switchTo)

  const openWorktree = (): void => {
    switchTo(row.path)
  }

  return (
    <button type="button" onClick={openWorktree} className={rowClass}>
      <GitBranch className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate font-mono text-sm-minus">{row.branch}</span>
      {row.hasReview && (
        <span
          role="img"
          aria-label="Review pushed"
          title="Review pushed"
          className="size-1.5 shrink-0 rounded-full bg-info"
        />
      )}
      {row.workingThreads > 0 ? (
        <Loader2
          className="size-3.5 shrink-0 animate-spin text-muted-foreground"
          aria-label="Working"
        />
      ) : (
        <span className="shrink-0 text-2xs tabular-nums text-muted-foreground/60">
          {row.changedCount}
        </span>
      )}
    </button>
  )
}

/**
 * The Glance: home when no tab is open — work in flight (threads, inbox, dirty
 * tree, published Review, board). Phone and desktop empty panes both use it (U6).
 */
export function GlanceHome(): React.JSX.Element | null {
  const repo = useRepoStore((s) => s.repo)
  const openTab = useTabsStore((s) => s.openTab)
  const threads = useAgentThreads()
  // Archive is client-local prefs (same as the Agent list) — Glance is "work in
  // flight", so archived threads must not reappear here as if still active.
  const archivedIds = usePreferencesStore((s) => s.archivedAgentThreadIds)
  const visibleThreads = useMemo(() => {
    const archived = new Set(archivedIds)
    return threads
      .filter((t) => !archived.has(t.id))
      .sort((a, b) => {
        // Live first, then most-recently updated idle.
        if (a.status === 'working' && b.status !== 'working') return -1
        if (b.status === 'working' && a.status !== 'working') return 1
        return b.updatedAt - a.updatedAt
      })
  }, [threads, archivedIds])
  const inbox = useWorktreeInbox()
  const { groups } = useGitFlow()
  const { reading } = useFeatureReading()
  const { cards } = useBoardCards()

  if (!repo) return null

  const changedCount = groups?.reduce((n, group) => n + group.files.length, 0) ?? 0
  const hasReview = reading !== null && reading !== undefined
  const doing = cards.filter((card) => card.status === 'doing')
  const todo = cards.filter((card) => card.status === 'todo')

  const showCheckout = changedCount > 0 || hasReview
  const showBoard = doing.length > 0 || todo.length > 0
  const empty = visibleThreads.length === 0 && inbox.length === 0 && !showCheckout && !showBoard

  // Agent-published Review canvas (Feature tab).
  const openFeatureReview = (): void => {
    openTab({ id: tabId('feature', repo.path), kind: 'feature', title: 'Review', path: repo.path })
  }

  // Continuous stacked diffs for the working tree (U3 — not Feature empty state).
  const openAllChanges = (): void => {
    const key = reviewTabKey({ type: 'working' })
    openTab({ id: tabId('review', key), kind: 'review', title: 'All changes', path: key })
  }

  const openBoard = (): void => {
    openTab({ id: tabId('board', repo.path), kind: 'board', title: 'Board', path: repo.path })
  }

  const boardSummary = [
    doing.length > 0 && `${doing.length} doing`,
    todo.length > 0 && `${todo.length} to do`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div data-testid={TestIds.glance} className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-6">
        {/* The repo name anchors the page — which repo you're glancing at. */}
        <h1 className="truncate px-2 text-base font-medium tracking-tight text-foreground">
          {repo.name}
        </h1>
        {empty ? (
          <div className="py-14 text-center">
            <p className="text-sm text-muted-foreground">Nothing in flight</p>
            <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground/70">
              Agent threads, reviews and board work will show up here.
            </p>
          </div>
        ) : (
          <>
            {visibleThreads.length > 0 && (
              <GlanceSection label="Agent threads">
                {visibleThreads.map((thread) => (
                  <ThreadGlanceRow key={thread.id} thread={thread} />
                ))}
              </GlanceSection>
            )}
            {inbox.length > 0 && (
              <GlanceSection label="Review inbox">
                {inbox.map((row) => (
                  <InboxGlanceRow key={row.path} row={row} />
                ))}
              </GlanceSection>
            )}
            {showCheckout && (
              <GlanceSection label="This checkout">
                {changedCount > 0 && (
                  <button
                    type="button"
                    onClick={openAllChanges}
                    className={rowClass}
                    data-testid={TestIds.glanceChangedFiles}
                    data-count={changedCount}
                  >
                    <FileDiff className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {changedCount === 1 ? '1 changed file' : `${changedCount} changed files`}
                    </span>
                  </button>
                )}
                {hasReview && (
                  <button type="button" onClick={openFeatureReview} className={rowClass}>
                    <Waypoints className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {reading?.name?.trim() || 'Review'}
                    </span>
                    <span
                      role="img"
                      aria-label="Review published"
                      title="Agent Review published"
                      className="size-1.5 shrink-0 rounded-full bg-info"
                    />
                  </button>
                )}
              </GlanceSection>
            )}
            {showBoard && (
              <GlanceSection label="Board">
                <button
                  type="button"
                  onClick={openBoard}
                  className={cn(rowClass, 'flex-col items-stretch gap-1')}
                >
                  <span className="flex items-center gap-2">
                    <Columns3 className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm">{boardSummary}</span>
                  </span>
                  {doing.slice(0, 2).map((card) => (
                    <span
                      key={card.id}
                      className="truncate pl-[1.375rem] text-xs text-muted-foreground"
                    >
                      {card.title}
                    </span>
                  ))}
                </button>
              </GlanceSection>
            )}
          </>
        )}
      </div>
    </div>
  )
}
