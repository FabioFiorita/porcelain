import { applyStash } from './commands/apply-stash.ts';
import { commitIndex } from './commands/commit-index.ts';
import { createStash } from './commands/create-stash.ts';
import { discardPath } from './commands/discard-path.ts';
import { fetchBranch } from './commands/fetch-branch.ts';
import { inspectActionState } from './commands/inspect-action-state.ts';
import { inspectActionTarget } from './commands/inspect-action-target.ts';
import { manageBranch } from './commands/manage-branch.ts';
import { pullBranch } from './commands/pull-branch.ts';
import { pushBranch } from './commands/push-branch.ts';
import { readSelectedDiff } from '../inspection/commands/read-selected-diff.ts';
import type {
  GitActionCommand,
  GitActionExpectation,
  GitActionIntent,
} from './dtos/git-action.ts';
import type { GitActionSnapshot } from './dtos/git-action-snapshot.ts';
import type { GitActionWriter } from './interfaces/git-action-writer.ts';
import type { CheckoutSession } from '../inspection/interfaces/git-session.ts';
import { GitActionRunner } from './run-git-action.ts';

export class ActionGit implements GitActionWriter {
  private readonly checkout: string;
  private readonly session: CheckoutSession;
  private readonly process: GitActionRunner;
  constructor(session: CheckoutSession) {
    this.checkout = session.path;
    this.session = session;
    this.process = new GitActionRunner(session.path);
  }
  readSelectedDiff(
    headOid: string | null,
    paths: readonly string[],
    signal: AbortSignal,
  ) {
    return readSelectedDiff(this.session, headOid, paths, signal);
  }
  async listBranches(signal: AbortSignal) {
    await this.session.verify(signal);
    const currentResult = await this.process.execute(
      ['symbolic-ref', '--quiet', '--short', 'HEAD'],
      signal,
    );
    const current =
      currentResult.exitCode === 0
        ? currentResult.stdout.toString('utf8').trimEnd()
        : null;
    const rows = (
      await this.process.execute(
        [
          'for-each-ref',
          '--format=%(refname:short)%00%(upstream:short)%00%(committerdate:iso-strict)%00%(worktreepath)',
          '--sort=-committerdate',
          'refs/heads/',
        ],
        signal,
      )
    ).stdout
      .toString('utf8')
      .trimEnd()
      .split('\n')
      .filter(Boolean);
    await this.session.confirm(signal);
    return {
      current,
      branches: rows.map((row) => {
        const [name = '', upstream = '', lastCommitAt = '', worktree = ''] =
          row.split('\0');
        return {
          name,
          upstream: upstream || null,
          lastCommitAt,
          checkedOutElsewhere: Boolean(worktree && name !== current),
        };
      }),
    };
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
      default:
        throw new Error('Direct-only Git action');
    }
  }
  async executeDirect(
    requestId: string,
    intent: GitActionIntent,
    expected: GitActionExpectation,
    signal: AbortSignal,
    onProgress?: (line: string) => void,
    verifyTarget?: () => Promise<void>,
  ) {
    await this.session.verify(signal);
    const snapshot = await inspectActionTarget(
      this.process,
      intent,
      expected,
      signal,
    );
    const commit = intent.action === 'commit' || intent.action === 'amend';
    if (!commit) await verifyTarget?.();
    await this.session.confirm(signal);
    const command = { id: requestId, intent, preview: snapshot.preview };
    if (
      onProgress &&
      (intent.action === 'fetch' ||
        intent.action === 'pull' ||
        intent.action === 'push')
    )
      this.process.setProgressListener(onProgress);
    try {
      switch (intent.action) {
        case 'commit':
        case 'amend':
          return commitIndex(this.process, command, signal, verifyTarget);
        case 'fetch':
          return fetchBranch(this.process, command, snapshot, signal);
        case 'pull':
          return pullBranch(this.process, command, snapshot, signal);
        case 'push':
          return pushBranch(this.process, command, snapshot, signal);
        case 'stash-create':
          return createStash(this.process, command, signal);
        case 'stash-apply':
        case 'stash-pop':
          return applyStash(this.process, command, snapshot, signal);
        case 'discard':
          return discardPath(this.process, command, signal);
        case 'switch-branch':
        case 'create-branch':
          return manageBranch(this.process, command, signal);
      }
    } finally {
      this.process.setProgressListener();
    }
  }
}
