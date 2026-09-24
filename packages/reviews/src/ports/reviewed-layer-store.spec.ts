import { reviewedLayerStoreContract } from '../../spec/contracts/reviewed-layer-store-contract.ts';
import { InMemoryReviewedLayerStore } from '../../spec/fakes/in-memory-reviewed-layer-store.ts';

reviewedLayerStoreContract('InMemoryReviewedLayerStore', () => ({
  store: new InMemoryReviewedLayerStore(),
  close: () => undefined,
}));
