import { Effect } from 'effect';
import type { WorktreeRead } from '@porcelain/effects/worktree';
import type { ChangeDiffContent } from '../models/change-diff.ts';
import type {
  ReadCommitDiffsInput,
  ReadCommitDiffsResult,
} from '../models/read-commit-diffs.ts';
import type { CommitHistoryReader } from '../ports/commit-history-reader.ts';

const UNTOUCHED: ChangeDiffContent = { kind: 'metadata-only', patch: '' };
const OVER_LIMIT: ChangeDiffContent = { kind: 'omitted', reason: 'size-limit' };

export class ReadCommitDiffsService<E = never> {
  private readonly commitHistoryReader: CommitHistoryReader<E>;

  constructor(commitHistoryReader: CommitHistoryReader<E>) {
    this.commitHistoryReader = commitHistoryReader;
  }

  execute(
    input: ReadCommitDiffsInput,
  ): Effect.Effect<ReadCommitDiffsResult, E, WorktreeRead> {
    return Effect.gen({ self: this }, function* () {
      const read = yield* this.commitHistoryReader.readCommitPatches({
        worktreeId: input.worktreeId,
        oid: input.oid,
        parent: input.parent,
        paths: input.paths,
      });
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
    });
  }
}
