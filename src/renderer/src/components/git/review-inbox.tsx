import type { InboxRow } from '@backend/worktree-inbox'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from '@renderer/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useWorktreeInbox } from '@renderer/hooks/use-worktrees'
import { useRepoStore } from '@renderer/stores/repo'
import { GitBranch, Loader2 } from 'lucide-react'

/** "N changed files · M threads · review pushed/none" — the row's tooltip detail. */
function inboxSummary(row: InboxRow): string {
  const threads = row.workingThreads + row.idleThreads
  const files = `${row.changedCount} changed file${row.changedCount === 1 ? '' : 's'}`
  const threadLabel = `${threads} thread${threads === 1 ? '' : 's'}`
  return `${files} · ${threadLabel} · review ${row.hasReview ? 'pushed' : 'none'}`
}

/** One inbox row: click switches THIS window to that worktree (in place, via switchTo —
 *  the same call the worktree-switcher rows make), landing on its Review. */
function InboxRowButton({ row }: { row: InboxRow }): React.JSX.Element {
  const switchTo = useRepoStore((s) => s.switchTo)

  const openWorktree = (): void => {
    switchTo(row.path)
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={openWorktree}
            className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left hover:bg-sidebar-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
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
        }
      />
      <TooltipContent side="right">
        <span className="font-mono">{row.branch}</span> — {inboxSummary(row)}
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * The Review inbox: from this checkout, every OTHER worktree of the family that has agent
 * work awaiting review (a changed-file count, live/idle threads, or a pushed Review). One
 * click switches this window there — the cross-worktree surface that lets per-worktree
 * thread scoping stay strict. Renders nothing until the inbox has rows.
 */
export function ReviewInbox(): React.JSX.Element | null {
  const rows = useWorktreeInbox()
  if (rows.length === 0) return null

  return (
    <SidebarGroup className="px-3">
      <SidebarGroupLabel className="px-1 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
        Review inbox
      </SidebarGroupLabel>
      <SidebarGroupContent className="flex flex-col gap-0.5 px-1">
        {rows.map((row) => (
          <InboxRowButton key={row.path} row={row} />
        ))}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
