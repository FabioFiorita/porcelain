import {
  readEnvironmentEndpoint,
  readSessionEndpoint,
  redeemPairingEndpoint,
} from '@porcelain/contracts/access';
import { ENVIRONMENT_PROTOCOL } from '@porcelain/contracts/shared';
import { ConnectionError } from '../../shared/api/connection-error.ts';
import { RequestError, requestEndpoint } from '../../shared/api/request.ts';
import type { Transport } from '../../shared/api/transport.ts';
import type { RemoteLink } from './rules/pairing-link.ts';
import type { RemoteAnswer } from './rules/remotes.ts';
import type { PairingPlatform } from './ports/pairing-platform.ts';

export function createRemoteApi(platform: PairingPlatform) {
  return {
    async pair({
      transport,
      link,
      signal,
    }: {
      transport: Transport;
      link: RemoteLink;
      signal: AbortSignal;
    }): Promise<{ credential: string; deviceId: string }> {
      let paired;
      try {
        paired = await requestEndpoint(transport, redeemPairingEndpoint, {
          body: { code: link.code, platform: platform.name() },
          signal,
        });
      } catch (error) {
        if (error instanceof RequestError)
          throw new ConnectionError(
            'That link was not accepted. It works once, for a few minutes; run porcelain pair again.',
          );
        if (error instanceof ConnectionError)
          throw new ConnectionError(
            `Could not reach ${link.address}. Check that Porcelain runs there and that this computer reaches it.`,
            { cause: error.cause },
          );
        throw error;
      }
      if (!paired.credential)
        throw new ConnectionError('The remote paired but sent no credential.');
      return { credential: paired.credential, deviceId: paired.device.id };
    },
    async describe({
      transport,
      signal,
      environmentId,
    }: {
      transport: Transport;
      signal: AbortSignal;
      environmentId: string;
    }): Promise<RemoteAnswer> {
      try {
        const environment = await requestEndpoint(
          transport,
          readEnvironmentEndpoint,
          { signal },
        );
        if (
          environment.environmentId !== environmentId ||
          environment.protocol !== ENVIRONMENT_PROTOCOL
        )
          return { kind: 'described', environment };
        await requestEndpoint(transport, readSessionEndpoint, { signal });
        return { kind: 'described', environment };
      } catch (error) {
        const timedOut =
          signal.reason instanceof DOMException &&
          signal.reason.name === 'TimeoutError';
        if (signal.aborted && !timedOut) throw error;
        if (error instanceof RequestError && error.status === 401)
          return { kind: 'unauthorized' };
        return { kind: 'unreachable' };
      }
    },
  };
}
