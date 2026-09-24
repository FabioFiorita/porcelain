import { gitActionReceiptStoreContract } from '../../spec/contracts/git-action-receipt-store-contract.ts';
import { InMemoryGitActionReceiptStore } from '../../spec/fakes/in-memory-git-action-receipt-store.ts';

gitActionReceiptStoreContract('InMemoryGitActionReceiptStore', () => ({
  store: new InMemoryGitActionReceiptStore(),
  close: () => undefined,
}));
