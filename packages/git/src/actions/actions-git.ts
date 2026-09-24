import { type CheckoutSession, readSelectedDiff } from '../inspection/index.ts';
import type { GitLimits } from '../shared/dtos/git-limits.ts';
import { type GitProcessResult, runGitWrite } from '../shared/run-git.ts';
import { applyStash } from './commands/apply-stash.ts';
import { commitIndex } from './commands/commit-index.ts';
import { createStash } from './commands/create-stash.ts';
import { discardPath } from './commands/discard-path.ts';
import { fetchBranch } from './commands/fetch-branch.ts';
import { inspectActionTarget } from './commands/inspect-action-target.ts';
import { listBranches } from './commands/list-branches.ts';
import { manageBranch } from './commands/manage-branch.ts';
import { pullBranch } from './commands/pull-branch.ts';
import { pushBranch } from './commands/push-branch.ts';
import type {
  GitActionExpectation,
  GitActionIntent,
  GitActionOutcome,
} from './dtos/git-action.ts';
import { GitActionRejectedError } from './errors/git-action-rejected-error.ts';
import type { GitActionWriter } from './interfaces/git-action-writer.ts';
import type { GitProcessRunner } from './interfaces/git-process-runner.ts';

const UNAVAILABLE: GitActionOutcome = {
  state: 'rejected',
  reason: 'GIT_REJECTED',
  refreshRequired: false,
};

export class ActionsGit implements GitActionWriter {
  private readonly session: CheckoutSession;
  private readonly limits: GitLimits;
  private readonly process: GitProcessRunner;
  private progress: ((line: string) => void) | undefined;
  private unconfirmed = false;

  constructor(session: CheckoutSession, limits: GitLimits) {
    this.session = session;
    this.limits = limits;
    this.process = {
      limits,
      execute: (args, signal, input, options) =>
        this.run(args, signal, input, options?.indexFile),
    };
  }

  readSelectedDiff(
    headOid: string | null,
    paths: readonly string[],
    signal: AbortSignal,
  ) {
    return readSelectedDiff(this.session, headOid, paths, this.limits, signal);
  }

  async listBranches(signal: AbortSignal) {
    await this.session.verify(signal);
    const branches = await listBranches(this.process, signal);
    await this.session.confirm(signal);
    return branches;
  }

  async executeDirect(
    requestId: string,
    intent: GitActionIntent,
    expected: GitActionExpectation,
    signal: AbortSignal,
    onProgress?: (line: string) => void,
    verifyTarget?: () => Promise<void>,
  ): Promise<GitActionOutcome> {
    await this.session.verify(signal);
    const { preview, remote, stashLog } = await inspectActionTarget(
      this.process,
      intent,
      expected,
      signal,
    );
    if (intent.action !== 'commit' && intent.action !== 'amend')
      await verifyTarget?.();
    await this.session.confirm(signal);
    const id = requestId;
    this.progress =
      intent.action === 'fetch' ||
      intent.action === 'pull' ||
      intent.action === 'push'
        ? onProgress
        : undefined;
    try {
      switch (intent.action) {
        case 'commit':
        case 'amend':
          return await commitIndex(
            this.process,
            { id, intent, preview },
            signal,
            verifyTarget,
          );
        case 'fetch':
          return remote
            ? await fetchBranch(
                this.process,
                { id, intent, preview },
                remote,
                signal,
              )
            : UNAVAILABLE;
        case 'pull':
          return remote
            ? await pullBranch(
                this.process,
                { id, intent, preview },
                remote,
                signal,
              )
            : UNAVAILABLE;
        case 'push':
          return remote && preview.headOid
            ? await pushBranch(
                this.process,
                { id, intent, preview },
                remote,
                preview.headOid,
                signal,
              )
            : UNAVAILABLE;
        case 'stash-create':
          return await createStash(
            this.process,
            { id, intent, preview },
            signal,
          );
        case 'stash-apply':
        case 'stash-pop':
          return await applyStash(
            this.process,
            { id, intent, preview },
            stashLog,
            signal,
          );
        case 'discard':
          return await discardPath(
            this.process,
            { id, intent, preview },
            signal,
          );
        case 'switch-branch':
        case 'create-branch':
          return await manageBranch(
            this.process,
            { id, intent, preview },
            signal,
          );
      }
    } finally {
      this.progress = undefined;
    }
  }

  private async run(
    args: readonly string[],
    signal: AbortSignal,
    input?: string,
    indexFile?: string,
  ): Promise<GitProcessResult> {
    if (this.unconfirmed)
      throw new GitActionRejectedError('PROCESS_GROUP_UNCONFIRMED');
    const result = await runGitWrite(
      this.session.path,
      args,
      this.limits,
      signal,
      {
        ...(input === undefined ? {} : { input }),
        ...(indexFile === undefined ? {} : { indexFile }),
        ...(this.progress ? { onProgress: this.progress } : {}),
      },
    );
    if (!result.descendantsStopped) {
      this.unconfirmed = true;
      throw new GitActionRejectedError('PROCESS_GROUP_UNCONFIRMED');
    }
    return result;
  }
}
