import { type Query, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { LiveNotice } from '../contracts/live';
import { queryKeys, type WorktreeResource, worktreeKeyParts } from './keys';
import { useWorkspaceContext } from './workspace-provider';

/** Which reads a notice makes out of date. Only those reload, and only if on screen. */
const RELOAD: Record<
  Exclude<LiveNotice['kind'], 'inventory' | 'action' | 'files'>,
  WorktreeResource[]
> = {
  branch: [
    'changes',
    'history',
    'branches',
    'review',
    'marks',
    'comments',
    'diff',
    'text',
    'preview',
    'range',
    'directory',
    'search',
  ],
  review: ['review', 'marks'],
  comments: ['comments'],
  marks: ['marks'],
};

/** A file notice reloads the list of changes and whatever read those paths. */
const FILE_RESOURCES: WorktreeResource[] = [
  'changes',
  'review',
  'marks',
  'comments',
  'search',
  'range',
];
const PATH_RESOURCES: WorktreeResource[] = ['diff', 'text', 'preview'];

/**
 * The folder listings a set of changed paths can alter: every ancestor folder (a new
 * file can create folders), and a changed folder itself. Listing keys have no trailing
 * slash; the root is "".
 */
function folderListings(paths: readonly string[]): Set<string> {
  const folders = new Set<string>();
  for (const path of paths) {
    const parts = path.replace(/\/+$/, '').split('/');
    if (path.endsWith('/')) folders.add(parts.join('/'));
    for (let index = 0; index < parts.length; index += 1)
      folders.add(parts.slice(0, index).join('/'));
  }
  return folders;
}

/**
 * The live channel: one WebSocket to this server. The server says what changed;
 * this reloads only those reads. Nothing polls and nothing refetches on focus.
 * After a reconnect it re-checks what is on screen once. Replaces the mock
 * bridge; apps/web mounts the same component over its live api.
 */
export function LiveChannel() {
  const { api, environmentId, operations, connection } = useWorkspaceContext();
  const client = useQueryClient();

  useEffect(() => {
    const reload = (predicate: (query: Query) => boolean) =>
      void client.invalidateQueries({ predicate });
    const forWorktree = (
      worktreeId: string,
      test: (resource: WorktreeResource, rest: unknown[]) => boolean,
    ) =>
      reload((query) => {
        const parts = worktreeKeyParts(query.queryKey);
        return (
          parts != null &&
          parts.worktreeId === worktreeId &&
          test(parts.resource, parts.rest)
        );
      });

    const onNotice = (notice: LiveNotice) => {
      switch (notice.kind) {
        case 'inventory':
          void client.invalidateQueries({
            queryKey: queryKeys.inventory(environmentId),
          });
          return;
        case 'files': {
          const paths = new Set(notice.paths);
          const folders = folderListings(notice.paths);
          forWorktree(
            notice.worktreeId,
            (resource, rest) =>
              FILE_RESOURCES.includes(resource) ||
              (PATH_RESOURCES.includes(resource) &&
                (paths.size === 0 || paths.has(rest[0] as string))) ||
              (resource === 'directory' &&
                (paths.size === 0 || folders.has(rest[0] as string))),
          );
          return;
        }
        case 'action': {
          if (notice.state === 'running') {
            if (notice.line != null)
              operations.progress(notice.requestId, notice.line);
            return;
          }
          const operation = operations.get(notice.requestId);
          if (operation == null) return;
          void api.gitActions
            .receipt({
              projectId: operation.projectId,
              worktreeId: operation.worktreeId,
              requestId: operation.requestId,
            })
            .then((receipt) => operations.finish(receipt))
            .catch(() => undefined);
          return;
        }
        default:
          forWorktree(notice.worktreeId, (resource) =>
            RELOAD[notice.kind].includes(resource),
          );
      }
    };

    let previous = connection.get().live;
    const onState = (state: 'connected' | 'reconnecting') => {
      connection.setLive(state);
      // Back after a drop: re-check what is on screen once; unchanged reads answer "not modified".
      if (previous === 'reconnecting' && state === 'connected') {
        void client.invalidateQueries({ refetchType: 'active' });
        // An action may have finished while the channel was down.
        for (const operation of operations.running()) {
          void api.gitActions
            .receipt({
              projectId: operation.projectId,
              worktreeId: operation.worktreeId,
              requestId: operation.requestId,
            })
            .then((receipt) => {
              if (receipt.state !== 'running') operations.finish(receipt);
            })
            .catch(() => undefined);
        }
      }
      previous = state;
    };

    return api.live.connect({ onNotice, onState });
  }, [api, client, connection, environmentId, operations]);

  return null;
}
