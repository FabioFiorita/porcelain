import { environmentIdentityStoreContract } from '../../spec/contracts/environment-identity-store-contract.ts';
import { FixedEnvironmentIdentityReader } from '../../spec/fakes/fixed-environment-identity-reader.ts';

environmentIdentityStoreContract('FixedEnvironmentIdentityReader', () => ({
  store: new FixedEnvironmentIdentityReader('environment'),
  close: () => undefined,
}));
