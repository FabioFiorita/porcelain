import { worktreeCatalogStoreContract } from '../../spec/contracts/worktree-catalog-store-contract.ts';
import { InMemoryWorktreeCatalogStore } from '../../spec/fakes/in-memory-worktree-catalog-store.ts';

worktreeCatalogStoreContract('InMemoryWorktreeCatalogStore', () => ({
  store: new InMemoryWorktreeCatalogStore(),
  close: () => undefined,
}));
