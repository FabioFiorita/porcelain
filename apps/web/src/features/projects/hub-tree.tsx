import { groupEquivalentProjects } from '@porcelain/client-runtime/projects'
import type { HubInventory, HubProject, HubWorktree } from '@porcelain/contracts/projects'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { toastUserActionError } from '@renderer/hooks/mutation-error'
import { cn } from '@renderer/lib/utils'
import { useHubSelectionStore } from '@renderer/stores/hub-selection'
import { runUserAction } from '@shared/background'
import { TestIds } from '@shared/test-ids'
import { FolderGit2, GitBranch, Laptop, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  useCreateHubWorktree,
  useHubInventory,
  useOpenProject,
  useSelectedProject,
} from './project-data'

function WorktreeRow(props: {
  worktree: HubWorktree
  openWorktree: (worktree: HubWorktree) => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      data-testid={TestIds.hubWorktree(props.worktree.id)}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-accent/50"
      onClick={() => props.openWorktree(props.worktree)}
    >
      <GitBranch className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 truncate text-sm">{props.worktree.name}</span>
      <span className="truncate font-mono text-2xs text-muted-foreground">
        {props.worktree.branch}
      </span>
    </button>
  )
}

function ProjectBlock(props: {
  project: HubProject
  openWorktree: (worktree: HubWorktree) => void
  openProject: (project: HubProject) => void
  createWorktree: (projectId: string, branch: string) => Promise<void>
  creating: boolean
}): React.JSX.Element {
  const [draft, setDraft] = useState<string | null>(null)

  const submit = (): void => {
    const branch = draft?.trim() ?? ''
    if (branch === '') return
    setDraft(null)
    runUserAction(
      () => props.createWorktree(props.project.id, branch),
      (error) => toastUserActionError('Create worktree', error),
    )
  }

  return (
    <div data-testid={TestIds.hubProject(props.project.id)} className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2 px-2 py-1">
        <FolderGit2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <button
          type="button"
          className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:underline"
          onClick={() => props.openProject(props.project)}
        >
          {props.project.name}
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          data-testid={TestIds.hubCreateWorktree(props.project.id)}
          aria-label={`Create worktree in ${props.project.name}`}
          disabled={props.creating}
          onClick={() => setDraft('')}
        >
          <Plus className="size-3.5" />
        </Button>
      </div>
      {draft !== null && (
        <form
          className="flex items-center gap-1 px-2 pb-1"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="branch name"
            aria-label="New worktree branch"
            className="h-7"
          />
          <Button type="submit" size="sm" disabled={draft.trim() === '' || props.creating}>
            Add
          </Button>
        </form>
      )}
      {props.project.worktrees.map((worktree) => (
        <WorktreeRow key={worktree.id} worktree={worktree} openWorktree={props.openWorktree} />
      ))}
    </div>
  )
}

export function HubTree(props: { className?: string }): React.JSX.Element | null {
  const inventory = useHubInventory()
  const openProject = useOpenProject()
  const createWorktree = useCreateHubWorktree()
  const selectHome = useHubSelectionStore((state) => state.selectHome)
  const selectProject = useHubSelectionStore((state) => state.selectProject)
  const selectWorktree = useHubSelectionStore((state) => state.selectWorktree)
  const selection = useHubSelectionStore((state) => state.selection)
  const selectedProject = useSelectedProject()

  useEffect(() => {
    if (selection.kind !== 'home' || selectedProject === null || inventory === null) return
    for (const project of inventory.projects) {
      const worktree = project.worktrees.find((entry) => entry.path === selectedProject.path)
      if (worktree === undefined) continue
      selectWorktree({
        environmentId: inventory.environment.id,
        projectId: project.id,
        worktreeId: worktree.id,
        path: worktree.path,
        name: worktree.name,
      })
      return
    }
  }, [inventory, selectedProject, selection.kind, selectWorktree])

  if (inventory === null) return null

  const open = (worktree: HubWorktree): void => {
    selectWorktree({
      environmentId: inventory.environment.id,
      projectId: worktree.projectId,
      worktreeId: worktree.id,
      path: worktree.path,
      name: worktree.name,
    })
    runUserAction(
      () => openProject.open(worktree.path),
      (error) => toastUserActionError('Open worktree', error),
    )
  }

  if (inventory.projects.length === 0) {
    return (
      <div
        data-testid={TestIds.hubInventory}
        className={cn('flex w-full max-w-sm flex-col gap-3', props.className)}
      >
        <button
          type="button"
          data-testid={TestIds.hubEnvironment(inventory.environment.id)}
          className="flex items-center gap-2 px-2 text-xs font-medium text-muted-foreground"
          onClick={() => selectHome()}
        >
          <Laptop className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{inventory.environment.name}</span>
        </button>
        <p className="px-2 text-xs text-muted-foreground">
          Open a Git repository to add it to this Environment.
        </p>
      </div>
    )
  }

  return (
    <HubTreeFromInventory
      inventory={inventory}
      className={props.className}
      creating={createWorktree.isPending}
      selectHome={selectHome}
      openWorktree={open}
      openProject={(project) =>
        selectProject({ environmentId: project.environmentId, projectId: project.id })
      }
      createWorktree={async (projectId, branch) => {
        await createWorktree.create({ projectId, branch })
      }}
    />
  )
}

export function HubTreeFromInventory(props: {
  inventory: HubInventory
  openWorktree: (worktree: HubWorktree) => void
  openProject: (project: HubProject) => void
  createWorktree: (projectId: string, branch: string) => Promise<void>
  selectHome?: () => void
  creating?: boolean
  className?: string
}): React.JSX.Element {
  return (
    <div
      data-testid={TestIds.hubInventory}
      className={cn('flex w-full max-w-sm flex-col gap-3', props.className)}
    >
      <button
        type="button"
        data-testid={TestIds.hubEnvironment(props.inventory.environment.id)}
        className="flex items-center gap-2 px-2 text-xs font-medium text-muted-foreground hover:underline"
        onClick={() => props.selectHome?.()}
      >
        <Laptop className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">{props.inventory.environment.name}</span>
      </button>
      {groupEquivalentProjects([props.inventory]).flatMap((group) =>
        group.members.map((member) => (
          <ProjectBlock
            key={member.project.id}
            project={member.project}
            openWorktree={props.openWorktree}
            openProject={props.openProject}
            createWorktree={props.createWorktree}
            creating={props.creating === true}
          />
        )),
      )}
    </div>
  )
}
