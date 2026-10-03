import {
  readEnvironmentResponseSchema,
  redeemPairingResponseSchema,
} from '@porcelain/contracts/access';
import { ENVIRONMENT_PROTOCOL } from '@porcelain/contracts/shared';
import { ConnectionError } from '../../shared/api/connection-error.ts';
import type { Transport } from '../../shared/api/transport.ts';
import type { RemoteLink } from './rules/pairing-link.ts';
import type { RemoteAnswer } from './rules/remotes.ts';
import type { PairingPlatform } from './ports/pairing-platform.ts';

export function createRemoteApi(platform: PairingPlatform) {
  return {
    async pair(
      transport: Transport,
      link: RemoteLink,
      signal: AbortSignal,
    ): Promise<{ credential: string; deviceId: string }> {
      let response: Response;
      try {
        response = await transport('/api/pair', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ code: link.code, platform: platform.name() }),
          signal,
        });
      } catch (error) {
        throw new ConnectionError(
          `Could not reach ${link.address}. Check that Porcelain runs there and that this computer reaches it.`,
          { cause: error },
        );
      }
      if (!response.ok)
        throw new ConnectionError(
          'That link was not accepted. It works once, for a few minutes; run porcelain pair again.',
        );
      const paired = redeemPairingResponseSchema.parse(await response.json());
      if (!paired.credential)
        throw new ConnectionError('The remote paired but sent no credential.');
      return { credential: paired.credential, deviceId: paired.device.id };
    },
    async describe(
      transport: Transport,
      signal: AbortSignal,
      environmentId: string,
    ): Promise<RemoteAnswer> {
      let response: Response;
      try {
        response = await transport('/api/environment', { signal });
        if (response.status === 401) return { kind: 'unauthorized' };
        if (!response.ok) return { kind: 'unreachable' };
        const environment = readEnvironmentResponseSchema.parse(
          await response.json(),
        );
        if (
          environment.environmentId !== environmentId ||
          environment.protocol !== ENVIRONMENT_PROTOCOL
        )
          return { kind: 'described', environment };
        response = await transport('/api/session', { signal });
        if (response.status === 401) return { kind: 'unauthorized' };
        if (!response.ok) return { kind: 'unreachable' };
        return { kind: 'described', environment };
      } catch (error) {
        const timedOut =
          signal.reason instanceof DOMException &&
          signal.reason.name === 'TimeoutError';
        if (signal.aborted && !timedOut) throw error;
        return { kind: 'unreachable' };
      }
    },
  };
}
