import type {
  GitActionIntent,
  GitActionPreparation,
} from '../models/git-action.ts';
import { applyStash } from './commands/apply-stash.ts';
import { commitIndex } from './commands/commit-index.ts';
import { createStash } from './commands/create-stash.ts';
import { fetchBranch } from './commands/fetch-branch.ts';
import { inspectActionState } from './commands/inspect-action-state.ts';
import { pushBranch } from './commands/push-branch.ts';
import { verifyCheckout } from './commands/verify-checkout.ts';
import type { GitActionSnapshot } from './dtos/git-action-snapshot.ts';
import { GitActionProcess } from './git-action-process.ts';
import type { GitActionWriter } from './interfaces/git-action-writer.ts';

export class ActionGit implements GitActionWriter {
  private readonly checkout: string;
  private readonly identity: string;
  private readonly repositoryIdentity: string;
  private readonly process: GitActionProcess;
  constructor(checkout: string, identity: string, repositoryIdentity: string) {
    this.checkout = checkout;
    this.identity = identity;
    this.repositoryIdentity = repositoryIdentity;
    this.process = new GitActionProcess(checkout);
  }
  async inspect(
    intent: GitActionIntent,
    signal: AbortSignal,
  ): Promise<GitActionSnapshot> {
    await verifyCheckout(
      this.checkout,
      this.identity,
      this.repositoryIdentity,
      signal,
    );
    return inspectActionState(this.checkout, this.process, intent, signal);
  }
  execute(
    preparation: GitActionPreparation,
    snapshot: GitActionSnapshot,
    signal: AbortSignal,
  ) {
    switch (preparation.intent.action) {
      case 'commit':
        return commitIndex(this.process, preparation, signal);
      case 'fetch':
        return fetchBranch(this.process, preparation, snapshot, signal);
      case 'push':
        return pushBranch(this.process, preparation, snapshot, signal);
      case 'stash-create':
        return createStash(this.process, preparation, signal);
      case 'stash-apply':
      case 'stash-pop':
        return applyStash(this.process, preparation, snapshot, signal);
    }
  }
}
