import type { RemoteConnection } from '@porcelain/client/access';
import {
  remoteStatusNote,
  remoteStatusText,
} from '@porcelain/client/access/rules';
import { ServerIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SidebarMenuSubItem } from '@/components/ui/sidebar';
import { remoteStatusVariant, useRemoteStatus } from '@/features/access/index';
import { useRemoteInventory, useRetryInventory } from '../queries/inventory';
import type { WorktreeTarget } from '../rules/worktree-target';
import { MachineSection } from './machine-section';
import { ProjectSection } from './project-section';

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
  const retryInventory = useRetryInventory(
    connection,
    status.kind === 'online',
  );
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
        <Badge variant={remoteStatusVariant(status)}>
          {remoteStatusText(status)}
        </Badge>
      }
    >
      {status.kind !== 'online' ? (
        <SidebarMenuSubItem>
          <div className="flex flex-col items-start gap-1 px-2 pb-2 text-2xs text-muted-foreground">
            {note && <p>{note}</p>}
            {status.kind !== 'checking' && (
              <Button variant="link" size="xs" onClick={onOpenRemotes}>
                Open Remote computers
              </Button>
            )}
          </div>
        </SidebarMenuSubItem>
      ) : (
        <RemoteProjects
          inventory={inventory}
          onRetry={retryInventory}
          environmentId={remote.environmentId}
          selected={selected}
          onSelect={onSelect}
        />
      )}
    </MachineSection>
  );
}

function RemoteProjects({
  inventory,
  onRetry,
  environmentId,
  selected,
  onSelect,
}: {
  onRetry: () => void;
  inventory: ReturnType<typeof useRemoteInventory>['inventory'];
  environmentId: RemoteConnection['remote']['environmentId'];
  selected: string | undefined;
  onSelect: (target: WorktreeTarget) => void;
}) {
  if (inventory === undefined)
    return (
      <SidebarMenuSubItem>
        <p role="status" className="px-2 pb-2 text-2xs text-muted-foreground">
          Loading projects…
        </p>
      </SidebarMenuSubItem>
    );
  if (inventory.projects.length === 0)
    return (
      <SidebarMenuSubItem>
        <p className="px-2 pb-2 text-2xs text-muted-foreground">
          No projects registered.
        </p>
      </SidebarMenuSubItem>
    );
  return inventory.projects.map((project) => (
    <SidebarMenuSubItem key={project.id}>
      <ProjectSection
        project={project}
        onRetry={onRetry}
        selected={selected}
        manage={false}
        onSelect={(worktreeId) =>
          onSelect({
            remote: environmentId,
            projectId: project.id,
            worktreeId,
          })
        }
      />
    </SidebarMenuSubItem>
  ));
}
