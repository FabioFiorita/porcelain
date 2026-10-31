import { TruncatedText } from '@/shared/views/truncated-text';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import type { RemoteConnection } from '@porcelain/client/access';
import { remoteStatusText } from '@porcelain/client/access/rules';
import { MonitorIcon, PlusIcon, ServerIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SidebarGroupAction } from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { remoteStatusVariant, useRemoteStatus } from '@/features/access/index';

export function OpenProjectMenu({
  remotes,
  onOpenProject: openProject,
}: {
  remotes: readonly RemoteConnection[] | undefined;
  onOpenProject: (remote: RemoteConnection | null) => void;
}) {
  if (!remotes?.length)
    return (
      <Tooltip disableHoverablePopup>
        <TooltipTrigger
          render={
            <SidebarGroupAction
              className="relative top-0 right-0 ml-auto w-6 cursor-pointer"
              aria-label="Open project"
              onClick={() => openProject(null)}
            />
          }
        >
          <PlusIcon className="text-muted-foreground" />
        </TooltipTrigger>
        <TooltipContent role="tooltip">Open project</TooltipContent>
      </Tooltip>
    );
  return (
    <DropdownMenu>
      <Tooltip disableHoverablePopup>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <SidebarGroupAction
                  className="relative top-0 right-0 ml-auto w-6 cursor-pointer"
                  aria-label="Open project"
                />
              }
            />
          }
        >
          <PlusIcon className="text-muted-foreground" />
        </TooltipTrigger>
        <TooltipContent role="tooltip">Open project</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Open project on</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => openProject(null)}>
            <MonitorIcon />
            This computer
          </DropdownMenuItem>
          {remotes.map((entry) => (
            <RemoteItem
              key={entry.remote.environmentId}
              entry={entry}
              onOpen={() => openProject(entry)}
            />
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RemoteItem({
  entry,
  onOpen,
}: {
  entry: RemoteConnection;
  onOpen: () => void;
}) {
  const status = useRemoteStatus(entry.remote);
  const online = status.kind === 'online';
  return (
    <DropdownMenuItem disabled={!online} onClick={onOpen}>
      <ServerIcon />
      <TruncatedText
        className="min-w-0"
        text={online ? status.name : entry.remote.name}
      />
      {!online && (
        <Badge
          variant={remoteStatusVariant(status)}
          className="relative top-0 right-0 ml-auto w-6 cursor-pointer"
        >
          {remoteStatusText(status)}
        </Badge>
      )}
    </DropdownMenuItem>
  );
}
