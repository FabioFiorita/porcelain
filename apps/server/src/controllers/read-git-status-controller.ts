import type { GitStatusResponse } from '@porcelain/contracts/changes';
import type { ReadWorktreeStatusService } from '@porcelain/changes/services';

type RunStatusRead = <T>(
  worktreeId: string,
  operation: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
) => Promise<T>;

type OpenStatus = (
  worktreeId: string,
  signal?: AbortSignal,
) => Promise<{ environmentId: string; service: ReadWorktreeStatusService }>;

export class ReadGitStatusController {
  private readonly openStatus: OpenStatus;
  private readonly runRead: RunStatusRead;

  constructor(openStatus: OpenStatus, runRead: RunStatusRead) {
    this.openStatus = openStatus;
    this.runRead = runRead;
  }

  execute(
    input: { worktreeId: string },
    context: { signal?: AbortSignal },
  ): Promise<GitStatusResponse> {
    const { worktreeId } = input;
    return this.runRead(
      worktreeId,
      async (signal) => {
        signal.throwIfAborted();
        const { environmentId, service } = await this.openStatus(
          worktreeId,
          signal,
        );
        const result = await service.execute(environmentId, worktreeId, signal);
        return {
          environmentId: result.environmentId,
          worktreeId: result.worktreeId,
          statusToken: result.status.statusToken,
          headOid: result.status.headOid,
          inProgress: result.status.inProgress ?? null,
          mergeHeadOid: result.status.mergeHeadOid ?? null,
          headCommit: result.status.headCommit ?? null,
          ...(result.status.branch ? { branch: result.status.branch } : {}),
          consistency: 'best-effort',
          changes: result.status.changes.map((change) => {
            if (change.scope === 'untracked')
              return { scope: change.scope, path: change.path };
            if (change.scope === 'unmerged')
              return {
                scope: change.scope,
                path: change.path,
                conflict: change.conflict,
              };
            return {
              scope: change.scope,
              kind: change.kind,
              oldPath: change.oldPath,
              newPath: change.newPath,
              oldMode: change.oldMode,
              newMode: change.newMode,
              oldOid: change.oldOid,
              newOid: change.newOid,
              supported: change.supported,
            };
          }),
        };
      },
      context.signal,
    );
  }
}
