import { TestIds } from '@shared/test-ids'

/** Pins and hides stay manual in the file tree; review order belongs to each Review Canvas. */
export function PersonalizationSection({ repoPath }: { repoPath: string }): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        Pins and hidden paths are project-wide choices you make directly in the Files tree.
        Porcelain preserves them across this project.
      </p>
      <section
        className="flex flex-col gap-2 rounded-md bg-card p-3"
        data-testid={TestIds.personalizationAgentBuilt}
      >
        <p className="text-sm-minus font-medium">Story order is built into each Review</p>
        <p className="text-xs text-muted-foreground">
          When you ask an agent to use Porcelain, the companion skill can create or update the
          Review Canvas and arrange its layers for that change. There is no prompt to copy back to
          the agent.
        </p>
      </section>
      <p className="truncate font-mono text-2xs text-muted-foreground" title={repoPath}>
        {repoPath}
      </p>
    </div>
  )
}
