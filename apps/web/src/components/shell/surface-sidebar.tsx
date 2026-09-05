import { ChangesList } from '@renderer/components/git/changes-list'
import { HistoryList } from '@renderer/components/git/history-list'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { Shortcut } from '@renderer/components/ui/kbd'
import { SidebarGroupLabel } from '@renderer/components/ui/sidebar'
import { ToggleGroup, ToggleGroupItem } from '@renderer/components/ui/toggle-group'
import { useFilesCut } from '@renderer/features/files'
import { CanvasList } from '@renderer/features/projects'
import { toastUserActionError } from '@renderer/hooks/mutation-error'
import { surfaceListInsetClass } from '@renderer/lib/controls'
import { cn } from '@renderer/lib/utils'
import { useFilePromptStore } from '@renderer/stores/file-prompt'
import { useFileTreeStore } from '@renderer/stores/file-tree'
import type { SidebarTab } from '@renderer/stores/preferences'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { runUserAction } from '@shared/background'
import { TestIds } from '@shared/test-ids'
import {
  ChevronsDownUp,
  ClipboardPaste,
  Eye,
  EyeOff,
  FilePlus,
  FileText,
  FolderPlus,
  GitCommitHorizontal,
  GitCompareArrows,
  History,
  LayoutPanelTop,
  Plus,
} from 'lucide-react'
import { useState } from 'react'
import { CommitGroup } from './commit-group'
import { FileTimelineGroup } from './file-timeline-group'
import { FileTree } from './file-tree'
import { FileTreeRootDrop } from './file-tree-drag'
import { PinnedGroup } from './pinned-group'
import { QuickCommandsGroup } from './quick-commands-group'
import { RevealActiveFile } from './reveal-active-file'

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
    id: 'git',
    label: 'Git',
    hint: 'Commands, suggestions, and commit',
    shortcut: '3',
    icon: GitCommitHorizontal,
  },
  {
    id: 'history',
    label: 'History',
    hint: 'Inspect commit history',
    shortcut: '4',
    icon: History,
  },
  {
    id: 'canvas',
    label: 'Canvas',
    hint: 'Agent-authored explanation for this Project',
    shortcut: '5',
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
                <Shortcut tokens={['mod', surface.shortcut]} />
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

  if (project === null) {
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
      {active === 'history' && <HistorySurface />}
      {active === 'git' && <GitSurface />}
      {active === 'canvas' && <CanvasList />}
    </div>
  )
}

function GitSurface(): React.JSX.Element {
  return (
    <div className={surfaceListInsetClass}>
      <QuickCommandsGroup />
      <CommitGroup />
    </div>
  )
}

function HistorySurface(): React.JSX.Element {
  const [tab, setTab] = useState<'history' | 'timeline'>('history')

  return (
    <div className="flex flex-col gap-2">
      <div className={surfaceListInsetClass}>
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
        <div className="relative min-w-0 px-2 pb-2">
          <div className="flex h-6 items-center justify-between">
            <SidebarGroupLabel className="h-6 min-w-0 flex-1 px-1 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
              All Files
            </SidebarGroupLabel>
            <FileSurfaceActions rootPath={projectPath} />
          </div>
          <FileTreeRootDrop rootPath={projectPath} />
          <FileTree rootPath={projectPath} />
        </div>
      </div>
    </div>
  )
}

function FileSurfaceActions({ rootPath }: { rootPath: string }): React.JSX.Element {
  const { paste, canPaste } = useFilesCut()
  const newFile = useFilePromptStore((s) => s.newFile)
  const newFolder = useFilePromptStore((s) => s.newFolder)
  const showHidden = useProjectSelectionStore((s) => s.showHidden)
  const toggleShowHidden = useProjectSelectionStore((s) => s.toggleShowHidden)
  const collapseAll = useFileTreeStore((s) => s.collapseAll)

  return (
    <div className="flex shrink-0 items-center">
      <RevealActiveFile rootPath={rootPath} />
      {canPaste && (
        <Button
          variant="ghost"
          size="icon-xs"
          title="Paste at root"
          aria-label="Paste at root"
          data-testid="files-paste-root"
          onClick={() =>
            runUserAction(
              () => paste(rootPath),
              (error) => toastUserActionError('Move', error),
            )
          }
        >
          <ClipboardPaste />
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Create at root"
              title="Create at root"
              data-testid="files-create-menu"
            >
              <Plus />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => newFile(rootPath)} data-testid="files-new-root-file">
            <FilePlus /> Create file
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => newFolder(rootPath)} data-testid="files-new-root-folder">
            <FolderPlus /> Create folder
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={collapseAll}
        className="transition-transform active:scale-90"
        aria-label="Collapse all folders"
        title="Collapse all folders"
      >
        <ChevronsDownUp />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={toggleShowHidden}
        aria-pressed={showHidden}
        className="transition-transform active:scale-90"
        aria-label={showHidden ? 'Conceal hidden entries' : 'Show hidden entries'}
        title={showHidden ? 'Conceal hidden entries' : 'Show hidden entries'}
      >
        <span key={String(showHidden)} className="animate-in fade-in zoom-in-75 duration-150">
          {showHidden ? <Eye /> : <EyeOff />}
        </span>
      </Button>
    </div>
  )
}
