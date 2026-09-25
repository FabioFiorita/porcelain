import { readHealthResponseSchema } from '@porcelain/contracts/access';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import { ConnectionError } from '../../../shared/api/connection-error';
import type { PairingPort } from './pairing-port';

export function createPairingLive(transport: typeof fetch): PairingPort {
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

function platformName() {
  const agent =
    typeof navigator === 'undefined' ? '' : navigator.userAgent.slice(0, 120);
  return agent === '' ? 'Browser' : agent;
}
