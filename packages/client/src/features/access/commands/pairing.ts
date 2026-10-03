import { createRemoteApi } from '../api.ts';
import { ConnectionError } from '../../../shared/api/connection-error.ts';
import { remoteTransport } from '../../../shared/api/transport.ts';
import type { AccessPlatform } from '../ports/access-platform.ts';
import type { AccessStore } from '../store.ts';
import { remoteLink } from '../rules/pairing-link.ts';
import { remoteStatus } from '../rules/remotes.ts';

export async function pairEnvironment(
  store: AccessStore,
  platform: AccessPlatform,
  value: string,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  if (store.getState().status !== 'ready')
    throw new ConnectionError('Read saved environments before pairing.');
  const link = remoteLink(value);
  if (!link)
    throw new ConnectionError(
      'Paste the whole link porcelain pair printed, starting with http.',
    );
  const api = createRemoteApi(platform);
  const { credential, deviceId } = await api.pair(
    remoteTransport(link.address, undefined, platform.send),
    link,
    signal,
  );
  signal.throwIfAborted();
  const answer = await api.describe(
    remoteTransport(link.address, credential, platform.send),
    signal,
  );
  const status = remoteStatus(link, answer);
  if (status.kind !== 'online')
    throw new ConnectionError(
      status.kind === 'other-server'
        ? 'Another Porcelain answered at that address than the one that made the link.'
        : status.kind === 'incompatible'
          ? 'That Porcelain runs a version this app cannot talk to. Update both to the same version.'
          : 'The remote paired but did not answer afterwards. Try again.',
    );
  signal.throwIfAborted();
  const remote = {
    environmentId: link.environmentId,
    address: link.address,
    name: status.name,
    credential,
    deviceId,
  };
  await store.getState().save(remote);
  return remote;
}
