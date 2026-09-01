import { groupEquivalentProjects } from '@porcelain/client-runtime/projects'
import type {
  CreateHubWorktreeInput,
  HubInventory,
  HubProject,
  HubWorktree,
  RemoveHubWorktreeInput,
} from '@porcelain/contracts/projects'
import { SwitchBranchDialog } from '@renderer/components/git/branch-switcher'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@renderer/components/ui/alert-dialog'
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
import { cn, copyText } from '@renderer/lib/utils'
import { useHubSelectionStore } from '@renderer/stores/hub-selection'
import { usePersonalizationStore } from '@renderer/stores/personalization'
import { useWorktreeScriptsStore } from '@renderer/stores/worktree-scripts'
import { runUserAction } from '@shared/background'
import { TestIds } from '@shared/test-ids'
import { ChevronDown, Copy, FolderGit2, GitBranch, GitBranchPlus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { CreateWorktreeDialog } from './create-worktree-dialog'
import type { HubInventoryView } from './project-data'

function WorktreeRow(props: {
  worktree: HubWorktree
  environmentId: string
  mutationEnvironmentId: string | null
  projectId: string
  mutable: boolean
  openWorktree: (worktree: HubWorktree) => void
  removeWorktree: (
    input: RemoveHubWorktreeInput & { environmentId?: string | null },
  ) => Promise<void>
}): React.JSX.Element {
  const selection = useHubSelectionStore((state) => state.selection)
  const selected =
    selection.kind === 'worktree' &&
    selection.environmentId === props.environmentId &&
    selection.projectId === props.projectId &&
    selection.worktreeId === props.worktree.id
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [switchOpen, setSwitchOpen] = useState(false)

  const copy = (label: string, value: string): void => {
    runUserAction(
      () => copyText(value),
      (error) => toastUserActionError(label, error),
    )
  }

  // Removing a Worktree takes its checkout off the disk, so the selection can be left
  // pointing at a directory that is gone — send it home when it was this one.
  const remove = (): void => {
    setConfirmOpen(false)
    runUserAction(
      async () => {
        await props.removeWorktree({
          projectId: props.projectId,
          worktreeId: props.worktree.id,
          force: true,
          environmentId: props.mutationEnvironmentId,
        })
        const current = useHubSelectionStore.getState().selection
        if (
          current.kind === 'worktree' &&
          current.environmentId === props.environmentId &&
          current.projectId === props.projectId &&
          current.worktreeId === props.worktree.id
        ) {
          useHubSelectionStore.getState().selectHome()
        }
      },
      (error) => toastUserActionError('Remove worktree', error),
    )
  }

  // The primary checkout is the Project itself: git refuses to remove it, and offering the
  // item anyway would only ever produce an error toast.
  const removable = !props.worktree.isPrimary

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
          {props.mutable && (
            <ContextMenuItem
              onClick={() => {
                props.openWorktree(props.worktree)
                setSwitchOpen(true)
              }}
            >
              <GitBranch />
              Switch branch…
            </ContextMenuItem>
          )}
          <ContextMenuItem onClick={() => copy('Copy worktree name', props.worktree.name)}>
            <Copy />
            Copy name
          </ContextMenuItem>
          <ContextMenuItem onClick={() => copy('Copy worktree path', props.worktree.path)}>
            <Copy />
            Copy path
          </ContextMenuItem>
          {removable && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                variant="destructive"
                data-testid={TestIds.hubRemoveWorktree(props.worktree.id)}
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 />
                Remove worktree…
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
      {/* Sibling of the menu, never a child: a closing menu unmounts its content, and a
          dialog mounted inside it would close in the same frame it was asked to open. */}
      {switchOpen && (
        <SwitchBranchDialog
          open={switchOpen}
          currentBranch={props.worktree.branch}
          repoPath={props.worktree.path}
          onOpenChange={setSwitchOpen}
        />
      )}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent data-testid={TestIds.hubRemoveWorktreeDialog}>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove worktree {props.worktree.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Deletes the checkout at {props.worktree.path}, along with any uncommitted work in it.
              The branch and the repository stay.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              data-testid={TestIds.hubRemoveWorktreeConfirm}
              onClick={remove}
            >
              Remove worktree
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function ProjectBlock(props: {
  project: HubProject
  environmentId: string
  environmentName: string
  mutationEnvironmentId: string | null
  mutable: boolean
  openWorktree: (worktree: HubWorktree) => void
  createWorktree: (
    input: CreateHubWorktreeInput & { environmentId?: string | null },
  ) => Promise<HubWorktree>
  removeProject: (projectId: string, environmentId?: string | null) => Promise<void>
  removeWorktree: (
    input: RemoveHubWorktreeInput & { environmentId?: string | null },
  ) => Promise<void>
  showEnvironment: boolean
  creating: boolean
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const selectProject = useHubSelectionStore((state) => state.selectProject)
  const openWorktreeScripts = useWorktreeScriptsStore((state) => state.open)
  const openPersonalization = usePersonalizationStore((state) => state.open)

  const copyProjectPath = (): void => {
    runUserAction(
      () => copyText(props.project.path),
      (error) => toastUserActionError('Copy project path', error),
    )
  }

  const removeProject = (): void => {
    runUserAction(
      async () => {
        await props.removeProject(props.project.id, props.environmentId)
        const current = useHubSelectionStore.getState().selection
        if (
          current.kind !== 'home' &&
          current.environmentId === props.environmentId &&
          current.projectId === props.project.id
        ) {
          useHubSelectionStore.getState().selectHome()
        }
      },
      (error) => toastUserActionError('Remove project', error),
    )
  }

  /**
   * Create, then open. The daemon starts the Project's setup scripts in a terminal owned by
   * the new checkout, and terminals are listed per open checkout — so opening the Worktree is
   * what puts the human in front of the install they just triggered.
   */
  const createWorktree = async (input: CreateHubWorktreeInput): Promise<HubWorktree> => {
    const worktree = await props.createWorktree({ ...input, environmentId: props.environmentId })
    props.openWorktree(worktree)
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
              onClick={() =>
                selectProject({ environmentId: props.environmentId, projectId: props.project.id })
              }
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
              {props.showEnvironment && (
                <Badge
                  variant="outline"
                  className="max-w-24 rounded-md border-border/60 bg-muted/30 px-1.5 text-2xs font-medium text-muted-foreground"
                >
                  {props.environmentName}
                </Badge>
              )}
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
          {/* The lifecycle scripts belong to this Project, and this row is where a human
              picks a Project — so this is where they are edited, not at the bottom of the
              menu of commands you click. */}
          <ContextMenuItem
            data-testid={TestIds.hubWorktreeScripts(props.project.id)}
            onClick={() =>
              openWorktreeScripts({
                projectId: props.project.id,
                projectName: props.project.name,
                environmentId: props.environmentId,
                editable: props.mutable,
              })
            }
          >
            Worktree scripts…
          </ContextMenuItem>
          <ContextMenuItem
            data-testid={TestIds.hubPersonalization(props.project.id)}
            onClick={() =>
              openPersonalization({
                projectId: props.project.id,
                projectName: props.project.name,
                projectPath: props.project.path,
                environmentId: props.environmentId,
              })
            }
          >
            Personalization
          </ContextMenuItem>
          <ContextMenuItem onClick={copyProjectPath}>Copy project path</ContextMenuItem>
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
            mutationEnvironmentId={props.mutationEnvironmentId}
            projectId={props.project.id}
            mutable={props.mutable}
            openWorktree={props.openWorktree}
            removeWorktree={props.removeWorktree}
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
    </Collapsible>
  )
}

export function HubTreeFromInventory(props: {
  inventory: HubInventory
  openWorktree: (worktree: HubWorktree) => void
  createWorktree: (
    input: CreateHubWorktreeInput & { environmentId?: string | null },
  ) => Promise<HubWorktree>
  removeProject: (projectId: string, environmentId?: string | null) => Promise<void>
  removeWorktree: (
    input: RemoveHubWorktreeInput & { environmentId?: string | null },
  ) => Promise<void>
  creating?: boolean
  className?: string
}): React.JSX.Element {
  return (
    <HubTreeFromInventories
      sources={[{ environmentId: null, current: true, inventory: props.inventory }]}
      openWorktree={(_source, worktree) => props.openWorktree(worktree)}
      createWorktree={props.createWorktree}
      removeProject={props.removeProject}
      removeWorktree={props.removeWorktree}
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
  removeWorktree: (
    input: RemoveHubWorktreeInput & { environmentId?: string | null },
  ) => Promise<void>
  creating?: boolean
  className?: string
}): React.JSX.Element {
  const sourceByEnvironment = new Map(
    props.sources.map((source) => [source.inventory.environment.id, source] as const),
  )
  const groups = groupEquivalentProjects(props.sources.map((source) => source.inventory))
  // The Environment is only worth naming when there is more than one to tell apart. A
  // browser client is served by exactly one daemon, so the badge there repeated the host
  // name on every row and told the reader nothing.
  const showEnvironment = props.sources.length > 1

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
                mutationEnvironmentId={source.current ? null : member.environment.id}
                mutable={source.current}
                openWorktree={(worktree) => props.openWorktree(source, worktree)}
                createWorktree={props.createWorktree}
                removeProject={props.removeProject}
                removeWorktree={props.removeWorktree}
                showEnvironment={showEnvironment}
                creating={props.creating === true}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}
