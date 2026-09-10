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
import { type Project, worktreeLabel } from '../../domain/inventory';

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
      <SidebarMenu className="gap-2">
        {projects.map((project) => (
          <SidebarMenuItem key={project.id}>
            <Collapsible defaultOpen className="group/project">
              <h3 aria-label={project.name}>
                <CollapsibleTrigger
                  render={<SidebarMenuButton />}
                  className="h-8"
                  title={project.name}
                  aria-label={project.name}
                >
                  <FolderIcon aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {project.name}
                  </span>
                  {!project.available ? (
                    <CircleAlertIcon aria-label="Project unavailable" />
                  ) : (
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {project.worktrees.length}
                    </span>
                  )}
                  <ChevronRightIcon
                    aria-hidden="true"
                    className="transition-transform group-data-open/project:rotate-90 motion-reduce:transition-none"
                  />
                </CollapsibleTrigger>
              </h3>
              <CollapsibleContent>
                <SidebarMenu className="gap-0.5 pl-2 ml-2 w-[calc(100%-0.5rem)]">
                  {!project.worktrees.length && (
                    <li className="px-3 py-3 text-xs text-muted-foreground">
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
                                size="default"
                                isActive={selected === worktree.id}
                              />
                            }
                            aria-pressed={selected === worktree.id}
                            onClick={() => onSelect(worktree.id)}
                            className="workspace-choice relative h-auto min-h-11 gap-2 rounded-lg py-1.5"
                          >
                            <Icon aria-hidden="true" />
                            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <span className="truncate text-sm">
                                {worktreeLabel(worktree.branch)}
                              </span>
                              <span className="truncate text-xs text-muted-foreground">
                                {worktree.path}
                              </span>
                              {!worktree.available && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <CircleAlertIcon />
                                  Unavailable
                                </span>
                              )}
                            </span>
                            {worktree.main && (
                              <Badge variant="secondary" className="shrink-0">
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
        ))}
      </SidebarMenu>
    </nav>
  );
}
