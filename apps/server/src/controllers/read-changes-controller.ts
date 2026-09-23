import type { ChangesResponse } from '@porcelain/contracts/changes';
import type { ReadWorktreeChangesService } from '@porcelain/changes/services';

type RunWorktreeRead = <T>(
  worktreeId: string,
  operation: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
) => Promise<T>;

type InterruptedAction = Pick<
  NonNullable<ChangesResponse['interrupted']>,
  'requestId' | 'action'
>;

export class ReadChangesController {
  private readonly createRead: (
    worktreeId: string,
  ) => ReadWorktreeChangesService;
  private readonly runRead: RunWorktreeRead;
  private readonly reconcile: (
    worktreeId: string,
    fingerprints: ReadonlyMap<string, string | null>,
  ) => void;
  private readonly interrupted: (
    worktreeId: string,
  ) => InterruptedAction | undefined;

  constructor(
    createRead: (worktreeId: string) => ReadWorktreeChangesService,
    runRead: RunWorktreeRead,
    reconcile: (
      worktreeId: string,
      fingerprints: ReadonlyMap<string, string | null>,
    ) => void,
    interrupted: (worktreeId: string) => InterruptedAction | undefined,
  ) {
    this.createRead = createRead;
    this.runRead = runRead;
    this.reconcile = reconcile;
    this.interrupted = interrupted;
  }

  execute(
    input: { worktreeId: string },
    context: { signal?: AbortSignal },
  ): Promise<ChangesResponse> {
    const { worktreeId } = input;
    return this.runRead(
      worktreeId,
      async (signal) => {
        const answer = await this.createRead(worktreeId).execute(
          worktreeId,
          signal,
        );
        this.reconcile(
          worktreeId,
          new Map(
            answer.changes.map((entry) => [entry.path, entry.fingerprint]),
          ),
        );
        const interrupted = this.interrupted(worktreeId);
        if (!interrupted) return answer;
        const branch = answer.branch?.name ?? 'detached HEAD';
        const conflicts = answer.changes.filter((change) =>
          change.comparisons.some(
            (comparison) => comparison.scope === 'unmerged',
          ),
        ).length;
        const state = conflicts
          ? `${conflicts} unresolved ${conflicts === 1 ? 'path remains' : 'paths remain'} on ${branch}.`
          : answer.changes.length
            ? `${answer.changes.length} changed ${answer.changes.length === 1 ? 'path remains' : 'paths remain'} on ${branch}.`
            : `The worktree is clean on ${branch}.`;
        return {
          ...answer,
          interrupted: {
            requestId: interrupted.requestId,
            action: interrupted.action,
            gitState: state,
          },
        };
      },
      context.signal,
    );
  }
}
