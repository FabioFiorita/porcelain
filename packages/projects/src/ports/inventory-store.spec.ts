import { inventoryStoreContract } from '../../spec/contracts/inventory-store-contract.ts';
import { InMemoryInventoryStore } from '../../spec/fakes/in-memory-inventory-store.ts';

inventoryStoreContract('InMemoryInventoryStore', () => ({
  store: new InMemoryInventoryStore(),
  close: () => undefined,
}));
