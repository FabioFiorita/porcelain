import { readProjectPullRequest } from '@porcelain/client/projects';
import { pullRequestCheckout } from '@porcelain/client/projects/rules';
import { useInventory } from '@/features/projects/index';
import { useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import type { Connection } from '@/shared/workspace/connection';
export function usePullRequestCheckout(
  connection: Connection,
  projectId: string,
  number: number,
) {
  const value = Option.getOrUndefined(
    AsyncResult.value(
      useAtomValue(readProjectPullRequest({ connection, projectId, number })),
    ),
  );
  const inventory = useInventory(connection);
  if (value?.kind !== 'available') return undefined;
  return pullRequestCheckout(
    inventory.projects,
    projectId,
    value.pullRequest.headBranch,
  );
}
