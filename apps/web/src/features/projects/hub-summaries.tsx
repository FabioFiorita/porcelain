import type { HubInventory, HubProject } from '@porcelain/contracts/projects'
import { useHubSelectionStore } from '@renderer/stores/hub-selection'
import { TestIds } from '@shared/test-ids'
import { FolderGit2, GitBranch, Laptop } from 'lucide-react'
import { useHubInventories } from './project-data'

function EnvironmentBlock(props: { inventory: HubInventory }): React.JSX.Element {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Laptop className="size-3.5 text-muted-foreground" aria-hidden />
        {props.inventory.environment.name}
      </div>
      {props.inventory.projects.length === 0 ? (
        <p className="text-xs text-muted-foreground">No Projects on this Environment.</p>
      ) : (
        props.inventory.projects.map((project) => (
          <ProjectLine key={project.id} project={project} />
        ))
      )}
    </section>
  )
}

function ProjectLine(props: { project: HubProject }): React.JSX.Element {
  const selectProject = useHubSelectionStore((state) => state.selectProject)
  const selectWorktree = useHubSelectionStore((state) => state.selectWorktree)
  return (
    <div className="flex flex-col gap-1 pl-5">
      <button
        type="button"
        className="flex items-center gap-2 rounded-md px-1 py-0.5 text-left text-sm hover:bg-accent/50"
        onClick={() =>
          selectProject({ environmentId: props.project.environmentId, projectId: props.project.id })
        }
      >
        <FolderGit2 className="size-3.5 text-muted-foreground" aria-hidden />
        <span className="truncate">{props.project.name}</span>
        <span className="text-2xs text-muted-foreground">
          {props.project.worktrees.length} worktree{props.project.worktrees.length === 1 ? '' : 's'}
        </span>
      </button>
      {props.project.worktrees.map((worktree) => (
        <button
          key={worktree.id}
          type="button"
          className="flex items-center gap-2 rounded-md px-2 py-1 text-left text-xs hover:bg-accent/50"
          onClick={() =>
            selectWorktree({
              environmentId: props.project.environmentId,
              projectId: props.project.id,
              worktreeId: worktree.id,
              path: worktree.path,
              name: worktree.name,
            })
          }
        >
          <GitBranch className="size-3.5 text-muted-foreground" aria-hidden />
          <span className="truncate">{worktree.name}</span>
          <span className="truncate font-mono text-2xs text-muted-foreground">
            {worktree.branch}
          </span>
        </button>
      ))}
    </div>
  )
}

export function HubHomeSummary(): React.JSX.Element {
  const inventories = useHubInventories()
  return (
    <div data-testid={TestIds.hubHome} className="mx-auto flex max-w-lg flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-xl font-medium tracking-tight">Home</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connected Environments and their Projects. Select a Worktree to inspect files, diffs, and
          terminals.
        </p>
      </div>
      {inventories.length === 0 ? (
        <p className="text-sm text-muted-foreground">No Environments are online.</p>
      ) : (
        inventories.map((inventory) => (
          <EnvironmentBlock
            key={inventory.inventory.environment.id}
            inventory={inventory.inventory}
          />
        ))
      )}
    </div>
  )
}

export function HubProjectSummary(): React.JSX.Element {
  const selection = useHubSelectionStore((state) => state.selection)
  const inventories = useHubInventories()
  const inventory =
    selection.kind === 'project'
      ? (inventories.find((source) => source.inventory.environment.id === selection.environmentId)
          ?.inventory ?? null)
      : null
  const project =
    selection.kind === 'project'
      ? (inventory?.projects.find((entry) => entry.id === selection.projectId) ?? null)
      : null

  return (
    <div
      data-testid={TestIds.hubProjectSummary}
      className="mx-auto flex max-w-lg flex-col gap-6 px-6 py-10"
    >
      <div>
        <h1 className="text-xl font-medium tracking-tight">{project?.name ?? 'Project'}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {project === null
            ? 'This Project is not in the live inventory.'
            : `${project.worktrees.length} Worktree${project.worktrees.length === 1 ? '' : 's'} on ${inventory?.environment.name ?? 'this Environment'}.`}
        </p>
      </div>
      {project !== null && <ProjectLine project={project} />}
    </div>
  )
}
