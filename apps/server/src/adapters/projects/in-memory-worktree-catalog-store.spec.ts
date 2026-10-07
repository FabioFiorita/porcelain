import { Effect } from 'effect';
import { WorktreeCatalogStore } from '@porcelain/projects/ports';
import { worktreeCatalogStoreContract } from '@porcelain/projects/store-contracts';
import { inMemoryWorktreeCatalogStoreLayer } from './in-memory-worktree-catalog-store.ts';

worktreeCatalogStoreContract('InMemoryWorktreeCatalogStore', () => ({
  store: Effect.runSync(
    WorktreeCatalogStore.pipe(
      Effect.provide(inMemoryWorktreeCatalogStoreLayer),
    ),
  ),
  close: () => undefined,
}));
