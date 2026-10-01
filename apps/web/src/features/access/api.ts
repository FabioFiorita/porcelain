import {
  readEnvironmentResponseSchema,
  redeemPairingResponseSchema,
  issuePairingRequestSchema,
  issuePairingResponseSchema,
  listAccessResponseSchema,
  readHealthResponseSchema,
  readRemoteAccessResponseSchema,
  readServiceUpdateResponseSchema,
  startServiceUpdateRequestSchema,
  startServiceUpdateResponseSchema,
  renameEnvironmentRequestSchema,
  renameEnvironmentResponseSchema,
  revokeAccessRequestSchema,
  setDeviceTrustRequestSchema,
  setDeviceTrustResponseSchema,
  revokeAccessResponseSchema,
  setRemoteAccessRequestSchema,
  setRemoteAccessResponseSchema,
  type SetRemoteAccessRequest,
} from '@porcelain/contracts/access';
import {
  readInventoryResponseSchema,
  type ReadInventoryResponse,
} from '@porcelain/contracts/projects';
import { WEB_PLATFORM_NAME_MAX_LENGTH } from '@/config/limits';
import { ConnectionError } from '@/shared/api/connection-error';
import { RequestError, requestJson } from '@/shared/api/request';
import { REQUEST_TIMEOUT_MS } from '@/shared/api/request-timeout';
import { perConnection } from '@/shared/api/per-connection';
import { browserTransport, type Transport } from '@/shared/api/transport';
import type { PairingCode } from './rules/pairing-link';
import type { RemoteAnswer, RemoteLink } from './rules/remotes';

type PairingPort = {
  redeem(
    request: PairingCode & { signal: AbortSignal },
  ): Promise<ReadInventoryResponse>;
};

type SessionPort = {
  restore(signal: AbortSignal): Promise<ReadInventoryResponse | null>;
  disconnect(): Promise<void>;
};

function createPairingApi(transport: Transport): PairingPort {
  return {
    async redeem({ code, environmentId, signal }) {
      let health: unknown;
      try {
        const response = await transport('/api/health', {
          signal,
          redirect: 'error',
          cache: 'no-store',
        });
        if (!response.ok) throw new Error(`Health answered ${response.status}`);
        health = await response.json();
      } catch (error) {
        throw new ConnectionError(
          'Could not reach Porcelain. Check that the server is running, then open the link again.',
          { cause: error },
        );
      }
      const parsed = readHealthResponseSchema.safeParse(health);
      if (!parsed.success)
        throw new ConnectionError(
          'That address answered, but it is not a Porcelain server.',
        );
      if (parsed.data.environmentId !== environmentId)
        throw new ConnectionError(
          'This link was made for a different Porcelain installation.',
        );
      const response = await transport('/api/pair', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code, platform: platformName() }),
        signal,
        redirect: 'error',
        cache: 'no-store',
      });
      if (!response.ok)
        throw new ConnectionError(
          'This pairing link is not usable. Ask for a new one.',
        );
      const inventory = await transport('/api/inventory', {
        signal,
        redirect: 'error',
        cache: 'no-store',
      });
      if (!inventory.ok)
        throw new ConnectionError(
          'Pairing succeeded but the workspace could not be loaded. Reload the page.',
        );
      return readInventoryResponseSchema.parse(await inventory.json());
    },
  };
}

function createSessionApi(
  restoringTransport: Transport,
  connectedTransport: Transport = restoringTransport,
): SessionPort {
  return {
    async restore(signal) {
      const response = await restoringTransport('/api/inventory', {
        signal,
        redirect: 'error',
        cache: 'no-store',
      });
      if (response.status === 401) return null;
      if (!response.ok)
        throw new ConnectionError(
          'Could not reach Porcelain to restore this browser session.',
        );
      return readInventoryResponseSchema.parse(await response.json());
    },
    async disconnect() {
      const response = await connectedTransport('/api/session', {
        method: 'DELETE',
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error('Could not end the browser session');
    },
  };
}

function createShareApi(transport: Transport) {
  const json = { 'content-type': 'application/json' };
  return {
    list: (signal: AbortSignal) =>
      requestJson(transport, '/api/access', listAccessResponseSchema, {
        signal,
      }),
    issue: (
      signal: AbortSignal,
      label: string,
      addresses: string[],
      trusted: boolean,
    ) =>
      requestJson(transport, '/api/pairings', issuePairingResponseSchema, {
        method: 'POST',
        headers: json,
        body: JSON.stringify(
          issuePairingRequestSchema.parse({
            labels: [label],
            addresses,
            ...(trusted ? { trusted } : {}),
          }),
        ),
        signal,
      }),
    trust: (signal: AbortSignal, id: string, trusted: boolean) =>
      requestJson(
        transport,
        '/api/access/trust',
        setDeviceTrustResponseSchema,
        {
          method: 'POST',
          headers: json,
          body: JSON.stringify(
            setDeviceTrustRequestSchema.parse({ id, trusted }),
          ),
          signal,
        },
      ),
    revoke: (signal: AbortSignal, id: string) =>
      requestJson(transport, '/api/access/revoke', revokeAccessResponseSchema, {
        method: 'POST',
        headers: json,
        body: JSON.stringify(revokeAccessRequestSchema.parse({ id })),
        signal,
      }),
    remote: async (signal: AbortSignal) => {
      try {
        return await requestJson(
          transport,
          '/api/remote-access',
          readRemoteAccessResponseSchema,
          { signal },
        );
      } catch (error) {
        if (error instanceof RequestError && error.status === 403) return null;
        throw error;
      }
    },
    serviceUpdate: (signal: AbortSignal) =>
      requestJson(
        transport,
        '/api/service/update',
        readServiceUpdateResponseSchema,
        { signal },
      ),
    startServiceUpdate: (signal: AbortSignal, version: string) =>
      requestJson(
        transport,
        '/api/service/update',
        startServiceUpdateResponseSchema,
        {
          method: 'POST',
          headers: json,
          body: JSON.stringify(
            startServiceUpdateRequestSchema.parse({ version }),
          ),
          signal,
        },
      ),
    rename: (signal: AbortSignal, name: string | null) =>
      requestJson(
        transport,
        '/api/environment/name',
        renameEnvironmentResponseSchema,
        {
          method: 'PUT',
          headers: json,
          body: JSON.stringify(renameEnvironmentRequestSchema.parse({ name })),
          signal,
        },
      ),
    setRemote: (signal: AbortSignal, change: SetRemoteAccessRequest) =>
      requestJson(
        transport,
        '/api/remote-access',
        setRemoteAccessResponseSchema,
        {
          method: 'PATCH',
          headers: json,
          body: JSON.stringify(setRemoteAccessRequestSchema.parse(change)),
          signal,
        },
      ),
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

export const remoteApi = {
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
        body: JSON.stringify({ code: link.code, platform: platformName() }),
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
  ): Promise<RemoteAnswer> {
    let response: Response;
    try {
      response = await transport('/api/environment', { signal });
    } catch (error) {
      const timedOut =
        signal.reason instanceof DOMException &&
        signal.reason.name === 'TimeoutError';
      if (signal.aborted && !timedOut) throw error;
      return { kind: 'unreachable' };
    }
    if (response.status === 401) return { kind: 'unauthorized' };
    if (!response.ok) return { kind: 'unreachable' };
    return {
      kind: 'described',
      environment: readEnvironmentResponseSchema.parse(await response.json()),
    };
  },
};
