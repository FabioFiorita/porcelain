import { useEffect, useState } from 'react';
import { remoteTransport } from '@porcelain/client/transport';
import type { Remote } from '@porcelain/client/access/rules';
import { useInventory } from './inventory';
import type { AccessPlatform } from '@porcelain/client/access';

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
  const [lifetime, setLifetime] = useState(() => ({
    remote,
    selected,
    projectId,
    worktreeId,
    controller: new AbortController(),
  }));
  if (
    lifetime.remote !== remote ||
    lifetime.selected !== selected ||
    lifetime.projectId !== projectId ||
    lifetime.worktreeId !== worktreeId
  ) {
    setLifetime({
      remote,
      selected,
      projectId,
      worktreeId,
      controller: new AbortController(),
    });
  }
  useEffect(() => {
    if (lifetime.controller.signal.aborted)
      lifetime.controller = new AbortController();
    return () => lifetime.controller.abort();
  }, [lifetime]);
  const connection = remote
    ? {
        environmentId: remote.environmentId,
        cacheIdentity: [remote.address, remote.deviceId ?? ''],
        transport: remoteTransport(remote.address, remote.credential, send),
        request: (signal?: AbortSignal) => ({
          signal: signal
            ? AbortSignal.any([lifetime.controller.signal, signal])
            : lifetime.controller.signal,
        }),
      }
    : undefined;
  const scope =
    project && worktree
      ? { projectId: project.id, worktreeId: worktree.id }
      : undefined;
  const current =
    selected && connection && scope && project && worktree
      ? {
          key: JSON.stringify([
            connection.environmentId,
            ...connection.cacheIdentity,
            scope.projectId,
            scope.worktreeId,
          ]),
          connection,
          scope,
          project,
          worktree,
        }
      : undefined;
  return { inventory, project, worktree, current };
}
