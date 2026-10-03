import { commentStoreContract } from '../../spec/contracts/comment-store-contract.ts';
import { InMemoryCommentStore } from '../../spec/fakes/in-memory-comment-store.ts';

commentStoreContract('InMemoryCommentStore', () => ({
  store: new InMemoryCommentStore(),
  close: () => undefined,
}));
