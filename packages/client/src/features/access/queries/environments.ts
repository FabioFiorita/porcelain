import type { QueryFunctionContext } from '@tanstack/query-core';
import { createRemoteApi } from '../api.ts';
import { remoteTransport } from '../../../shared/api/transport.ts';
import type { AccessPlatform } from '../ports/access-platform.ts';
import { remoteStatus, type Remote } from '../rules/remotes.ts';

export function environmentQueryOptions(
  platform: AccessPlatform,
  remote: Remote,
) {
  return {
    queryKey: [
      'environment',
      remote.environmentId,
      remote.address,
      remote.deviceId,
    ],
    queryFn: async ({ signal }: QueryFunctionContext) => {
      const answer = await createRemoteApi(platform).describe(
        remoteTransport(remote.address, remote.credential, platform.send),
        signal,
        remote.environmentId,
      );
      return remoteStatus(remote, answer);
    },
  };
}
