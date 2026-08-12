import { reviewTabKey } from '@renderer/components/git/review-view'
import { useBoardCards } from '@renderer/features/board'
import { useGitWorkspace, type WorktreeInboxRow } from '@renderer/features/git'
import { useReviewComments } from '@renderer/features/review/comments'
import { useFeatureReading } from '@renderer/hooks/use-feature-reading'
import { useGitFlow } from '@renderer/hooks/use-git-flow'
import { cn } from '@renderer/lib/utils'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { TestIds } from '@shared/test-ids'
import {
  Columns3,
  FileDiff,
  GitBranch,
  MessageSquare,
  SquareTerminal,
  Waypoints,
} from 'lucide-react'

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

/** One inbox row — the review-inbox row content on the Glance's tap-target recipe.
 *  Tap switches THIS window to that worktree (same call as review-inbox rows). */
function InboxGlanceRow({ row }: { row: WorktreeInboxRow }): React.JSX.Element {
  const switchProject = useProjectSelectionStore((s) => s.switchProject)

  const handleOpenWorktree = (): void => {
    switchProject(row.path)
  }

  return (
    <button type="button" onClick={handleOpenWorktree} className={rowClass}>
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
      <span className="shrink-0 text-2xs tabular-nums text-muted-foreground/60">
        {row.changedCount}
      </span>
    </button>
  )
}

/**
 * The Glance: home when no tab is open — work in flight (inbox, dirty tree,
 * published Review, board, open comments) plus always-visible jump rows so an
 * empty checkout is still a useful landing page. Phone and desktop empty panes
 * both use it (U6).
 */
export function GlanceHome(): React.JSX.Element | null {
  const project = useProjectSelectionStore((s) => s.project)
  const openTab = useTabsStore((s) => s.openTab)
  const setSidebarTab = usePreferencesStore((s) => s.setSidebarTab)
  const workspace = useGitWorkspace()
  const inbox = workspace.inbox
  const branch = workspace.branch
  const { groups } = useGitFlow()
  const { reading } = useFeatureReading()
  const { cards } = useBoardCards()
  const comments = useReviewComments()

  if (!project) return null

  const changedCount = groups?.reduce((n, group) => n + group.files.length, 0) ?? 0
  const hasReview = reading !== null && reading !== undefined
  const doing = cards.filter((card) => card.status === 'doing')
  const todo = cards.filter((card) => card.status === 'todo')
  const openComments = comments.filter((c) => !c.resolved)

  const showCheckout = changedCount > 0 || hasReview || openComments.length > 0
  const showBoard = doing.length > 0 || todo.length > 0
  const hasWork = inbox.length > 0 || showCheckout || showBoard

  // Agent-published Review canvas (Feature tab).
  const handleOpenFeatureReview = (): void => {
    setSidebarTab('feature')
    openTab({
      id: tabId('feature', project.path),
      kind: 'feature',
      title: 'Review',
      path: project.path,
    })
  }

  // Continuous stacked diffs for the working tree (U3 — not Feature empty state).
  const handleOpenAllChanges = (): void => {
    setSidebarTab('changes')
    const key = reviewTabKey({ type: 'working' })
    openTab({ id: tabId('review', key), kind: 'review', title: 'All changes', path: key })
  }

  const handleOpenBoard = (): void => {
    setSidebarTab('board')
    openTab({ id: tabId('board', project.path), kind: 'board', title: 'Board', path: project.path })
  }

  const handleOpenTerminal = (): void => {
    setSidebarTab('terminal')
  }

  const handleOpenCommentsRail = (): void => {
    setSidebarTab(hasReview ? 'feature' : 'changes')
  }

  const boardSummary = [
    doing.length > 0 && `${doing.length} doing`,
    todo.length > 0 && `${todo.length} to do`,
  ]
    .filter(Boolean)
    .join(' · ')

  const reviewSubtitle = (() => {
    if (!hasReview || !reading) return null
    const fileCount =
      reading.sections.reduce((n, s) => n + s.files.length, 0) +
      reading.groups.reduce((n, g) => n + g.files.length, 0)
    const parts = [
      fileCount > 0 && `${fileCount} file${fileCount === 1 ? '' : 's'}`,
      reading.evidence && 'Evidence',
    ].filter(Boolean)
    return parts.length > 0 ? parts.join(' · ') : 'Published Review'
  })()

  return (
    <div data-testid={TestIds.glance} className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-6">
        {/* Repo identity + branch so the Glance orients you before any work rows. */}
        <header className="flex flex-col gap-1 px-2">
          <h1 className="truncate text-base font-medium tracking-tight text-foreground">
            {project.name}
          </h1>
          {branch && (
            <p className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
              <GitBranch className="size-3 shrink-0" />
              <span className="truncate">{branch}</span>
            </p>
          )}
          {!hasWork && (
            <p className="mt-1 text-xs text-muted-foreground">
              Nothing in flight — open Changes, the Review, or a terminal when you start.
            </p>
          )}
        </header>

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
                onClick={handleOpenAllChanges}
                className={rowClass}
                data-testid={TestIds.glanceChangedFiles}
                data-count={changedCount}
              >
                <FileDiff className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {changedCount === 1 ? '1 changed file' : `${changedCount} changed files`}
                </span>
                <span className="shrink-0 text-2xs tabular-nums text-muted-foreground/60">
                  Review
                </span>
              </button>
            )}
            {hasReview && (
              <button type="button" onClick={handleOpenFeatureReview} className={rowClass}>
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
                {reviewSubtitle && (
                  <span className="hidden shrink-0 text-2xs text-muted-foreground/60 sm:inline">
                    {reviewSubtitle}
                  </span>
                )}
              </button>
            )}
            {openComments.length > 0 && (
              <button type="button" onClick={handleOpenCommentsRail} className={rowClass}>
                <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {openComments.length === 1
                    ? '1 open review comment'
                    : `${openComments.length} open review comments`}
                </span>
              </button>
            )}
          </GlanceSection>
        )}

        {showBoard && (
          <GlanceSection label="Board">
            <button
              type="button"
              onClick={handleOpenBoard}
              className={cn(rowClass, 'flex-col items-stretch gap-1')}
            >
              <span className="flex items-center gap-2">
                <Columns3 className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-sm">{boardSummary}</span>
              </span>
              {doing.slice(0, 3).map((card) => (
                <span
                  key={card.id}
                  className="truncate pl-[1.375rem] text-xs text-muted-foreground"
                >
                  {card.title}
                </span>
              ))}
              {doing.length === 0 &&
                todo.slice(0, 2).map((card) => (
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

        {/* Always-on shortcuts so the landing page is useful even when clean. */}
        <GlanceSection label="Jump to">
          <button
            type="button"
            onClick={handleOpenAllChanges}
            className={rowClass}
            data-testid={TestIds.glanceJumpChanges}
          >
            <FileDiff className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-sm">Changes</span>
            <span className="shrink-0 text-2xs text-muted-foreground/60">
              {changedCount > 0 ? `${changedCount}` : 'Working tree'}
            </span>
          </button>
          <button
            type="button"
            onClick={handleOpenFeatureReview}
            className={rowClass}
            data-testid={TestIds.glanceJumpReview}
          >
            <Waypoints className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-sm">Review</span>
            <span className="shrink-0 text-2xs text-muted-foreground/60">
              {hasReview ? 'Open canvas' : 'No review yet'}
            </span>
          </button>
          <button
            type="button"
            onClick={handleOpenBoard}
            className={rowClass}
            data-testid={TestIds.glanceJumpBoard}
          >
            <Columns3 className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-sm">Board</span>
            <span className="shrink-0 text-2xs text-muted-foreground/60">
              {boardSummary || 'Plan'}
            </span>
          </button>
          <button
            type="button"
            onClick={handleOpenTerminal}
            className={rowClass}
            data-testid={TestIds.glanceJumpTerminal}
          >
            <SquareTerminal className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-sm">Terminal</span>
            <span className="shrink-0 text-2xs text-muted-foreground/60">Agents & shells</span>
          </button>
        </GlanceSection>
      </div>
    </div>
  )
}
