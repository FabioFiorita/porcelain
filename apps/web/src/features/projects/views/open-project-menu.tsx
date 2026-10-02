import { MonitorIcon, PlusIcon, ServerIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  remoteStatusText,
  remoteStatusVariant,
  useRemoteStatus,
  type RemoteConnection,
} from '@/features/access/index';

export function OpenProjectMenu({
  remotes,
  onOpenProject: openProject,
}: {
  remotes: readonly RemoteConnection[] | undefined;
  onOpenProject: (remote: RemoteConnection | null) => void;
}) {
  const plus = (onClick?: () => void) => (
    <Button
      variant="ghost"
      size="icon-sm"
      className="ml-auto"
      aria-label="Open project"
      title="Open project"
      onClick={onClick}
    >
      <PlusIcon />
    </Button>
  );
  if (!remotes?.length) return plus(() => openProject(null));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={plus()}>
        <PlusIcon />
      </DropdownMenuTrigger>
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
      <span className="min-w-0 truncate">
        {online ? status.name : entry.remote.name}
      </span>
      {!online && (
        <Badge variant={remoteStatusVariant(status)} className="ml-auto">
          {remoteStatusText(status)}
        </Badge>
      )}
    </DropdownMenuItem>
  );
}
