import { ConnectionError } from '@porcelain/client/errors/connection-error';
import type { Inventory } from '../../domain/inventory';
import type { InventoryPort } from './port';

export type MockScenario =
  | 'populated'
  | 'empty'
  | 'unavailable'
  | 'slow'
  | 'rejected'
  | 'refresh-failed';

function seed(scenario: MockScenario): Inventory {
  return {
    environmentId: '7fe18f78-1477-4c19-a42b-cdd42f862151',
    projects:
      scenario === 'empty'
        ? []
        : [
            {
              id: 'fac0e50f-b019-4e46-9dd1-efcb6af7dc09',
              name: 'Sample project',
              available: scenario !== 'unavailable',
              worktrees: [
                {
                  id: '801a8628-1cd6-4562-81a2-9c05fba76b4a',
                  path: '/fixtures/sample-project',
                  branch: 'refs/heads/main',
                  main: true,
                  available: scenario !== 'unavailable',
                },
                {
                  id: '629a8628-1cd6-4562-81a2-9c05fba76b4b',
                  path: '/fixtures/sample-review',
                  branch: 'refs/heads/agent/review',
                  main: false,
                  available: true,
                },
              ],
            },
          ],
  };
}

export function createMockStore(scenario: MockScenario = 'populated') {
  return {
    inventory: seed(scenario),
    delayMs: scenario === 'slow' ? 1500 : 0,
    rejected: scenario === 'rejected',
    refreshFailed: scenario === 'refresh-failed',
    refreshCount: 0,
  };
}

export function createInventoryMock(
  store: ReturnType<typeof createMockStore>,
): InventoryPort {
  return {
    async read({ token, signal, refresh }) {
      signal.throwIfAborted();
      if (store.delayMs > 0)
        await new Promise<void>((resolve, reject) => {
          const onAbort = () => {
            clearTimeout(timer);
            reject(signal.reason);
          };
          const timer = setTimeout(() => {
            signal.removeEventListener('abort', onAbort);
            resolve();
          }, store.delayMs);
          signal.addEventListener('abort', onAbort, { once: true });
        });
      signal.throwIfAborted();
      if (!token.trim() || store.rejected)
        throw new ConnectionError(
          'Access token was rejected. Check it and try again.',
        );
      if (refresh && store.refreshFailed)
        throw new ConnectionError(
          'The environment could not complete the request. Try again.',
        );
      if (refresh) store.refreshCount += 1;
      return structuredClone(store.inventory);
    },
  };
}
