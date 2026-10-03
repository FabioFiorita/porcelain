import { remoteAccessStoreContract } from '../../spec/contracts/remote-access-store-contract.ts';
import { InMemoryRemoteAccessStore } from '../../spec/fakes/in-memory-remote-access-store.ts';

remoteAccessStoreContract('InMemoryRemoteAccessStore', () => ({
  store: new InMemoryRemoteAccessStore(),
  close: () => undefined,
}));
