import type { GitActionOutcome } from '../models/git-action-outcome.ts';
import type {
  RunGitActionInput,
  RunGitActionResult,
} from '../models/git-action-operations.ts';
import type { GitActionRun } from '../models/git-action-run.ts';
import type { GitActionWriter } from '../ports/git-action-writer.ts';
import type { WorktreeFingerprintReader } from '../ports/worktree-fingerprint-reader.ts';
import { expectsWholeChangeList } from '../rules/expects-whole-change-list.ts';
import { targetMatchesExpectation } from '../rules/target-matches-expectation.ts';

export class RunGitActionService {
  private readonly worktreeFingerprintReader: WorktreeFingerprintReader;
  private readonly gitActionWriter: GitActionWriter;

  constructor(
    worktreeFingerprintReader: WorktreeFingerprintReader,
    gitActionWriter: GitActionWriter,
  ) {
    this.worktreeFingerprintReader = worktreeFingerprintReader;
    this.gitActionWriter = gitActionWriter;
  }

  async execute(
    input: RunGitActionInput,
    signal?: AbortSignal,
  ): Promise<RunGitActionResult> {
    const { run } = input;
    const outcome = await this.outcome(input, signal).catch(
      (): GitActionOutcome => ({
        state: signal?.aborted ? 'interrupted' : 'rejected',
        reason: signal?.aborted ? 'DEADLINE_EXCEEDED' : 'GIT_REJECTED',
        refreshRequired: false,
      }),
    );
    return {
      outcome,
      reviewStale:
        (run.intent.action === 'commit' || run.intent.action === 'amend') &&
        outcome.state === 'succeeded',
    };
  }

  private async outcome(
    input: RunGitActionInput,
    signal: AbortSignal | undefined,
  ): Promise<GitActionOutcome> {
    signal?.throwIfAborted();
    if (!(await this.targetMatches(input.run, signal)))
      return {
        state: 'rejected',
        reason: 'CHANGED_SINCE_LOOKED',
        refreshRequired: false,
      };
    return this.gitActionWriter.run(input.run, input.onProgress, signal);
  }

  private async targetMatches(
    run: GitActionRun,
    signal: AbortSignal | undefined,
  ): Promise<boolean> {
    const files = run.expected.files;
    if (!files) return true;
    const whole = expectsWholeChangeList(run.intent, run.expected);
    const actual = whole
      ? await this.worktreeFingerprintReader.all(run.worktreeId, signal)
      : await this.worktreeFingerprintReader.selected(
          run.worktreeId,
          files.map((file) => file.path),
          signal,
        );
    return targetMatchesExpectation(files, actual, whole);
  }
}
