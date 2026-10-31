import { environmentLabelStoreContract } from '../../spec/contracts/environment-label-store-contract.ts';
import { InMemoryEnvironmentLabelStore } from '../../spec/fakes/in-memory-environment-label-store.ts';

environmentLabelStoreContract('InMemoryEnvironmentLabelStore', () => ({
  store: new InMemoryEnvironmentLabelStore(),
  close: () => undefined,
}));
