import type { HubWorktree } from '@porcelain/contracts/projects'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'
import { useHubInventories, useOpenHubWorktree } from '@renderer/features/projects'
import { useHubSelectionStore } from '@renderer/stores/hub-selection'
import { TestIds } from '@shared/test-ids'

/**
 * Which checkout a project-scoped Settings page is about — and the control that changes it.
 *
 * A project-scoped page that silently follows the Hub selection cannot say what it is
 * showing you, which is the whole complaint: "Personalization" named no project. Choosing
 * another one opens it, exactly as the Hub tree does (`useOpenHubWorktree`), because a
 * profile lives on the daemon that owns the checkout — reading one from a machine this
 * window is not on would be a second, quieter way to be wrong about scope.
 *
 * Grouped by Environment on purpose: two machines can hold repositories with the same name,
 * and the group heading is what tells them apart.
 */
export function ProjectScopePicker(): React.JSX.Element | null {
  const inventories = useHubInventories()
  const open = useOpenHubWorktree()
  const selection = useHubSelectionStore((state) => state.selection)

  const rows = inventories.flatMap((source) =>
    source.inventory.projects.flatMap((project) =>
      project.worktrees.map((worktree) => ({ source, project, worktree })),
    ),
  )
  if (rows.length === 0) return null

  const rowValue = (row: (typeof rows)[number]): string =>
    `${row.source.inventory.environment.id}:${row.project.id}:${row.worktree.id}`
  const selectedValue =
    selection.kind === 'worktree'
      ? `${selection.environmentId}:${selection.projectId}:${selection.worktreeId}`
      : null

  const choose = (value: string): void => {
    const row = rows.find((entry) => rowValue(entry) === value)
    if (row === undefined || value === selectedValue) return
    open(row.source, row.worktree)
  }

  const label = (worktree: HubWorktree, projectName: string): string =>
    worktree.isPrimary ? projectName : `${projectName} · ${worktree.name}`

  return (
    <Select
      // `items` is what makes the trigger read as a name: without it Base UI renders the
      // raw value, and these values are worktree UUIDs.
      items={rows.map((row) => ({
        label: label(row.worktree, row.project.name),
        value: rowValue(row),
      }))}
      value={selectedValue ?? undefined}
      onValueChange={(value: string | null): void => {
        if (value !== null) choose(value)
      }}
    >
      <SelectTrigger
        className="h-8 w-full text-sm-minus"
        data-testid={TestIds.settingsProjectScope}
      >
        <SelectValue placeholder="Choose a project" />
      </SelectTrigger>
      <SelectContent>
        {inventories.map((source) => (
          <SelectGroup key={source.inventory.environment.id}>
            <SelectLabel>{source.inventory.environment.name}</SelectLabel>
            {source.inventory.projects.flatMap((project) =>
              project.worktrees.map((worktree) => (
                <SelectItem
                  key={`${source.inventory.environment.id}:${project.id}:${worktree.id}`}
                  value={`${source.inventory.environment.id}:${project.id}:${worktree.id}`}
                >
                  {label(worktree, project.name)}
                </SelectItem>
              )),
            )}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}
