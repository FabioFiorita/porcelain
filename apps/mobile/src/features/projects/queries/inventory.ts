import { skipToken, useQuery } from '@tanstack/react-query';
import {
  inventoryQueryOptions,
  inventoryScopeQueryOptions,
} from '@porcelain/client/projects';
import { remoteTransport } from '@porcelain/client/transport';
import type { Remote } from '@porcelain/client/access/rules';
import type { AccessPlatform } from '@porcelain/client/access';

export function useInventory(
  remote: Remote | undefined,
  send: AccessPlatform['send'],
) {
  const query = useQuery(
    remote
      ? inventoryQueryOptions({
          environmentId: remote.environmentId,
          transport: remoteTransport(remote.address, remote.credential, send),
          cacheIdentity: [remote.address, remote.deviceId ?? ''],
          request: (signal) => ({
            signal: signal ?? new AbortController().signal,
          }),
        })
      : {
          ...inventoryScopeQueryOptions(undefined),
          queryFn: skipToken,
        },
  );
  return {
    data: query.data,
    isPending: query.isPending,
    isError: query.isError,
    read: () => {
      void query.refetch();
    },
  };
}
