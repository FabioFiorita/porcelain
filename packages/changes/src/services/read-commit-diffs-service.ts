import type { ChangeDiffContent } from '../models/change-diff.ts';
import type { CommitDiffs } from '../models/commit-history.ts';
import type { ReadCommitDiffsInput } from '../models/operation-inputs.ts';
import type { CommitHistoryReader } from '../ports/commit-history-reader.ts';

const UNTOUCHED: ChangeDiffContent = { kind: 'metadata-only', patch: '' };
const OVER_LIMIT: ChangeDiffContent = { kind: 'omitted', reason: 'size-limit' };

export class ReadCommitDiffsService {
  private readonly commitHistoryReader: CommitHistoryReader;

  constructor(commitHistoryReader: CommitHistoryReader) {
    this.commitHistoryReader = commitHistoryReader;
  }

  async execute(
    input: ReadCommitDiffsInput,
    signal?: AbortSignal,
  ): Promise<CommitDiffs> {
    const read = await this.commitHistoryReader.readCommitPatches(
      input.worktreeId,
      { oid: input.oid, parent: input.parent, paths: input.paths.flat() },
      signal,
    );
    const patches = new Map(
      read.kind === 'within-limit'
        ? read.patches.map((patch) => [patch.paths.join('\0'), patch.content])
        : [],
    );
    return {
      commitOid: input.oid,
      diffs: input.paths.map((paths) => ({
        paths: [...paths],
        content:
          read.kind === 'over-limit'
            ? OVER_LIMIT
            : (patches.get(paths.join('\0')) ?? UNTOUCHED),
      })),
    };
  }
}
