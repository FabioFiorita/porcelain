import {
  ChevronRightIcon,
  CircleAlertIcon,
  FolderIcon,
  GitBranchIcon,
  GitCommitHorizontalIcon,
  HouseIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  type Project,
  projectPath,
  worktreeLabel,
} from '../../domain/inventory';

export function ProjectNavigator({
  projects,
  selected,
  onSelect,
}: {
  projects: Project[];
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
    <nav aria-label="Projects and worktrees" className="min-w-0 px-2 pb-2">
      <SidebarMenu className="gap-1">
        {projects.map((project) => {
          const path = projectPath(project);
          return (
            <SidebarMenuItem key={project.id}>
              <Collapsible defaultOpen className="group/project">
                <h3 aria-label={project.name}>
                  <CollapsibleTrigger
                    render={<SidebarMenuButton />}
                    className="h-7 gap-1.5 rounded-md px-1.5"
                    title={project.name}
                    aria-label={project.name}
                  >
                    <FolderIcon aria-hidden="true" className="size-3.5" />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {project.name}
                    </span>
                    {!project.available ? (
                      <CircleAlertIcon
                        aria-label="Project unavailable"
                        className="size-3.5"
                      />
                    ) : (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {project.worktrees.length}
                      </span>
                    )}
                    <ChevronRightIcon
                      aria-hidden="true"
                      className="size-3.5 transition-transform motion-reduce:transition-none group-data-open/project:rotate-90"
                    />
                  </CollapsibleTrigger>
                </h3>
                <CollapsibleContent>
                  {path && (
                    <p
                      className="truncate pb-1 pl-8 font-mono text-[10px] text-muted-foreground"
                      title={path}
                    >
                      {path}
                    </p>
                  )}
                  <SidebarMenu className="ml-2 w-[calc(100%-0.5rem)] gap-0.5 border-l pl-2">
                    {!project.worktrees.length && (
                      <li className="px-2 py-2 text-[11px] text-muted-foreground">
                        No worktrees found.
                      </li>
                    )}
                    {project.worktrees.map((worktree) => {
                      const Icon = worktree.main
                        ? HouseIcon
                        : worktree.branch === null
                          ? GitCommitHorizontalIcon
                          : GitBranchIcon;
                      return (
                        <SidebarMenuItem key={worktree.id}>
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <SidebarMenuButton
                                  size="sm"
                                  isActive={selected === worktree.id}
                                />
                              }
                              aria-pressed={selected === worktree.id}
                              onClick={() => onSelect(worktree.id)}
                              className="workspace-choice relative h-auto min-h-8 gap-1.5 rounded-md py-1"
                            >
                              <Icon aria-hidden="true" className="size-3.5" />
                              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className="truncate text-xs">
                                  {worktreeLabel(worktree.branch)}
                                </span>
                                <span className="sr-only">{worktree.path}</span>
                                {!worktree.available && (
                                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                    <CircleAlertIcon className="size-3" />
                                    Unavailable
                                  </span>
                                )}
                              </span>
                              {worktree.main && (
                                <Badge
                                  variant="secondary"
                                  className="h-4 min-w-4 shrink-0 justify-center px-1 text-[10px]"
                                >
                                  Main<span className="sr-only"> worktree</span>
                                </Badge>
                              )}
                            </TooltipTrigger>
                            <TooltipContent
                              side="right"
                              className="max-w-80 break-all"
                            >
                              <span>
                                {worktreeLabel(worktree.branch)}
                                <br />
                                {worktree.path}
                              </span>
                            </TooltipContent>
                          </Tooltip>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </CollapsibleContent>
              </Collapsible>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </nav>
  );
}
