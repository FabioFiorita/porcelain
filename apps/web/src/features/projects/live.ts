import type { LiveNotice } from '@porcelain/contracts/access';
import type { QueryClient } from '@tanstack/react-query';
import type { ReadInventoryResponse } from '@porcelain/contracts/projects';

function isInventoryQuery(key: readonly unknown[], environmentId: string) {
  return key[0] === 'inventory' && key[1] === environmentId;
}

function isFilePreferencesQuery(
  key: readonly unknown[],
  environmentId: string,
  projectId: string,
) {
  return (
    key[0] === 'review' &&
    key[1] === environmentId &&
    key[2] === projectId &&
    key[3] === 'file-preferences'
  );
}

function subscriptionProjects(client: QueryClient, environmentId: string) {
  const inventory = client.getQueryCache().findAll({
    predicate: (query) => isInventoryQuery(query.queryKey, environmentId),
  })[0];
  const data =
    inventory && client.getQueryData<ReadInventoryResponse>(inventory.queryKey);
  return data?.projects.map((project) => project.id) ?? [];
}

async function onGitReceipt(client: QueryClient, environmentId: string) {
  const filters = {
    predicate: (query: { queryKey: readonly unknown[] }) =>
      isInventoryQuery(query.queryKey, environmentId),
  };
  const active = client
    .getQueryCache()
    .findAll(filters)
    .filter((query) => query.isActive());
  await client.invalidateQueries(filters);
  await Promise.all(
    active.map(async (query) => {
      if (query.state.isInvalidated && query.state.status === 'success')
        await query.fetch().catch(() => undefined);
      if (query.state.isInvalidated && query.state.status === 'success')
        throw new Error(
          'Git state refresh was interrupted. Check the action again.',
        );
    }),
  );
}

async function onNotice(
  client: QueryClient,
  environmentId: string,
  notice: LiveNotice,
) {
  if (notice.type === 'ready' || notice.type === 'heartbeat') return;
  if (notice.type === 'project') {
    if (notice.change === 'preferences')
      await client.invalidateQueries({
        predicate: (query) =>
          isFilePreferencesQuery(
            query.queryKey,
            environmentId,
            notice.projectId,
          ),
      });
    return;
  }
  if (notice.type === 'git-action') return;
  await client.invalidateQueries({
    predicate: (query) => isInventoryQuery(query.queryKey, environmentId),
  });
}

export default { subscriptionProjects, onNotice, onGitReceipt };
