import { commentSeenStoreContract } from '../../spec/contracts/comment-seen-store-contract.ts';
import { InMemoryCommentSeenStore } from '../../spec/fakes/in-memory-comment-seen-store.ts';

commentSeenStoreContract('InMemoryCommentSeenStore', () => ({
  store: new InMemoryCommentSeenStore(),
  close: () => undefined,
}));
