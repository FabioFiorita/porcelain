import { useAtomValue } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import { Option } from 'effect';
import { liveQueries, inactiveLiveQueries } from '@porcelain/client/live';
import { useProjectConnection } from '../store';
import type { Remote } from '@porcelain/client/access/rules';
import {
  workspaceSelection,
  type WorkspaceSelection,
  type Project,
  type SavedRead,
} from '@porcelain/client/projects/rules';
import type { RuntimeConnection } from '@porcelain/client/transport';
import { useInventory } from '../queries/inventory';

export type Workspace = {
  readonly key: string;
  readonly connection: RuntimeConnection;
  readonly scope: { readonly projectId: string; readonly worktreeId: string };
  readonly project: Project;
  readonly worktree: Project['worktrees'][number];
};

type WorkspaceState =
  | Exclude<WorkspaceSelection, { kind: 'selected' }>
  | {
      readonly kind: 'selected';
      readonly workspace: Workspace;
    };

export function useWorkspaceConnection(
  remote: Remote | undefined,
  remembered:
    | { readonly projectId: string; readonly worktreeId: string }
    | undefined,
  storage: SavedRead,
  selection: SavedRead,
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
    paired: remote !== undefined,
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
  const paired = Option.getOrThrow(Option.fromUndefinedOr(remote));
  const transport = Option.getOrThrow(Option.fromUndefinedOr(connection));
  return {
    kind: 'selected',
    workspace: {
      key: JSON.stringify([
        paired.environmentId,
        paired.address,
        paired.deviceId ?? '',
        decision.project.id,
        decision.worktree.id,
      ]),
      connection: transport,
      scope: {
        projectId: decision.project.id,
        worktreeId: decision.worktree.id,
      },
      project: decision.project,
      worktree: decision.worktree,
    },
  };
}
