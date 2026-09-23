import type {
  CommitDraftObservation,
  CommitDraftUntrackedContent,
  GitActionScope,
} from '../../src/models/index.ts';
import type {
  CommitDraftReader,
  CommitDraftSnapshotReader,
} from '../../src/ports/index.ts';

export class InMemoryCommitDraftReader implements CommitDraftReader {
  confirmed = 0;
  readonly diffRequests: string[][] = [];
  private readonly observation: CommitDraftObservation;
  private readonly diff: string | false;
  private readonly untracked: Record<string, CommitDraftUntrackedContent>;

  constructor(
    observation: CommitDraftObservation,
    diff: string | false = '',
    untracked: Record<string, CommitDraftUntrackedContent> = {},
  ) {
    this.observation = observation;
    this.diff = diff;
    this.untracked = untracked;
  }

  open(_scope: GitActionScope): CommitDraftSnapshotReader {
    return {
      changes: async () => structuredClone(this.observation),
      selectedDiff: async (_headOid, paths) => {
        this.diffRequests.push([...paths]);
        return this.diff === false ? undefined : this.diff;
      },
      untracked: async (path) =>
        this.untracked[path] ?? { kind: 'omitted', reason: 'PATH_NOT_FOUND' },
      confirm: async () => {
        this.confirmed += 1;
      },
    };
  }
}
