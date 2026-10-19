import type { RemoteConnection } from '@porcelain/client/access';
import {
  remoteStatusNote,
  remoteStatusText,
} from '@porcelain/client/access/rules';
import {
  searchWorkspaces,
  workspaceChoices,
  projectUnavailableMessage,
  type Inventory,
} from '@porcelain/client/projects/rules';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { remoteStatusVariant, useRemoteStatus } from '@/features/access/index';
import { useRemoteInventory } from '../queries/inventory';
import type { WorktreeTarget } from '../rules/worktree-target';
import { WorktreeRow } from './worktree-row';

type SearchProps = {
  query: string;
  selected: Pick<WorktreeTarget, 'remote' | 'worktreeId'> | undefined;
  onSelect: (target: WorktreeTarget) => void;
};

export function WorkspaceSearchResults({
  inventory,
  remote,
  query,
  selected,
  onSelect,
}: SearchProps & { inventory: Inventory; remote: string | null }) {
  const choices = searchWorkspaces(
    workspaceChoices(
      [
        {
          environmentId: inventory.environmentId,
          name: inventory.environment.name,
          status: 'ready',
          inventory,
        },
      ],
      undefined,
    ).choices,
    query,
  );
  return (
    <>
      {choices.map((choice) => (
        <section
          key={choice.key}
          aria-label={`${choice.project.name} on ${choice.environmentName}`}
          className="mb-3"
        >
          <h3 className="px-2 py-1 text-caption font-medium">
            {choice.project.name}
          </h3>
          {!choice.project.available && (
            <p className="px-2 text-2xs text-muted-foreground">
              {projectUnavailableMessage(choice.project)}
            </p>
          )}
          {choice.worktrees.map((row) => (
            <WorktreeRow
              key={row.key}
              worktree={row.worktree}
              projectName={choice.project.name}
              searchContext={choice.environmentName}
              disabled={row.disabled}
              selected={
                selected?.remote === remote &&
                selected.worktreeId === row.worktree.id
              }
              onSelect={(worktreeId) =>
                onSelect({ remote, projectId: choice.project.id, worktreeId })
              }
            />
          ))}
          {choice.worktrees.length === 0 && (
            <p className="px-2 text-2xs text-muted-foreground">
              No worktrees found.
            </p>
          )}
        </section>
      ))}
      {choices.length === 0 && (
        <p
          role="status"
          className="px-2 py-3 text-caption text-muted-foreground"
        >
          No matching workspaces on {inventory.environment.name}.
        </p>
      )}
    </>
  );
}

export function RemoteWorkspaceSearch({
  entry: { remote, connection },
  onOpenRemotes,
  ...search
}: SearchProps & {
  entry: RemoteConnection;
  onOpenRemotes: () => void;
}) {
  const status = useRemoteStatus(remote);
  const { inventory, error } = useRemoteInventory(
    connection,
    status.kind === 'online',
  );
  const name = status.kind === 'online' ? status.name : remote.name;
  return (
    <section aria-label={name} className="mt-3 border-t pt-2">
      <h2 className="flex items-center justify-between gap-2 px-2 text-caption text-muted-foreground">
        {name}
        <Badge variant={remoteStatusVariant(status)}>
          {remoteStatusText(status)}
        </Badge>
      </h2>
      {status.kind !== 'online' && (
        <div className="px-2 py-2 text-2xs text-muted-foreground">
          <p>{remoteStatusNote(status)}</p>
          <Button variant="link" size="xs" onClick={onOpenRemotes}>
            Computer settings
          </Button>
        </div>
      )}
      {status.kind === 'online' && error !== undefined && (
        <p
          role="status"
          className="px-2 py-2 text-caption text-muted-foreground"
        >
          Could not read projects on {name}.
        </p>
      )}
      {status.kind === 'online' &&
        error === undefined &&
        inventory !== undefined && (
          <WorkspaceSearchResults
            {...search}
            inventory={inventory}
            remote={remote.environmentId}
          />
        )}
      {status.kind === 'online' &&
        error === undefined &&
        inventory === undefined && (
          <p
            role="status"
            className="px-2 py-2 text-caption text-muted-foreground"
          >
            Loading projects…
          </p>
        )}
    </section>
  );
}
