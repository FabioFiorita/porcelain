import {
  readHealthEndpoint,
  redeemPairingEndpoint,
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
import {
  REQUEST_TIMEOUT_MS,
  WEB_PLATFORM_NAME_MAX_LENGTH,
} from '@/config/limits';
import { ConnectionError } from '@porcelain/client/transport';
import { RequestError, requestEndpoint } from '@porcelain/client/transport';
import { perConnection } from '@porcelain/client/transport';
import { browserTransport } from '@/shared/api/transport';
import type { Transport } from '@porcelain/client/transport';
import type { PairingCode } from '@porcelain/client/access/rules';
import { createRemoteApi } from '@porcelain/client/access/api';
import type { PairingPlatform } from '@porcelain/client/access';

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

function createPairingApi(transport: Transport): PairingPort {
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
          body: { code, platform: platformName() },
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
  connectedTransport: Transport = restoringTransport,
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
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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

export const accessApi = {
  pairing: createPairingApi(browserTransport(fetch)),
  session: createSessionApi(
    browserTransport(fetch, { reportUnauthorized: false }),
    browserTransport(fetch),
  ),
};

function platformName() {
  const agent =
    typeof navigator === 'undefined'
      ? ''
      : navigator.userAgent.slice(0, WEB_PLATFORM_NAME_MAX_LENGTH);
  return agent === '' ? 'Browser' : agent;
}

const remotePlatform: PairingPlatform = { name: platformName };

export const remoteApi = createRemoteApi(remotePlatform);
