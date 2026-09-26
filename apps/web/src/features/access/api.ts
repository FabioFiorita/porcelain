import { readHealthResponseSchema } from '@porcelain/contracts/access';
import {
  readInventoryResponseSchema,
  type ReadInventoryResponse,
} from '@porcelain/contracts/projects';
import { WEB_PLATFORM_NAME_MAX_LENGTH } from '@/config/limits';
import { ConnectionError } from '@/shared/api/connection-error';
import { REQUEST_TIMEOUT_MS } from '@/shared/api/request-timeout';
import { browserTransport } from '@/shared/api/transport';
import type { PairingCode } from './rules/pairing-link';

export type PairingPort = {
  redeem(
    request: PairingCode & { signal: AbortSignal },
  ): Promise<ReadInventoryResponse>;
};

export type SessionPort = {
  restore(signal: AbortSignal): Promise<ReadInventoryResponse>;
  disconnect(): Promise<void>;
};

function createPairingApi(transport: typeof fetch): PairingPort {
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
  restoringTransport: typeof fetch,
  connectedTransport: typeof fetch = restoringTransport,
): SessionPort {
  return {
    async restore(signal) {
      const response = await restoringTransport('/api/inventory', {
        signal,
        redirect: 'error',
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('No active browser session');
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
