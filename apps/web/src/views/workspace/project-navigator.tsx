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
    <nav aria-label="Projects and worktrees" className="min-w-0 px-3 pb-6">
      <SidebarMenu className="gap-4">
        {projects.map((project) => (
          <SidebarMenuItem key={project.id}>
            <Collapsible defaultOpen className="group/project">
              <h3 aria-label={project.name}>
                <CollapsibleTrigger
                  render={<SidebarMenuButton />}
                  className="h-10"
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
                <SidebarMenu className="mt-1 border-l border-sidebar-border pl-2 ml-4 w-[calc(100%-1rem)]">
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
                                size="lg"
                                isActive={selected === worktree.id}
                              />
                            }
                            aria-pressed={selected === worktree.id}
                            onClick={() => onSelect(worktree.id)}
                            className="relative h-auto min-h-12 gap-2 py-2.5"
                          >
                            <Icon aria-hidden="true" />
                            <span className="flex min-w-0 flex-1 flex-col gap-1">
                              <span className="truncate text-xs">
                                {worktreeLabel(worktree.branch)}
                              </span>
                              <span className="truncate font-mono text-[10px] text-muted-foreground">
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
                              <Badge variant="outline" className="shrink-0">
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
