import { environmentNameStoreContract } from '../../spec/contracts/environment-name-store-contract.ts';
import { InMemoryEnvironmentNameStore } from '../../spec/fakes/in-memory-environment-name-store.ts';

environmentNameStoreContract('InMemoryEnvironmentNameStore', () => ({
  store: new InMemoryEnvironmentNameStore(),
  close: () => undefined,
}));
