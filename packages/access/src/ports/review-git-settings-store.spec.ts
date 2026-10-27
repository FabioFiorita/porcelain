import { reviewGitSettingsStoreContract } from '../../spec/contracts/review-git-settings-store-contract.ts';
import { InMemoryReviewGitSettingsStore } from '../../spec/fakes/in-memory-review-git-settings-store.ts';

reviewGitSettingsStoreContract('InMemoryReviewGitSettingsStore', () => ({
  store: new InMemoryReviewGitSettingsStore(),
  close: () => undefined,
}));
