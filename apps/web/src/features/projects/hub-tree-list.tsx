import { groupEquivalentProjects } from '@porcelain/client-runtime/projects'
import type {
  CreateHubWorktreeInput,
  HubInventory,
  HubProject,
  HubWorktree,
} from '@porcelain/contracts/projects'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@renderer/components/ui/collapsible'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@renderer/components/ui/context-menu'
import { toastUserActionError } from '@renderer/hooks/mutation-error'
import { spawnTerminalAt } from '@renderer/lib/terminal-actions'
import { cn, copyText } from '@renderer/lib/utils'
import { useHubSelectionStore } from '@renderer/stores/hub-selection'
import { EMPTY_WORKTREE_SETUP, useWorktreeSetupStore } from '@renderer/stores/worktree-setup'
import { runUserAction } from '@shared/background'
import { TestIds } from '@shared/test-ids'
import {
  ChevronDown,
  Copy,
  FolderGit2,
  GitBranch,
  GitBranchPlus,
  Settings2,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { CreateWorktreeDialog } from './create-worktree-dialog'
import type { HubInventoryView } from './project-data'
import { WorktreeSetupDialog } from './worktree-setup-dialog'

function WorktreeRow(props: {
  worktree: HubWorktree
  environmentId: string
  projectId: string
  openWorktree: (worktree: HubWorktree) => void
}): React.JSX.Element {
  const selection = useHubSelectionStore((state) => state.selection)
  const selected = selection.kind === 'worktree' && selection.worktreeId === props.worktree.id

  const copy = (label: string, value: string): void => {
    runUserAction(
      () => copyText(value),
      (error) => toastUserActionError(label, error),
    )
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <button
              type="button"
              data-testid={TestIds.hubWorktree(props.worktree.id)}
              data-hub-environment={props.environmentId}
              data-hub-project={props.projectId}
              aria-current={selected ? 'page' : undefined}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent/50',
                selected && 'bg-accent/60',
              )}
              onClick={() => props.openWorktree(props.worktree)}
            />
          }
        >
          <GitBranch className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-mono text-xs">{props.worktree.branch}</span>
            {props.worktree.name !== props.worktree.branch && (
              <span className="truncate text-2xs text-muted-foreground">{props.worktree.name}</span>
            )}
          </span>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => copy('Copy worktree name', props.worktree.name)}>
            <Copy />
            Copy name
          </ContextMenuItem>
          <ContextMenuItem onClick={() => copy('Copy worktree path', props.worktree.path)}>
            <Copy />
            Copy path
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </>
  )
}

function ProjectBlock(props: {
  project: HubProject
  environmentId: string
  environmentName: string
  mutable: boolean
  openWorktree: (worktree: HubWorktree) => void
  createWorktree: (input: CreateHubWorktreeInput) => Promise<HubWorktree>
  removeProject: (projectId: string) => Promise<void>
  creating: boolean
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)
  const setup = useWorktreeSetupStore(
    (state) => state.setups[props.project.id] ?? EMPTY_WORKTREE_SETUP,
  )
  const setSetup = useWorktreeSetupStore((state) => state.setSetup)

  const copyProjectPath = (): void => {
    runUserAction(
      () => copyText(props.project.path),
      (error) => toastUserActionError('Copy project path', error),
    )
  }

  const removeProject = (): void => {
    runUserAction(
      async () => {
        await props.removeProject(props.project.id)
        const current = useHubSelectionStore.getState().selection
        if (current.kind !== 'home' && current.projectId === props.project.id) {
          useHubSelectionStore.getState().selectHome()
        }
      },
      (error) => toastUserActionError('Remove project', error),
    )
  }

  const createWorktree = async (input: CreateHubWorktreeInput): Promise<HubWorktree> => {
    const worktree = await props.createWorktree(input)
    const startScript = setup.startScript.trim()
    if (startScript !== '') {
      await spawnTerminalAt(worktree.path, {
        name: `Setup · ${props.project.name}`,
        initialInput: `${startScript}\n`,
      })
    }
    return worktree
  }

  return (
    <Collapsible
      data-testid={TestIds.hubProject(props.project.id)}
      open={expanded}
      onOpenChange={setExpanded}
      className="flex flex-col"
    >
      <ContextMenu>
        <ContextMenuTrigger>
          <div className="flex items-center gap-1 px-1">
            <CollapsibleTrigger
              aria-expanded={expanded}
              aria-label={`${expanded ? 'Collapse' : 'Expand'} project ${props.project.name}`}
              className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 py-1 text-left hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <ChevronDown
                className={cn('size-3.5 shrink-0 text-muted-foreground', !expanded && '-rotate-90')}
                aria-hidden
              />
              <FolderGit2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 truncate text-sm font-medium">{props.project.name}</span>
              <span className="shrink-0 text-2xs tabular-nums text-muted-foreground/70">
                {props.project.worktrees.length}
              </span>
              <Badge
                variant="outline"
                className="max-w-24 rounded-md border-border/60 bg-muted/30 px-1.5 text-2xs font-medium text-muted-foreground"
              >
                {props.environmentName}
              </Badge>
            </CollapsibleTrigger>
            {props.mutable && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                data-testid={TestIds.hubCreateWorktree(props.project.id)}
                aria-label={`Create branch and worktree in ${props.project.name}`}
                disabled={props.creating}
                onClick={() => setCreateOpen(true)}
              >
                <GitBranchPlus className="size-3.5" />
              </Button>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {props.mutable && (
            <ContextMenuItem onClick={() => setSetupOpen(true)}>
              <Settings2 />
              Configure worktree setup
            </ContextMenuItem>
          )}
          <ContextMenuItem onClick={copyProjectPath}>
            <Copy />
            Copy project path
          </ContextMenuItem>
          {props.mutable && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem variant="destructive" onClick={removeProject}>
                <Trash2 />
                Remove project
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
      <CollapsibleContent className="ml-3 mt-1 flex flex-col gap-0.5 border-l border-border/60 pl-2">
        {props.project.worktrees.map((worktree) => (
          <WorktreeRow
            key={worktree.id}
            worktree={worktree}
            environmentId={props.environmentId}
            projectId={props.project.id}
            openWorktree={props.openWorktree}
          />
        ))}
      </CollapsibleContent>
      {createOpen && (
        <CreateWorktreeDialog
          project={props.project}
          open={createOpen}
          creating={props.creating}
          onOpenChange={setCreateOpen}
          createWorktree={createWorktree}
        />
      )}
      {setupOpen && (
        <WorktreeSetupDialog
          projectName={props.project.name}
          setup={setup}
          open={setupOpen}
          onOpenChange={setSetupOpen}
          onSave={(next) => setSetup(props.project.id, next)}
        />
      )}
    </Collapsible>
  )
}

export function HubTreeFromInventory(props: {
  inventory: HubInventory
  openWorktree: (worktree: HubWorktree) => void
  createWorktree: (input: CreateHubWorktreeInput) => Promise<HubWorktree>
  removeProject: (projectId: string) => Promise<void>
  creating?: boolean
  className?: string
}): React.JSX.Element {
  return (
    <HubTreeFromInventories
      sources={[{ environmentId: null, current: true, inventory: props.inventory }]}
      openWorktree={(_source, worktree) => props.openWorktree(worktree)}
      createWorktree={props.createWorktree}
      removeProject={props.removeProject}
      creating={props.creating}
      className={props.className}
    />
  )
}

export function HubTreeFromInventories(props: {
  sources: readonly HubInventoryView[]
  openWorktree: (source: HubInventoryView, worktree: HubWorktree) => void
  createWorktree: (input: CreateHubWorktreeInput) => Promise<HubWorktree>
  removeProject: (projectId: string) => Promise<void>
  creating?: boolean
  className?: string
}): React.JSX.Element {
  const sourceByEnvironment = new Map(
    props.sources.map((source) => [source.inventory.environment.id, source] as const),
  )
  const groups = groupEquivalentProjects(props.sources.map((source) => source.inventory))

  return (
    <div
      data-testid={TestIds.hubInventory}
      className={cn('flex w-full max-w-sm flex-col gap-3', props.className)}
    >
      {groups.map((group) => (
        <div key={group.groupingKey} className="flex flex-col gap-1">
          {group.members.map((member) => {
            const source = sourceByEnvironment.get(member.environment.id)
            if (source === undefined) return null
            return (
              <ProjectBlock
                key={`${member.environment.id}:${member.project.id}`}
                project={member.project}
                environmentId={member.environment.id}
                environmentName={member.environment.name}
                mutable={source.current}
                openWorktree={(worktree) => props.openWorktree(source, worktree)}
                createWorktree={props.createWorktree}
                removeProject={props.removeProject}
                creating={props.creating === true}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}
