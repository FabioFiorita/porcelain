import type { LiveNotice } from '@porcelain/contracts/live-updates';
import type { QueryClient } from '@tanstack/react-query';
import type { Api } from '../api/api';
import { queryKeys } from './keys';

type Connection = {
  environmentId: string;
  controller: AbortController;
};

type Watched = { projectId: string; worktreeId: string; paths: Set<string> };

export function liveSubscription(client: QueryClient, environmentId: string) {
  const watched = new Map<string, Watched>();
  for (const query of client.getQueryCache().findAll({ type: 'active' })) {
    const [root, environment, projectId, worktreeId, surface, path] =
      query.queryKey;
    if (
      root !== 'review' ||
      environment !== environmentId ||
      typeof projectId !== 'string' ||
      typeof worktreeId !== 'string'
    )
      continue;
    const entry = watched.get(worktreeId) ?? {
      projectId,
      worktreeId,
      paths: new Set<string>(),
    };
    if (
      (surface === 'text' ||
        surface === 'directory' ||
        surface === 'asset' ||
        surface === 'html-preview') &&
      typeof path === 'string'
    )
      entry.paths.add(path);
    watched.set(worktreeId, entry);
  }
  return {
    type: 'subscribe' as const,
    projects:
      client
        .getQueryData<{ projects: { id: string }[] }>(
          queryKeys.inventory(environmentId),
        )
        ?.projects.map((project) => project.id)
        .slice(0, 128) ?? [],
    worktrees: [...watched.values()].slice(0, 32).map((entry) => ({
      projectId: entry.projectId,
      worktreeId: entry.worktreeId,
      paths: [...entry.paths].slice(0, 64),
    })),
  };
}

const FILE_SURFACES = new Set([
  'changes',
  'directory',
  'text',
  'paths',
  'git-status',
  'asset',
  'html-preview',
]);
const GIT_SURFACES = new Set(['changes', 'git-status', 'history', 'paths']);

async function invalidateSurfaces(
  client: QueryClient,
  environmentId: string,
  notice: Extract<LiveNotice, { type: 'worktree' }>,
  surfaces: ReadonlySet<string>,
) {
  const prefix = queryKeys.review(environmentId, notice);
  await client.invalidateQueries({
    queryKey: prefix,
    predicate: (query) => surfaces.has(String(query.queryKey[prefix.length])),
  });
}

export async function applyLiveNotice(
  client: QueryClient,
  environmentId: string,
  notice: LiveNotice,
) {
  if (notice.type === 'ready' || notice.type === 'heartbeat') return;
  if (notice.type === 'inventory') {
    await client.invalidateQueries({
      queryKey: queryKeys.inventory(environmentId),
      exact: true,
    });
    return;
  }
  if (notice.type === 'project') {
    if (notice.change === 'preferences')
      await client.invalidateQueries({
        queryKey: queryKeys.filePreferences(environmentId, notice.projectId),
        exact: true,
      });
    return;
  }
  const inventory = () =>
    client.invalidateQueries({
      queryKey: queryKeys.inventory(environmentId),
      exact: true,
    });
  if (notice.change === 'files') {
    // The server reconciles conservative stale marks while answering changes;
    // refresh the sidebar only after that read can have completed.
    await invalidateSurfaces(client, environmentId, notice, FILE_SURFACES);
    await inventory();
    return;
  }
  if (notice.change === 'git') {
    await invalidateSurfaces(client, environmentId, notice, GIT_SURFACES);
    await inventory();
    return;
  }
  const surfaces =
    notice.change === 'reviewed'
      ? new Set(['reviewed'])
      : notice.change === 'comments'
        ? new Set(['comments'])
        : notice.change === 'layers'
          ? new Set(['changes'])
          : new Set(['artifacts', 'artifact']);
  await invalidateSurfaces(client, environmentId, notice, surfaces);
  if (notice.change !== 'artifacts') await inventory();
}

export function connectLiveQueries(
  api: Api,
  client: QueryClient,
  connection: Connection,
) {
  const lifecycle = new AbortController();
  const live = api.liveUpdates.connect({
    signal: AbortSignal.any([connection.controller.signal, lifecycle.signal]),
    onNotice: (notice) => {
      void applyLiveNotice(client, connection.environmentId, notice);
    },
    onReconnect: () => {
      void client.invalidateQueries({ type: 'active' });
    },
  });
  let queued = false;
  let sent = '';
  const send = () => {
    queued = false;
    const subscription = liveSubscription(client, connection.environmentId);
    const serialized = JSON.stringify(subscription);
    if (serialized === sent) return;
    sent = serialized;
    live.subscribe(subscription);
  };
  const changed = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(send);
  };
  const unsubscribe = client.getQueryCache().subscribe(changed);
  changed();
  return () => {
    unsubscribe();
    lifecycle.abort();
  };
}
