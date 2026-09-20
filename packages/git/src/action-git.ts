import { applyStash } from './commands/apply-stash.ts';
import { commitIndex } from './commands/commit-index.ts';
import { createStash } from './commands/create-stash.ts';
import { fetchBranch } from './commands/fetch-branch.ts';
import { inspectActionState } from './commands/inspect-action-state.ts';
import { pullBranch } from './commands/pull-branch.ts';
import { pushBranch } from './commands/push-branch.ts';
import type { GitActionCommand, GitActionIntent } from './dtos/git-action.ts';
import type { GitActionSnapshot } from './dtos/git-action-snapshot.ts';
import type { GitActionWriter } from './interfaces/git-action-writer.ts';
import type { CheckoutSession } from './interfaces/git-session.ts';
import { GitActionRunner } from './run-git.ts';

export class ActionGit implements GitActionWriter {
  private readonly checkout: string;
  private readonly session: CheckoutSession;
  private readonly process: GitActionRunner;
  constructor(session: CheckoutSession) {
    this.checkout = session.path;
    this.session = session;
    this.process = new GitActionRunner(session.path);
  }
  async inspect(
    intent: GitActionIntent,
    signal: AbortSignal,
  ): Promise<GitActionSnapshot> {
    await this.session.verify(signal);
    return inspectActionState(this.checkout, this.process, intent, signal);
  }
  execute(
    preparation: GitActionCommand,
    snapshot: GitActionSnapshot,
    signal: AbortSignal,
  ) {
    switch (preparation.intent.action) {
      case 'commit':
        return commitIndex(this.process, preparation, signal);
      case 'fetch':
        return fetchBranch(this.process, preparation, snapshot, signal);
      case 'pull':
        return pullBranch(this.process, preparation, snapshot, signal);
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
