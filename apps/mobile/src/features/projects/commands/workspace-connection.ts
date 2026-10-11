import { useAtomValue } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import { Option } from 'effect';
import { liveQueries, inactiveLiveQueries } from '@porcelain/client/live';
import { useProjectConnection } from '../store';
import type { Remote } from '@porcelain/client/access/rules';
import {
  workspaceSelection,
  type WorkspaceSelection,
  type WorkspaceReadState,
} from '@porcelain/client/projects/rules';
import type { RuntimeConnection } from '@porcelain/client/transport';
import { useInventory } from '../queries/inventory';

export type SelectedWorktree = {
  readonly key: string;
  readonly connection: RuntimeConnection;
  readonly scope: { readonly projectId: string; readonly worktreeId: string };
  readonly project: Extract<
    WorkspaceSelection,
    { kind: 'selected' }
  >['project'];
  readonly worktree: Extract<
    WorkspaceSelection,
    { kind: 'selected' }
  >['worktree'];
};

type WorkspaceState =
  | Exclude<WorkspaceSelection, { kind: 'selected' }>
  | {
      readonly kind: 'selected';
      readonly workspace: SelectedWorktree;
    };

export function useWorkspaceConnection(
  remote: Remote | undefined,
  remembered:
    | { readonly projectId: string; readonly worktreeId: string }
    | undefined,
  storage: WorkspaceReadState,
  selection: WorkspaceReadState,
) {
  const connection = useProjectConnection(remote);
  const inventory = useInventory(connection);
  const data = Option.getOrUndefined(AsyncResult.value(inventory.result));
  const project = data?.projects.find(
    (candidate) => candidate.id === remembered?.projectId,
  );
  const worktree = project?.worktrees.find(
    (candidate) => candidate.id === remembered?.worktreeId,
  );
  const decision = workspaceSelection({
    storage,
    selection,
    remembered,
    environment: remote,
    inventory: inventory.state,
  });
  useAtomValue(
    decision.kind === 'selected' && connection
      ? liveQueries({ connection })
      : inactiveLiveQueries,
  );
  return {
    inventory,
    project,
    worktree,
    state: connectedWorkspace(decision, remote, connection),
  };
}

function connectedWorkspace(
  decision: WorkspaceSelection,
  remote: Remote | undefined,
  connection: RuntimeConnection | undefined,
): WorkspaceState {
  if (decision.kind !== 'selected') return decision;
  if (!remote || !connection) return { kind: 'loading' };
  return {
    kind: 'selected',
    workspace: {
      key: JSON.stringify([
        remote.environmentId,
        remote.address,
        remote.deviceId ?? '',
        decision.project.id,
        decision.worktree.id,
      ]),
      connection,
      scope: {
        projectId: decision.project.id,
        worktreeId: decision.worktree.id,
      },
      project: decision.project,
      worktree: decision.worktree,
    },
  };
}
