import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  createWorktreeConnection,
  remoteTransport,
  queryKeys,
} from '@porcelain/client/transport';
import {
  connectLiveQueries,
  remoteLiveUpdates,
  type LiveConnection,
} from '@porcelain/client/live';
import { OperationStore } from '@porcelain/client/git-actions';
import { ManagedRuntime } from 'effect';
import { projectOperationsLayer } from '../store';
import { mobileSocket } from '../../../shared/adapters/live-socket';
import type { Remote } from '@porcelain/client/access/rules';
import { useInventory } from '../queries/inventory';
import type { AccessPlatform } from '@porcelain/client/access';
import { REQUEST_TIMEOUT_MS } from '../../../config/limits';

export function useWorkspaceConnection(
  remote: Remote | undefined,
  send: AccessPlatform['send'],
  projectId: string | undefined,
  worktreeId: string | undefined,
  ready: boolean,
) {
  const client = useQueryClient();
  const inventory = useInventory(remote, send);
  const project = inventory.data?.projects.find(
    (candidate) => candidate.id === projectId,
  );
  const worktree = project?.worktrees.find(
    (candidate) => candidate.id === worktreeId,
  );
  const selected =
    ready && !inventory.isError && project?.available && worktree?.available;
  const environmentId = remote?.environmentId;
  const address = remote?.address;
  const credential = remote?.credential;
  const deviceId = remote?.deviceId;
  const key =
    selected && remote && project && worktree
      ? JSON.stringify([
          environmentId,
          address,
          deviceId ?? '',
          project.id,
          worktree.id,
        ])
      : undefined;
  const [connected, setConnected] = useState<{
    key: string;
    credential: string;
    connection: LiveConnection;
  }>();
  useEffect(() => {
    if (
      !key ||
      !environmentId ||
      !deviceId ||
      address === undefined ||
      credential === undefined
    )
      return;
    const lifetime = createWorktreeConnection({
      environmentId,
      transport: remoteTransport(address, credential, send),
      cacheIdentity: [address, deviceId ?? ''],
      timeoutMs: REQUEST_TIMEOUT_MS,
    });
    const operationRuntime = ManagedRuntime.make(
      projectOperationsLayer({ environmentId, address, deviceId }),
    );
    const connection: LiveConnection = {
      ...lifetime.connection,
      controller: lifetime.controller,
      operations: operationRuntime.runSync(OperationStore),
      liveUpdates: remoteLiveUpdates(
        address,
        lifetime.connection.transport,
        mobileSocket,
      ),
    };
    const closeLive = connectLiveQueries(client, connection, () => {
      void client.invalidateQueries({
        queryKey: queryKeys.connectedInventory(connection),
        exact: true,
      });
    });
    setConnected({ key, credential, connection });
    return () => {
      closeLive();
      void lifetime.close();
      void operationRuntime.dispose();
    };
  }, [key, environmentId, address, credential, deviceId, send, client]);
  const current =
    key &&
    connected?.key === key &&
    connected.credential === credential &&
    project &&
    worktree
      ? {
          key,
          connection: connected.connection,
          scope: { projectId: project.id, worktreeId: worktree.id },
          project,
          worktree,
        }
      : undefined;
  return { inventory, project, worktree, current };
}
