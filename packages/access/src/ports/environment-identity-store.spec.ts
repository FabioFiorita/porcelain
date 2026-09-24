import { environmentIdentityStoreContract } from '../../spec/contracts/environment-identity-store-contract.ts';
import { FixedEnvironmentIdentityStore } from '../../spec/fakes/fixed-environment-identity-store.ts';

environmentIdentityStoreContract('FixedEnvironmentIdentityStore', () => ({
  store: new FixedEnvironmentIdentityStore('environment'),
  close: () => undefined,
}));
