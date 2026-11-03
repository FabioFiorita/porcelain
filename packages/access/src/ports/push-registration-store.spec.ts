import { pushRegistrationStoreContract } from '../../spec/contracts/push-registration-store-contract.ts';
import { InMemoryPushRegistrationStore } from '../../spec/fakes/in-memory-push-registration-store.ts';

pushRegistrationStoreContract('InMemoryPushRegistrationStore', () => ({
  store: new InMemoryPushRegistrationStore(),
  close: () => undefined,
}));
