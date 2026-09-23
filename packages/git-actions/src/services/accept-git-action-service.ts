import { createHash } from 'node:crypto';
import type {
  GitActionExpectation,
  GitActionIntent,
  GitActionReceipt,
  GitActionScope,
} from '../models/git-action.ts';
import type { GitActionStore } from '../ports/git-action-store.ts';

export class AcceptGitActionService {
  private readonly store: Pick<GitActionStore, 'acceptDirect'>;

  constructor(store: Pick<GitActionStore, 'acceptDirect'>) {
    this.store = store;
  }

  execute(
    scope: GitActionScope,
    requestId: string,
    intent: GitActionIntent,
    expected: GitActionExpectation,
  ): { receipt: GitActionReceipt; created: boolean } {
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ scope, input: intent, expected }))
      .digest('hex');
    return this.store.acceptDirect(
      scope,
      requestId,
      intent,
      expected,
      fingerprint,
    );
  }
}
