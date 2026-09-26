import {
  ChevronRightIcon,
  CircleAlertIcon,
  CopyIcon,
  FolderGit2Icon,
  FolderMinusIcon,
  PencilIcon,
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { copyText } from '@/shared/workspace/copy';
import { removeProjectDialog, renameProjectDialog } from '../overlays';
import { projectPath, type Project } from '../rules/inventory';
import { WorktreeRow } from './worktree-row';

export function ProjectSection({
  project,
  selected,
  onSelect,
}: {
  project: Project;
  selected: string | null | undefined;
  onSelect: (id: string) => void;
}) {
  const path = projectPath(project);
  return (
    <Collapsible defaultOpen className="group/project mb-2">
      <ContextMenu>
        <ContextMenuTrigger render={<div className="rounded-md" />}>
          <CollapsibleTrigger
            render={
              <button
                type="button"
                title={project.name}
                aria-label={project.name}
                className="flex w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-left hover:bg-accent"
              />
            }
          >
            <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none group-data-open/project:rotate-90" />
            <FolderGit2Icon className="size-3.5 shrink-0 text-muted-foreground" />
            <h3 className="min-w-0 flex-1 truncate text-left text-[12.5px] font-medium">
              {project.name}
            </h3>
            {!project.available && (
              <CircleAlertIcon
                aria-label="Project unavailable"
                className="size-3.5 shrink-0 text-muted-foreground"
              />
            )}
          </CollapsibleTrigger>
        </ContextMenuTrigger>
        <ContextMenuContent className="min-w-44">
          <ContextMenuGroup>
            <ContextMenuItem onClick={() => copyText(path, 'project path')}>
              <CopyIcon />
              Copy path
            </ContextMenuItem>
          </ContextMenuGroup>
          <ContextMenuSeparator />
          <ContextMenuGroup>
            <ContextMenuItem
              onClick={() => renameProjectDialog.openWithPayload(project)}
            >
              <PencilIcon />
              Rename project
            </ContextMenuItem>
            <ContextMenuItem
              variant="destructive"
              onClick={() => removeProjectDialog.openWithPayload(project)}
            >
              <FolderMinusIcon />
              Remove from Porcelain
            </ContextMenuItem>
          </ContextMenuGroup>
        </ContextMenuContent>
      </ContextMenu>

      <CollapsibleContent>
        {path && (
          <p
            className="truncate pb-1 pl-8 font-mono text-[10.5px] text-muted-foreground"
            title={path}
          >
            {path}
          </p>
        )}
        {project.worktrees.length === 0 ? (
          <p className="px-2 py-2 text-[11px] text-muted-foreground">
            No worktrees found.
          </p>
        ) : (
          project.worktrees.map((worktree) => (
            <WorktreeRow
              key={worktree.id}
              worktree={worktree}
              projectName={project.name}
              selected={selected === worktree.id}
              onSelect={onSelect}
            />
          ))
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
