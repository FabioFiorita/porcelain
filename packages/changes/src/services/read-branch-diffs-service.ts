import { CommitNotFoundError } from '../errors/commit-not-found-error.ts';
import type { ChangeDiffContent } from '../models/change-diff.ts';
import type {
  ReadBranchDiffsInput,
  ReadBranchDiffsResult,
} from '../models/read-branch-diffs.ts';
import type { BranchRangeReader } from '../ports/branch-range-reader.ts';

const UNTOUCHED: ChangeDiffContent = { kind: 'metadata-only', patch: '' };
const OVER_LIMIT: ChangeDiffContent = { kind: 'omitted', reason: 'size-limit' };

export class ReadBranchDiffsService {
  private readonly branchRangeReader: BranchRangeReader;

  constructor(branchRangeReader: BranchRangeReader) {
    this.branchRangeReader = branchRangeReader;
  }

  async execute(
    input: ReadBranchDiffsInput,
    signal?: AbortSignal,
  ): Promise<ReadBranchDiffsResult> {
    const read = await this.branchRangeReader.readBranchPatches(
      {
        worktreeId: input.worktreeId,
        baseOid: input.baseOid,
        headOid: input.headOid,
        paths: input.paths.flat(),
      },
      signal,
    );
    if (read.kind === 'missing') throw new CommitNotFoundError();
    const patches = new Map(
      read.kind === 'within-limit'
        ? read.patches.map((patch) => [patch.paths.join('\0'), patch.content])
        : [],
    );
    return {
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
