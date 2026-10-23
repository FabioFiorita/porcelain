import { TruncatedText } from '@/shared/views/truncated-text';
import {
  CopyIcon,
  FolderGit2Icon,
  FolderMinusIcon,
  PencilIcon,
} from 'lucide-react';
import {
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { copyText } from '@/shared/workspace/copy';
import { removeProjectDialog, renameProjectDialog } from '../overlays';
import {
  projectPath,
  projectUnavailableMessage,
  type Project,
} from '@porcelain/client/projects/rules';

export function ProjectActions({
  environmentId,
  project,
  onRetry,
}: {
  environmentId: string | null;
  project: Project;
  onRetry: () => void;
}) {
  const target = { project, remote: environmentId };
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <FolderGit2Icon />
        <TruncatedText text={project.name} />
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="min-w-44">
        {!project.available && (
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              {projectUnavailableMessage(project)}
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={onRetry}>Retry</DropdownMenuItem>
          </DropdownMenuGroup>
        )}
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => copyText(projectPath(project), 'project path')}
          >
            <CopyIcon />
            Copy path
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => renameProjectDialog.openWithPayload(target)}
          >
            <PencilIcon />
            Rename project
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => removeProjectDialog.openWithPayload(target)}
          >
            <FolderMinusIcon />
            Remove from Porcelain
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
