import { ServerIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  remoteStatusNote,
  remoteStatusText,
  useRemoteStatus,
  type RemoteConnection,
  type RemoteStatus,
} from '@/features/access/index';
import { useRemoteInventory } from '../queries/inventory';
import type { WorktreeTarget } from '../rules/inventory';
import { MachineSection } from './machine-section';
import { ProjectSection } from './project-section';

function statusVariant(status: RemoteStatus) {
  if (status.kind === 'online') return 'secondary';
  if (status.kind === 'checking') return 'outline';
  return 'destructive';
}

export function RemoteMachine({
  entry: { remote, connection },
  selected,
  onSelect,
  onOpenRemotes,
}: {
  entry: RemoteConnection;
  selected: string | undefined;
  onSelect: (target: WorktreeTarget) => void;
  onOpenRemotes: () => void;
}) {
  const status = useRemoteStatus(remote);
  const { inventory } = useRemoteInventory(
    connection,
    status.kind === 'online',
  );
  const name = status.kind === 'online' ? status.name : remote.name;
  const note = remoteStatusNote(status);
  return (
    <MachineSection
      name={name}
      icon={ServerIcon}
      status={
        <Badge variant={statusVariant(status)}>
          {remoteStatusText(status)}
        </Badge>
      }
    >
      {status.kind !== 'online' ? (
        <div className="flex flex-col items-start gap-1 px-2 pb-2 text-[11px] text-muted-foreground">
          {note && <p>{note}</p>}
          {status.kind !== 'checking' && (
            <Button variant="link" size="xs" onClick={onOpenRemotes}>
              Open Remote computers
            </Button>
          )}
        </div>
      ) : inventory === undefined ? (
        <p
          role="status"
          className="px-2 pb-2 text-[11px] text-muted-foreground"
        >
          Loading projects…
        </p>
      ) : inventory.projects.length === 0 ? (
        <p className="px-2 pb-2 text-[11px] text-muted-foreground">
          No projects registered.
        </p>
      ) : (
        inventory.projects.map((project) => (
          <ProjectSection
            key={project.id}
            project={project}
            selected={selected}
            manage={false}
            onSelect={(worktreeId) =>
              onSelect({
                remote: remote.environmentId,
                projectId: project.id,
                worktreeId,
              })
            }
          />
        ))
      )}
    </MachineSection>
  );
}
