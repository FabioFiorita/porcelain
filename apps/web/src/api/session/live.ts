import { inventoryResponseSchema } from '@porcelain/contracts/inventory';
import type { SessionPort } from './port';

export function browserTransport(transport: typeof fetch): typeof fetch {
  return (input, init) => {
    const headers = new Headers(init?.headers);
    if (headers.get('authorization') === 'Bearer browser-session')
      headers.delete('authorization');
    headers.set('x-porcelain-browser', '1');
    return transport(input, { ...init, headers, credentials: 'same-origin' });
  };
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
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error('Could not end the browser session');
    },
  };
}
