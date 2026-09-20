import type { createMockStore } from '../inventory/mock';
import { createInventoryMock } from '../inventory/mock';
import type { SessionPort } from './port';
export function createSessionMock(
  store: ReturnType<typeof createMockStore>,
): SessionPort {
  return {
    restore: (signal) => createInventoryMock(store).read({ signal }),
    async disconnect() {
      if (store.disconnectFailed) throw new Error('Offline');
      store.paired = false;
    },
  };
}
