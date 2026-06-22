import { SidebarHeaderActions } from '@renderer/components/shell/sidebar-header-actions'
import { Button } from '@renderer/components/ui/button'
import { spawnTerminal } from '@renderer/lib/terminal-actions'
import { cn } from '@renderer/lib/utils'
import { useRepoStore } from '@renderer/stores/repo'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { useTerminalsStore } from '@renderer/stores/terminals'
import { Plus, SquareTerminal, X } from 'lucide-react'

/**
 * The Terminal sidebar tab body: the roster of open terminal sessions. "+" spawns a
 * new shell and opens it; a row click opens/focuses its viewer tab; "x" kills the PTY.
 * Sessions are independent of tabs — closing a tab keeps the session here (a background
 * dev server keeps running), so this roster is how you get back to it. Mirrors the
 * Board/Feature tabs: a list here, the live surface in the viewer.
 */
export function TerminalList(): React.JSX.Element {
  const sessions = useTerminalsStore((s) => s.sessions)
  const closeTerminal = useTerminalsStore((s) => s.close)
  const repo = useRepoStore((s) => s.repo)
  const openTab = useTabsStore((s) => s.openTab)
  const activeTabId = useTabsStore((s) => {
    const pane = s.panes[s.activePaneIndex]
    return pane?.activeTabId ?? null
  })

  const open = (id: string, name: string): void => {
    openTab({ id: tabId('terminal', id), kind: 'terminal', title: name, path: id })
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-end px-2">
        <SidebarHeaderActions>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={spawnTerminal}
            aria-label="New terminal"
            disabled={!repo}
          >
            <Plus />
          </Button>
        </SidebarHeaderActions>
      </div>
      <div className="flex flex-col gap-0.5 px-2">
        {sessions.map((session) => {
          const isActive = activeTabId === tabId('terminal', session.id)
          return (
            <div
              key={session.id}
              className={cn(
                'group/term flex h-7 items-center gap-2 rounded-md px-2 text-sm-minus',
                isActive
                  ? 'bg-sidebar-accent text-foreground'
                  : 'text-muted-foreground hover:bg-sidebar-accent/50',
              )}
            >
              <button
                type="button"
                onClick={() => open(session.id, session.name)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <SquareTerminal className="size-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{session.name}</span>
              </button>
              {session.status === 'exited' ? (
                <span className="shrink-0 text-2xs uppercase tracking-wider text-muted-foreground/60">
                  exited
                </span>
              ) : (
                <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-5 shrink-0 opacity-0 group-hover/term:opacity-100"
                aria-label={`Close ${session.name}`}
                onClick={() => closeTerminal(session.id)}
              >
                <X />
              </Button>
            </div>
          )
        })}
        {sessions.length === 0 && (
          <p className="px-1 py-2 text-xs-minus text-muted-foreground/60">
            No terminals. Add one with +, or run an action from Quick access.
          </p>
        )}
      </div>
    </div>
  )
}
