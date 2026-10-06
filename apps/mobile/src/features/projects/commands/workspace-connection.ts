import { useAtomValue } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import { Option } from 'effect';
import { liveQueries, inactiveLiveQueries } from '@porcelain/client/live';
import { useProjectConnection } from '../store';
import type { Remote } from '@porcelain/client/access/rules';
import { useInventory } from '../queries/inventory';

export function useWorkspaceConnection(
  remote: Remote | undefined,
  projectId: string | undefined,
  worktreeId: string | undefined,
  ready: boolean,
) {
  const connection = useProjectConnection(remote);
  const inventory = useInventory(connection);
  const data = Option.getOrUndefined(AsyncResult.value(inventory.result));
  const project = data?.projects.find(
    (candidate) => candidate.id === projectId,
  );
  const worktree = project?.worktrees.find(
    (candidate) => candidate.id === worktreeId,
  );
  const selected =
    ready &&
    !AsyncResult.isFailure(inventory.result) &&
    project?.available &&
    worktree?.available;
  useAtomValue(
    selected && connection ? liveQueries({ connection }) : inactiveLiveQueries,
  );
  const current =
    selected && remote && project && worktree && connection
      ? {
          key: JSON.stringify([
            remote.environmentId,
            remote.address,
            remote.deviceId ?? '',
            project.id,
            worktree.id,
          ]),
          connection,
          scope: { projectId: project.id, worktreeId: worktree.id },
          project,
          worktree,
        }
      : undefined;
  return { inventory, project, worktree, current };
}
