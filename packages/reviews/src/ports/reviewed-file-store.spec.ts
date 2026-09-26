import { reviewedFileStoreContract } from '../../spec/contracts/reviewed-file-store-contract.ts';
import { InMemoryReviewedFileStore } from '../../spec/fakes/in-memory-reviewed-file-store.ts';

reviewedFileStoreContract('InMemoryReviewedFileStore', () => ({
  store: new InMemoryReviewedFileStore(),
  close: () => undefined,
}));
