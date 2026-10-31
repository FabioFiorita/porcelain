import {
  CopyIcon,
  EllipsisIcon,
  FolderMinusIcon,
  PencilIcon,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { copyText } from '@/shared/workspace/copy';
import { removeProjectDialog, renameProjectDialog } from '../overlays';
import {
  projectPath,
  projectUnavailableMessage,
  type Project,
} from '@porcelain/client/projects/rules';

export function ProjectActions({
  environmentId,
  environmentName,
  project,
}: {
  environmentId: string | null;
  environmentName: string;
  project: Project;
}) {
  const target = { project, remote: environmentId };
  const actions = [
    {
      label: 'Copy path',
      icon: CopyIcon,
      run: () => copyText(projectPath(project), 'project path'),
      destructive: false,
    },
    {
      label: 'Rename project',
      icon: PencilIcon,
      run: () => renameProjectDialog.openWithPayload(target),
      destructive: false,
    },
    {
      label: 'Remove from Porcelain',
      icon: FolderMinusIcon,
      run: () => removeProjectDialog.openWithPayload(target),
      destructive: true,
    },
  ];
  return (
    <DropdownMenu>
      <Tooltip disableHoverablePopup>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Project actions: ${project.name} · ${environmentName}`}
                />
              }
            />
          }
        >
          <EllipsisIcon />
        </TooltipTrigger>
        <TooltipContent>Project actions</TooltipContent>
      </Tooltip>
      <DropdownMenuContent className="w-56 max-w-[calc(100vw-2rem)]">
        <DropdownMenuGroup>
          {!project.available && (
            <DropdownMenuLabel>
              {projectUnavailableMessage(project)}
            </DropdownMenuLabel>
          )}
          {actions.map(({ label, icon: Icon, run, destructive }) => (
            <DropdownMenuItem
              key={label}
              className="cursor-pointer"
              variant={destructive ? 'destructive' : 'default'}
              onClick={run}
            >
              <Icon />
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
