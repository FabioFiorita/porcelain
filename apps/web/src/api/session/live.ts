import { inventoryResponseSchema } from '@porcelain/contracts/inventory';
import { REQUEST_TIMEOUT_MS } from '../../lib/request-timeout';
import { reportUnauthorized } from '../unauthorized';
import type { SessionPort } from './port';

/**
 * The browser's whole credential is its device cookie, so this never sets an
 * authorization header: anything a page could attach, a page could also leak.
 *
 * It is also where the workspace learns it has lost access, because every live
 * request passes through here and a revoked device answers 401 to all of them.
 */
export function browserTransport(transport: typeof fetch): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    headers.delete('authorization');
    headers.set('x-porcelain-browser', '1');
    const response = await transport(input, {
      ...init,
      headers,
      credentials: 'same-origin',
    });
    // Establishing a connection is not losing one. Redeeming a link and
    // probing for an existing session both run before the browser knows
    // whether it has access, and a refusal there simply means it has none —
    // reporting it would also race a redemption that has just succeeded.
    if (response.status === 401 && !establishing(input)) reportUnauthorized();
    return response;
  };
}

function establishing(input: Parameters<typeof fetch>[0]) {
  const path = String(input);
  return path.endsWith('/api/pair') || path.endsWith('/api/session');
}

export function createSessionLive(transport: typeof fetch): SessionPort {
  return {
    async restore(signal) {
      const response = await transport('/api/session', {
        signal,
        redirect: 'error',
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('No active browser session');
      return inventoryResponseSchema.parse(await response.json());
    },
    async disconnect() {
      const response = await transport('/api/session', {
        method: 'DELETE',
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error('Could not end the browser session');
    },
  };
}
