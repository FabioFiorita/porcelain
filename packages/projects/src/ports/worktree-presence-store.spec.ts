import { worktreePresenceStoreContract } from '../../spec/contracts/worktree-presence-store-contract.ts';
import { InMemoryWorktreePresenceStore } from '../../spec/fakes/in-memory-worktree-presence-store.ts';

worktreePresenceStoreContract('InMemoryWorktreePresenceStore', () => ({
  store: new InMemoryWorktreePresenceStore(),
  close: () => undefined,
}));
