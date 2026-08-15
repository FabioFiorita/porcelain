import { Button } from '@renderer/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { useSidebar } from '@renderer/components/ui/sidebar'
import { ActionsGroup } from '@renderer/features/actions'
import { useHubInventory } from '@renderer/features/projects'
import { toastUserActionError } from '@renderer/hooks/mutation-error'
import { isModExclusive, isTextEntry, kbdLabel } from '@renderer/lib/keyboard'
import { toggleTerminalPanel } from '@renderer/lib/terminal-actions'
import { cn } from '@renderer/lib/utils'
import { useHubSelectionStore } from '@renderer/stores/hub-selection'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { useTabsStore } from '@renderer/stores/tabs'
import { useTerminalsStore } from '@renderer/stores/terminals'
import { runUserAction } from '@shared/background'
import { TestIds } from '@shared/test-ids'
import {
  GitCommitHorizontal,
  ListPlus,
  PanelBottom,
  PanelLeft,
  PanelRight,
  Zap,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { CommitGroup } from './commit-group'
import { QuickCommandsGroup } from './quick-commands-group'
import { ShortcutTooltip } from './shortcut-tooltip'
import { TabBar } from './tab-bar'

interface Breadcrumb {
  id: string
  label: string
}

interface LeftSidebarHandle {
  collapsed: boolean
  toggle: () => void
}

function useViewerBreadcrumb(): Breadcrumb[] {
  const inventory = useHubInventory()
  const selection = useHubSelectionStore((s) => s.selection)
  const selectedProject = useProjectSelectionStore((s) => s.project)
  const activeTab = useTabsStore((s) => {
    const pane = s.panes[s.activePaneIndex]
    return pane?.tabs.find((tab) => tab.id === pane.activeTabId) ?? null
  })

  const target = activeTab?.target
  const projectId =
    target?.projectId ?? (selection.kind === 'worktree' ? selection.projectId : null)
  const worktreeId =
    target?.worktreeId ?? (selection.kind === 'worktree' ? selection.worktreeId : null)
  const project = inventory?.projects.find((item) => item.id === projectId)
  const worktree = project?.worktrees.find((item) => item.id === worktreeId)
  const segments: Breadcrumb[] = []
  if (project?.name !== undefined) segments.push({ id: 'project', label: project.name })
  if (worktree?.branch !== undefined) segments.push({ id: 'worktree', label: worktree.branch })

  if (segments.length === 0 && selectedProject !== null) {
    segments.push({ id: 'selected-project', label: selectedProject.name })
  }
  if (activeTab !== null) segments.push({ id: 'tab', label: activeTab.title })
  return segments
}

function HeaderPopover({
  label,
  icon: Icon,
  children,
  className,
  testId,
  shortcutKey,
  shortcut,
}: {
  label: string
  icon: typeof Zap
  children: React.ReactNode
  className?: string
  testId?: string
  shortcutKey: string
  shortcut: string
}): React.JSX.Element {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (
        !isModExclusive(event) ||
        event.altKey ||
        !event.shiftKey ||
        event.key.toLowerCase() !== shortcutKey.toLowerCase() ||
        isTextEntry(event.target)
      ) {
        return
      }
      event.preventDefault()
      setOpen(true)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcutKey])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <ShortcutTooltip label={label} shortcut={shortcut}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className={cn('h-7 gap-1 px-2 text-2xs text-muted-foreground', className)}
              data-testid={testId}
            >
              <Icon className="size-3.5" />
              {label}
            </Button>
          }
        />
      </ShortcutTooltip>
      <PopoverContent
        align="end"
        className="max-h-[calc(100dvh-4.5rem)] w-[min(24rem,calc(100vw-1rem))] overflow-auto p-1"
      >
        {children}
      </PopoverContent>
    </Popover>
  )
}

/** Header chrome for the center Viewer; feature internals stay below this boundary. */
export function ViewerHeader({ left }: { left: LeftSidebarHandle }): React.JSX.Element {
  const { toggleSidebar: toggleRight, isMobile, openMobile, open: rightOpen } = useSidebar()
  const crumbs = useViewerBreadcrumb()
  const paneCount = useTabsStore((s) => s.panes.length)
  const activePaneIndex = useTabsStore((s) => s.activePaneIndex)
  const terminalPanelOpen = useTerminalsStore((s) => s.panelOpen)
  const rightActive = isMobile ? openMobile : rightOpen
  const handleToggleRight = (): void => {
    toggleRight()
  }
  const handleToggleTerminal = (): void => {
    runUserAction(
      () => toggleTerminalPanel(),
      (error) => toastUserActionError('Open terminal', error),
    )
  }
  const actionsShortcut = kbdLabel('mod', 'shift', 'A')
  const commandsShortcut = kbdLabel('mod', 'shift', 'C')

  return (
    <div className="app-drag flex h-12 shrink-0 items-center gap-1 border-b px-2">
      <ShortcutTooltip label="Toggle projects sidebar" shortcut={kbdLabel('mod', 'B')}>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={left.toggle}
          aria-label="Toggle projects sidebar"
          aria-expanded={!left.collapsed}
          data-testid={TestIds.toggleLeftSidebar}
          className="app-no-drag shrink-0"
        >
          <PanelLeft />
        </Button>
      </ShortcutTooltip>
      <div className="app-no-drag flex min-w-0 flex-1 items-center">
        {paneCount === 1 ? (
          <TabBar paneIndex={activePaneIndex} reserveScrollbarSpace />
        ) : crumbs.length === 0 ? (
          <span className="px-1 text-xs text-muted-foreground">Home</span>
        ) : (
          <div className="flex min-w-0 items-center gap-1 truncate px-1 text-xs">
            {crumbs.map((crumb, index) => (
              <span key={crumb.id} className="flex min-w-0 items-center gap-1">
                {index > 0 && <span className="text-muted-foreground">/</span>}
                <span
                  className={cn(
                    'truncate',
                    index === crumbs.length - 1 && 'font-medium text-foreground',
                  )}
                >
                  {crumb.label}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="app-no-drag flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-2xs text-muted-foreground"
          disabled
          title="Tasks arrive with the daemon-owned Tasks table."
        >
          <ListPlus className="size-3.5" />
          Task
        </Button>
        <HeaderPopover
          label="Actions"
          icon={Zap}
          testId={TestIds.actionsMenu}
          shortcutKey="a"
          shortcut={actionsShortcut}
        >
          <ActionsGroup />
        </HeaderPopover>
        <HeaderPopover
          label="Commands"
          icon={GitCommitHorizontal}
          testId={TestIds.commandsMenu}
          shortcutKey="c"
          shortcut={commandsShortcut}
        >
          <QuickCommandsGroup />
          <CommitGroup />
        </HeaderPopover>
        <ShortcutTooltip label="Toggle terminal panel" shortcut={kbdLabel('mod', '6')}>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleToggleTerminal}
            aria-label="Toggle terminal panel"
            aria-expanded={terminalPanelOpen}
            data-testid={TestIds.toggleTerminalPanel}
          >
            <PanelBottom />
          </Button>
        </ShortcutTooltip>
        <ShortcutTooltip label="Toggle surfaces sidebar" shortcut={kbdLabel('mod', '.')}>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleToggleRight}
            aria-label="Toggle surfaces sidebar"
            aria-expanded={rightActive}
            data-testid={TestIds.toggleRightSidebar}
          >
            <PanelRight />
          </Button>
        </ShortcutTooltip>
      </div>
    </div>
  )
}
