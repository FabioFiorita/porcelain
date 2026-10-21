import {
  CircleAlertIcon,
  CopyIcon,
  FolderGit2Icon,
  FolderMinusIcon,
  PencilIcon,
} from 'lucide-react';
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

export function ProjectActions({
  environmentId,
  project,
  onRetry,
}: {
  environmentId: string | null;
  project: Project;
  onRetry: () => void;
}) {
  const path = projectPath(project);
  const target = { project, remote: environmentId };
  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger
          render={<div className="flex items-center rounded-md" />}
        >
          <Button
            variant="ghost"
            className="min-w-0 flex-1 justify-start"
            aria-label={project.name}
          >
            <FolderGit2Icon />
            <span className="truncate">{project.name}</span>
          </Button>
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
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => removeProjectDialog.openWithPayload(target)}
                >
                  Remove from Porcelain
                </Button>
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
          <ContextMenuSeparator />
          <ContextMenuGroup>
            <ContextMenuItem
              onClick={() => renameProjectDialog.openWithPayload(target)}
            >
              <PencilIcon />
              Rename project
            </ContextMenuItem>
            <ContextMenuItem
              variant="destructive"
              onClick={() => removeProjectDialog.openWithPayload(target)}
            >
              <FolderMinusIcon />
              Remove from Porcelain
            </ContextMenuItem>
          </ContextMenuGroup>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}
