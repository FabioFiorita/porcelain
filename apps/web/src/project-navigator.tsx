import type { ProjectResponse } from '@porcelain/contracts/inventory';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from './components/ui/empty';

export function ProjectNavigator({
  projects,
  selected,
  onSelect,
}: {
  projects: ProjectResponse[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  if (!projects.length)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No projects registered</EmptyTitle>
          <EmptyDescription>
            This environment has no projects yet.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  return (
    <nav
      aria-label="Projects and worktrees"
      className="flex min-w-0 flex-col gap-6"
    >
      {projects.map((project) => (
        <section key={project.id} className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-all font-medium">{project.name}</h3>
            {!project.available && <Badge variant="outline">Unavailable</Badge>}
          </div>
          {!project.worktrees.length && (
            <p className="text-sm text-muted-foreground">No worktrees found.</p>
          )}
          {project.worktrees.map((worktree) => (
            <Button
              key={worktree.id}
              variant={selected === worktree.id ? 'secondary' : 'ghost'}
              className="h-auto w-full justify-start whitespace-normal text-left"
              aria-pressed={selected === worktree.id}
              onClick={() => onSelect(worktree.id)}
            >
              <span className="flex min-w-0 flex-col gap-1">
                <span className="break-all">
                  {worktree.branch?.replace(/^refs\/heads\//, '') ??
                    'Detached HEAD'}
                  {worktree.main ? ' · main worktree' : ''}
                </span>
                <span className="break-all text-xs">{worktree.path}</span>
                {!worktree.available && <span>Unavailable</span>}
              </span>
            </Button>
          ))}
        </section>
      ))}
    </nav>
  );
}
