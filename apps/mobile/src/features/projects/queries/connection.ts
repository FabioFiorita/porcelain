import { useEffect, useState } from 'react';
import {
  createWorktreeConnection,
  remoteTransport,
  type WorktreeConnection,
} from '@porcelain/client/transport';
import type { Remote } from '@porcelain/client/access/rules';
import { useInventory } from './inventory';
import type { AccessPlatform } from '@porcelain/client/access';
import { REQUEST_TIMEOUT_MS } from '../../../config/limits';

export function useWorkspaceConnection(
  remote: Remote | undefined,
  send: AccessPlatform['send'],
  projectId: string | undefined,
  worktreeId: string | undefined,
  ready: boolean,
) {
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
    connection: WorktreeConnection;
  }>();
  useEffect(() => {
    if (
      !key ||
      !environmentId ||
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
    setConnected({ key, credential, connection: lifetime.connection });
    return lifetime.close;
  }, [key, environmentId, address, credential, deviceId, send]);
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
