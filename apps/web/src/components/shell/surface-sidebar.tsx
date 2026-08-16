import { ChangesList } from '@renderer/components/git/changes-list'
import { HistoryList } from '@renderer/components/git/history-list'
import { Button } from '@renderer/components/ui/button'
import { Kbd } from '@renderer/components/ui/kbd'
import { SidebarGroupLabel } from '@renderer/components/ui/sidebar'
import { ToggleGroup, ToggleGroupItem } from '@renderer/components/ui/toggle-group'
import { CanvasList } from '@renderer/features/projects'
import { ReviewList } from '@renderer/features/review'
import { SearchList } from '@renderer/features/search'
import { TasksList } from '@renderer/features/tasks'
import { kbdLabel } from '@renderer/lib/keyboard'
import { cn } from '@renderer/lib/utils'
import { useFileTreeStore } from '@renderer/stores/file-tree'
import type { SidebarTab } from '@renderer/stores/preferences'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { TestIds } from '@shared/test-ids'
import {
  ChevronsDownUp,
  Eye,
  EyeOff,
  FileText,
  GitCompareArrows,
  History,
  LayoutPanelTop,
  Search,
  Table2,
  Waypoints,
} from 'lucide-react'
import { useState } from 'react'
import { FileTimelineGroup } from './file-timeline-group'
import { FileTree } from './file-tree'
import { PinnedGroup } from './pinned-group'
import { ReviewGroup } from './review-group'

interface SurfaceDefinition {
  id: SidebarTab
  label: string
  hint: string
  shortcut: string
  icon: typeof FileText
}

export const SURFACES: SurfaceDefinition[] = [
  { id: 'files', label: 'Files', hint: 'Browse the project tree', shortcut: '1', icon: FileText },
  {
    id: 'changes',
    label: 'Changes',
    hint: 'Review working-tree changes',
    shortcut: '2',
    icon: GitCompareArrows,
  },
  {
    id: 'review',
    label: 'Review',
    hint: 'Open the current Review',
    shortcut: '3',
    icon: Waypoints,
  },
  {
    id: 'history',
    label: 'History',
    hint: 'Inspect commit history',
    shortcut: '4',
    icon: History,
  },
  { id: 'search', label: 'Search', hint: 'Search code and files', shortcut: '5', icon: Search },
  {
    id: 'tasks',
    label: 'Tasks',
    hint: 'Work across every Environment',
    shortcut: '6',
    icon: Table2,
  },
  {
    id: 'canvas',
    label: 'Canvas',
    hint: 'Agent-authored explanation for this Project',
    shortcut: '7',
    icon: LayoutPanelTop,
  },
]

export function surfaceDefinition(id: SidebarTab): SurfaceDefinition {
  const definition = SURFACES.find((surface) => surface.id === id)
  if (definition === undefined) throw new Error(`Unknown surface: ${id}`)
  return definition
}

export function SurfaceLauncher({
  options,
  onOpen,
}: {
  options: SidebarTab[]
  onOpen: (id: SidebarTab) => void
}): React.JSX.Element {
  return (
    <div
      data-testid={TestIds.rail}
      className="flex h-full min-h-0 flex-col gap-3 overflow-auto p-3"
    >
      <div>
        <p className="text-sm font-medium text-foreground">Open a surface</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Keep useful project views beside the Viewer.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {options.map((id) => {
          const surface = surfaceDefinition(id)
          const Icon = surface.icon
          return (
            <button
              key={surface.id}
              type="button"
              data-testid={TestIds.railTab(surface.id)}
              onClick={() => onOpen(surface.id)}
              className="group flex min-h-24 flex-col items-start gap-2 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <span className="flex w-full items-center justify-between gap-2">
                <Icon className="size-4 text-muted-foreground group-hover:text-foreground" />
                <Kbd>{kbdLabel('mod', surface.shortcut)}</Kbd>
              </span>
              <span className="text-xs font-medium text-foreground">{surface.label}</span>
              <span className="text-2xs leading-snug text-muted-foreground">{surface.hint}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function SurfaceContent({
  active,
  openTabs,
}: {
  active: SidebarTab
  openTabs: SidebarTab[]
}): React.JSX.Element {
  const project = useProjectSelectionStore((s) => s.project)

  // Tasks and Search are the two surfaces that do not need a Worktree: Tasks is
  // daemon-wide by design, and Search opens its own scope.
  if (project === null && active !== 'search' && active !== 'tasks') {
    return (
      <p className="p-3 text-sm text-muted-foreground">
        Select a Worktree from Projects to open this surface.
      </p>
    )
  }

  return (
    <div className={cn('min-h-0 flex-1', active === 'files' ? 'overflow-hidden' : 'overflow-auto')}>
      {project && openTabs.includes('files') && (
        <FilesSurface projectPath={project.path} active={active} />
      )}
      {active === 'changes' && <ChangesList />}
      {active === 'review' && (
        <>
          <ReviewGroup />
          <ReviewList />
        </>
      )}
      {active === 'history' && <HistorySurface />}
      {active === 'search' && <SearchList />}
      {active === 'tasks' && <TasksList />}
      {active === 'canvas' && <CanvasList />}
    </div>
  )
}

function HistorySurface(): React.JSX.Element {
  const [tab, setTab] = useState<'history' | 'timeline'>('history')

  return (
    <div className="flex flex-col gap-2">
      <div className="px-2 pt-2">
        <ToggleGroup
          value={[tab]}
          onValueChange={(value: string[]) => {
            const next = value[0]
            if (next === 'history' || next === 'timeline') setTab(next)
          }}
          className="w-full"
        >
          <ToggleGroupItem value="history" size="sm" className="min-w-0 flex-1">
            History
          </ToggleGroupItem>
          <ToggleGroupItem value="timeline" size="sm" className="min-w-0 flex-1">
            File timeline
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      {tab === 'history' ? <HistoryList /> : <FileTimelineGroup />}
    </div>
  )
}

function FilesSurface({
  projectPath,
  active,
}: {
  projectPath: string
  active: SidebarTab
}): React.JSX.Element {
  return (
    <div
      data-slot="files-surface"
      className={cn('flex h-full min-h-0 flex-col', active !== 'files' && 'hidden')}
    >
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        <div className="shrink-0">
          <PinnedGroup compact />
        </div>
        <div className="min-w-0 px-2 pb-2">
          <div className="flex h-6 items-center justify-between">
            <SidebarGroupLabel className="h-6 min-w-0 flex-1 px-1 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
              All Files
            </SidebarGroupLabel>
            <FileSurfaceActions />
          </div>
          <FileTree rootPath={projectPath} />
        </div>
      </div>
    </div>
  )
}

function FileSurfaceActions(): React.JSX.Element {
  const showHidden = useProjectSelectionStore((s) => s.showHidden)
  const toggleShowHidden = useProjectSelectionStore((s) => s.toggleShowHidden)
  const collapseAll = useFileTreeStore((s) => s.collapseAll)

  return (
    <div className="flex shrink-0 items-center">
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={collapseAll}
        aria-label="Collapse all folders"
        title="Collapse all folders"
      >
        <ChevronsDownUp />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={toggleShowHidden}
        aria-label={showHidden ? 'Conceal hidden entries' : 'Show hidden entries'}
        title={showHidden ? 'Conceal hidden entries' : 'Show hidden entries'}
      >
        {showHidden ? <Eye /> : <EyeOff />}
      </Button>
    </div>
  )
}
