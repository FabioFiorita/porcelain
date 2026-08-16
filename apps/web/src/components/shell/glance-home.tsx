import { changesetTabKey } from '@renderer/components/git/changeset-view'
import { useGitFlow, useGitWorkspace } from '@renderer/features/git'
import { DevServersSection } from '@renderer/features/terminal'
import { toastUserActionError } from '@renderer/hooks/mutation-error'
import { openTerminalPanel } from '@renderer/lib/terminal-actions'
import { targetedTab } from '@renderer/stores/hub-tabs'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { useTabsStore } from '@renderer/stores/tabs'
import { runUserAction } from '@shared/background'
import { TestIds } from '@shared/test-ids'
import { FileDiff, GitBranch, SquareTerminal } from 'lucide-react'

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

/**
 * The Glance: home when no tab is open — work in flight (dirty tree)
 * plus always-visible jump rows so an
 * empty checkout is still a useful landing page. Phone and desktop empty panes
 * both use it (U6).
 */
export function GlanceHome(): React.JSX.Element | null {
  const project = useProjectSelectionStore((s) => s.project)
  const openTab = useTabsStore((s) => s.openTab)
  const setSidebarTab = usePreferencesStore((s) => s.setSidebarTab)
  const workspace = useGitWorkspace()
  const branch = workspace.branch
  const { groups } = useGitFlow()

  if (!project) return null

  const changedCount = groups?.reduce((n, group) => n + group.files.length, 0) ?? 0
  const showCheckout = changedCount > 0
  const hasWork = showCheckout

  // Continuous stacked diffs for the working tree (U3 — not the Review empty state).
  const handleOpenAllChanges = (): void => {
    setSidebarTab('changes')
    const key = changesetTabKey({ type: 'working' })
    openTab(targetedTab('changeset', key, { title: 'All changes' }))
  }

  const handleOpenTerminal = (): void => {
    runUserAction(
      () => openTerminalPanel(),
      (error) => toastUserActionError('Open terminal', error),
    )
  }

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
              Nothing in flight — open Changes, Canvas, or a terminal when you start.
            </p>
          )}
        </header>

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
          </GlanceSection>
        )}

        {/* Daemon-owned processes for this Worktree — durable across navigation. */}
        <DevServersSection />

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
