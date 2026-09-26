import { environmentIdentityReaderContract } from '../../spec/contracts/environment-identity-reader-contract.ts';
import { FixedEnvironmentIdentityReader } from '../../spec/fakes/fixed-environment-identity-reader.ts';

environmentIdentityReaderContract('FixedEnvironmentIdentityReader', () => ({
  store: new FixedEnvironmentIdentityReader('environment'),
  close: () => undefined,
}));
