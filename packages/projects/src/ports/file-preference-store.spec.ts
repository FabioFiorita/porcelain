import { filePreferenceStoreContract } from '../../spec/contracts/file-preference-store-contract.ts';
import { InMemoryFilePreferenceStore } from '../../spec/fakes/in-memory-file-preference-store.ts';

filePreferenceStoreContract('InMemoryFilePreferenceStore', () => ({
  store: new InMemoryFilePreferenceStore(),
  close: () => undefined,
}));
