import { ConnectionError } from '@porcelain/client/errors/connection-error';
import type { createMockStore } from '../inventory/mock';
import { createInventoryMock } from '../inventory/mock';
import type { PairingPort } from './port';

export function createPairingMock(
  store: ReturnType<typeof createMockStore>,
): PairingPort {
  return {
    async redeem({ code, environmentId, signal }) {
      signal.throwIfAborted();
      if (environmentId !== store.inventory.environmentId)
        throw new ConnectionError(
          'This link was made for a different Porcelain installation.',
        );
      if (store.rejected || code === '')
        throw new ConnectionError(
          'This pairing link is not usable. Ask for a new one.',
        );
      store.paired = true;
      return createInventoryMock(store).read({ signal });
    },
  };
}
