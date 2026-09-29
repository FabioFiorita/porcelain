import { CommitNotFoundError } from '../errors/commit-not-found-error.ts';
import { IncompleteDiffReadError } from '../errors/incomplete-diff-read-error.ts';
import type { ChangeDiffContent } from '../models/change-diff.ts';
import type {
  ReadBranchDiffsInput,
  ReadBranchDiffsResult,
} from '../models/read-branch-diffs.ts';
import type { BranchRangeReader } from '../ports/branch-range-reader.ts';

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
        paths: input.paths,
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
      diffs: input.paths.map((paths) => {
        if (read.kind === 'over-limit')
          return { paths: [...paths], content: OVER_LIMIT };
        const content = patches.get(paths.join('\0'));
        if (content === undefined) throw new IncompleteDiffReadError();
        return { paths: [...paths], content };
      }),
    };
  }
}
