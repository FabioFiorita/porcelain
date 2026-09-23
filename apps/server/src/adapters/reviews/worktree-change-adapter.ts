import type { ReadChangesResult as InspectedChanges } from '@porcelain/changes/models';
import { RequestGitSession } from '@porcelain/git/actions';
import type { GitSession } from '@porcelain/git/inspection';
import type {
  ChangeComparison,
  ReadChangesResult,
} from '@porcelain/reviews/models';
import type { WorktreeChangeReader } from '@porcelain/reviews/ports';

type ChangeReading = {
  execute(
    worktreeId: string,
    gitSession: GitSession,
    signal?: AbortSignal,
  ): Promise<InspectedChanges>;
};

type InspectedComparison =
  InspectedChanges['changes'][number]['comparisons'][number];

function comparison(entry: InspectedComparison): ChangeComparison {
  if (entry.scope === 'untracked' || entry.scope === 'unmerged')
    return { scope: entry.scope };
  return {
    scope: entry.scope,
    ...(entry.oldPath === null ? {} : { oldPath: entry.oldPath }),
    ...(entry.newPath === null ? {} : { newPath: entry.newPath }),
  };
}

export class WorktreeChangeAdapter implements WorktreeChangeReader {
  private readonly changes: ChangeReading;

  constructor(changes: ChangeReading) {
    this.changes = changes;
  }

  async read(
    worktreeId: string,
    signal?: AbortSignal,
  ): Promise<ReadChangesResult> {
    const session = new RequestGitSession();
    const inspected = await this.changes.execute(worktreeId, session, signal);
    await session.confirmAll(signal);
    return {
      worktreeId: inspected.worktreeId,
      statusToken: inspected.statusToken,
      changes: inspected.changes.map((change) => ({
        path: change.path,
        ...(change.fingerprint === null
          ? {}
          : { fingerprint: change.fingerprint }),
        comparisons: change.comparisons.map(comparison),
      })),
    };
  }
}
