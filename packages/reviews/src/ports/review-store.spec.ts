import { reviewStoreContract } from '../../spec/contracts/review-store-contract.ts';
import { InMemoryReviewStore } from '../../spec/fakes/in-memory-review-store.ts';
import { InMemoryReviewedLayerStore } from '../../spec/fakes/in-memory-reviewed-layer-store.ts';

reviewStoreContract('InMemoryReviewStore', () => {
  const reviewedLayers = new InMemoryReviewedLayerStore();
  return {
    store: new InMemoryReviewStore([], reviewedLayers),
    reviewedLayers,
    close: () => undefined,
  };
});
