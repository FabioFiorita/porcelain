import {
  readEnvironmentEndpoint,
  readSessionEndpoint,
  redeemPairingEndpoint,
} from '@porcelain/contracts/access';
import { ENVIRONMENT_PROTOCOL } from '@porcelain/contracts/shared';
import { ConnectionError } from '../../shared/api/connection-error.ts';
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

import {
  readHealthEndpoint,
  clearBrowserSessionEndpoint,
} from '@porcelain/contracts/access';
import { readInventoryEndpoint } from '@porcelain/contracts/projects';
import {
  listAccessEndpoint,
  issuePairingEndpoint,
  setDeviceTrustEndpoint,
  revokeAccessEndpoint,
  readRemoteAccessEndpoint,
  readServiceUpdateEndpoint,
  startServiceUpdateEndpoint,
  renameEnvironmentEndpoint,
  setRemoteAccessEndpoint,
} from '@porcelain/contracts/access';
import { type SetRemoteAccessRequest } from '@porcelain/contracts/access';
import { type ReadInventoryResponse } from '@porcelain/contracts/projects';
import { RequestError, requestEndpoint } from '../../shared/api/request.ts';
import { perConnection } from '../../shared/api/per-connection.ts';
import type { PairingCode } from './rules/pairing-link.ts';

type PairingPort = {
  redeem(
    request: PairingCode & { signal: AbortSignal },
  ): Promise<ReadInventoryResponse>;
};

type SessionPort = {
  restore(request: {
    signal: AbortSignal;
  }): Promise<ReadInventoryResponse | null>;
  disconnect(): Promise<void>;
};

function createPairingApi(
  transport: Transport,
  platform: PairingPlatform,
): PairingPort {
  return {
    async redeem({ code, environmentId, signal }) {
      let health;
      try {
        health = await requestEndpoint(transport, readHealthEndpoint, {
          signal,
        });
      } catch (error) {
        if (
          !(error instanceof ConnectionError) &&
          !(error instanceof RequestError)
        )
          throw new ConnectionError(
            'That address answered, but it is not a Porcelain server.',
          );
        throw new ConnectionError(
          'Could not reach Porcelain. Check that the server is running, then open the link again.',
          { cause: error },
        );
      }
      if (health.environmentId !== environmentId)
        throw new ConnectionError(
          'This link was made for a different Porcelain installation.',
        );
      try {
        await requestEndpoint(transport, redeemPairingEndpoint, {
          body: { code, platform: platform.name() },
          signal,
        });
      } catch (error) {
        if (error instanceof RequestError)
          throw new ConnectionError(
            'This pairing link is not usable. Ask for a new one.',
          );
        throw error;
      }
      try {
        return await requestEndpoint(transport, readInventoryEndpoint, {
          signal,
        });
      } catch (error) {
        if (error instanceof RequestError)
          throw new ConnectionError(
            'Pairing succeeded but the workspace could not be loaded. Reload the page.',
          );
        throw error;
      }
    },
  };
}

function createSessionApi(
  restoringTransport: Transport,
  connectedTransport: Transport,
  disconnectSignal: () => AbortSignal,
): SessionPort {
  return {
    async restore({ signal }) {
      try {
        return await requestEndpoint(
          restoringTransport,
          readInventoryEndpoint,
          { signal },
        );
      } catch (error) {
        if (error instanceof RequestError && error.status === 401) return null;
        if (error instanceof RequestError)
          throw new ConnectionError(
            'Could not reach Porcelain to restore this browser session.',
          );
        throw error;
      }
    },
    async disconnect() {
      await requestEndpoint(connectedTransport, clearBrowserSessionEndpoint, {
        signal: disconnectSignal(),
      });
    },
  };
}

function createShareApi(transport: Transport) {
  return {
    list: ({ signal }: { signal: AbortSignal }) =>
      requestEndpoint(transport, listAccessEndpoint, { signal }),
    issue: ({
      signal,
      label,
      addresses,
      trusted,
    }: {
      signal: AbortSignal;
      label: string;
      addresses: string[];
      trusted: boolean;
    }) =>
      requestEndpoint(transport, issuePairingEndpoint, {
        body: {
          labels: [label],
          addresses,
          ...(trusted ? { trusted } : {}),
        },
        signal,
      }),
    trust: ({
      signal,
      id,
      trusted,
    }: {
      signal: AbortSignal;
      id: string;
      trusted: boolean;
    }) =>
      requestEndpoint(transport, setDeviceTrustEndpoint, {
        body: { id, trusted },
        signal,
      }),
    revoke: ({ signal, id }: { signal: AbortSignal; id: string }) =>
      requestEndpoint(transport, revokeAccessEndpoint, {
        body: { id },
        signal,
      }),
    remote: async ({ signal }: { signal: AbortSignal }) => {
      try {
        return await requestEndpoint(transport, readRemoteAccessEndpoint, {
          signal,
        });
      } catch (error) {
        if (error instanceof RequestError && error.status === 403) return null;
        throw error;
      }
    },
    serviceUpdate: ({ signal }: { signal: AbortSignal }) =>
      requestEndpoint(transport, readServiceUpdateEndpoint, { signal }),
    startServiceUpdate: ({
      signal,
      version,
    }: {
      signal: AbortSignal;
      version: string;
    }) =>
      requestEndpoint(transport, startServiceUpdateEndpoint, {
        body: { version },
        signal,
      }),
    rename: ({ signal, name }: { signal: AbortSignal; name: string | null }) =>
      requestEndpoint(transport, renameEnvironmentEndpoint, {
        body: { name },
        signal,
      }),
    setRemote: ({
      signal,
      change,
    }: {
      signal: AbortSignal;
      change: SetRemoteAccessRequest;
    }) =>
      requestEndpoint(transport, setRemoteAccessEndpoint, {
        body: change,
        signal,
      }),
  };
}

export const shareApi = perConnection(createShareApi);

export function createBrowserAccessApi(options: {
  pairingTransport: Transport;
  restoringTransport: Transport;
  connectedTransport: Transport;
  platform: PairingPlatform;
  disconnectSignal: () => AbortSignal;
}) {
  return {
    pairing: createPairingApi(options.pairingTransport, options.platform),
    session: createSessionApi(
      options.restoringTransport,
      options.connectedTransport,
      options.disconnectSignal,
    ),
  };
}
