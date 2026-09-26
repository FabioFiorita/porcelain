import { worktreeCatalogStoreContract } from '@porcelain/projects/store-contracts';
import { InMemoryWorktreeCatalogStore } from './in-memory-worktree-catalog-store.ts';

worktreeCatalogStoreContract('InMemoryWorktreeCatalogStore', () => ({
  store: new InMemoryWorktreeCatalogStore(),
  close: () => undefined,
}));
