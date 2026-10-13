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
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { copyText } from '@/shared/workspace/copy';
import { removeProjectDialog, renameProjectDialog } from '../overlays';
import {
  projectPath,
  projectUnavailableMessage,
} from '@porcelain/client/projects/rules';
import { type Project } from '@porcelain/client/projects/rules';
import { useGroupOpen } from '../store';
import { WorktreeRow } from './worktree-row';

export function ProjectSection({
  environmentId,
  project,
  onRetry,
  selected,
  onSelect,
  manage = true,
}: {
  environmentId: string | null;
  project: Project;
  onRetry: () => void;
  selected: string | null | undefined;
  onSelect: (id: string) => void;
  manage?: boolean;
}) {
  const path = projectPath(project);
  const { open, setOpen } = useGroupOpen(
    `project:${environmentId ?? 'local'}:${project.id}`,
  );
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="group/project mb-2"
    >
      <ContextMenu>
        <ContextMenuTrigger
          render={<div className="flex items-center rounded-md" />}
        >
          <CollapsibleTrigger
            render={
              <button
                type="button"
                title={project.name}
                aria-label={project.name}
                className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-left hover:bg-accent"
              />
            }
          >
            <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none group-data-open/project:rotate-90" />
            <FolderGit2Icon className="size-3.5 shrink-0 text-muted-foreground" />
            <h3 className="min-w-0 flex-1 truncate text-left text-caption font-medium">
              {project.name}
            </h3>
          </CollapsibleTrigger>
          {!project.available && (
            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Project unavailable: ${project.name}`}
                    title={projectUnavailableMessage(project)}
                  />
                }
              >
                <CircleAlertIcon className="size-3.5 text-muted-foreground" />
              </PopoverTrigger>
              <PopoverContent>
                <p>{projectUnavailableMessage(project)}</p>
                <Button variant="outline" size="sm" onClick={onRetry}>
                  Retry
                </Button>
                {manage && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeProjectDialog.openWithPayload(project)}
                  >
                    Remove from Porcelain
                  </Button>
                )}
              </PopoverContent>
            </Popover>
          )}
        </ContextMenuTrigger>
        <ContextMenuContent className="min-w-44">
          <ContextMenuGroup>
            <ContextMenuItem onClick={() => copyText(path, 'project path')}>
              <CopyIcon />
              Copy path
            </ContextMenuItem>
          </ContextMenuGroup>
          {manage && (
            <>
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
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      <CollapsibleContent>
        {path && (
          <p
            className="truncate pb-1 pl-8 font-mono text-2xs text-muted-foreground"
            title={path}
          >
            {path}
          </p>
        )}
        {project.worktrees.length === 0 ? (
          <p className="px-2 py-2 text-2xs text-muted-foreground">
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
