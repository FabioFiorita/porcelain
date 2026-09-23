import type { GitActionScope } from '../models/git-action.ts';
import type { GitActionStore } from '../ports/git-action-store.ts';

export class DismissInterruptedGitActionService {
  private readonly store: Pick<GitActionStore, 'dismissInterrupted'>;

  constructor(store: Pick<GitActionStore, 'dismissInterrupted'>) {
    this.store = store;
  }

  execute(scope: GitActionScope, requestId: string): void {
    this.store.dismissInterrupted(scope, requestId);
  }
}
