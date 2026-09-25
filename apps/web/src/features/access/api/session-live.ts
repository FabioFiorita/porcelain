import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import { REQUEST_TIMEOUT_MS } from '@/shared/api/request-timeout';
import type { SessionPort } from './session-port';

export function createSessionLive(
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
