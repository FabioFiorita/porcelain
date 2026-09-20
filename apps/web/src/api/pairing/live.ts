import { ConnectionError } from '@porcelain/client/errors/connection-error';
import { healthResponseSchema } from '@porcelain/contracts/health';
import { inventoryResponseSchema } from '@porcelain/contracts/inventory';
import type { PairingPort } from './port';

/**
 * A pairing code is live and single use, so the browser proves it is talking
 * to the installation the link was made for *before* it sends the code. The
 * environment id rides in the link and is public on `/api/health`; sending the
 * code first and learning afterwards is the worse trade.
 */
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
        // Unreachable is a connection failure, not a bad link: the owner can
        // start the server and open the same link again.
        throw new ConnectionError(
          'Could not reach Porcelain. Check that the server is running, then open the link again.',
          { cause: error },
        );
      }
      const parsed = healthResponseSchema.safeParse(health);
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
      // Invalid, already used and expired are one answer on purpose: telling
      // them apart tells whoever holds a stolen link which ones are live.
      if (!response.ok)
        throw new ConnectionError(
          'This pairing link is not usable. Ask for a new one.',
        );
      const inventory = await transport('/api/session', {
        signal,
        redirect: 'error',
        cache: 'no-store',
      });
      if (!inventory.ok)
        throw new ConnectionError(
          'Pairing succeeded but the workspace could not be loaded. Reload the page.',
        );
      return inventoryResponseSchema.parse(await inventory.json());
    },
  };
}

function platformName() {
  const agent =
    typeof navigator === 'undefined' ? '' : navigator.userAgent.slice(0, 120);
  return agent === '' ? 'Browser' : agent;
}
