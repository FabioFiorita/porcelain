import { reviewStoreContract } from '../../spec/contracts/review-store-contract.ts';
import { InMemoryReviewStore } from '../../spec/fakes/in-memory-review-store.ts';

reviewStoreContract('InMemoryReviewStore', () => ({
  store: new InMemoryReviewStore(),
  close: () => undefined,
}));
