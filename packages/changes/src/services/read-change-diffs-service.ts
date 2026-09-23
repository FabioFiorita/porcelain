import { IncompleteDiffReadError } from '../errors/incomplete-diff-read-error.ts';
import type { ChangeDiff } from '../models/change-diff.ts';
import type { ReadChangeDiffsInput } from '../models/operation-inputs.ts';
import type { ChangeDiffReader } from '../ports/change-diff-reader.ts';

export class ReadChangeDiffsService {
  private readonly changeDiffReader: ChangeDiffReader;

  constructor(changeDiffReader: ChangeDiffReader) {
    this.changeDiffReader = changeDiffReader;
  }

  async execute(
    input: ReadChangeDiffsInput,
    signal?: AbortSignal,
  ): Promise<ChangeDiff[]> {
    const contents = await this.changeDiffReader.readDiffs(
      input.worktreeId,
      input.comparisons,
      signal,
    );
    signal?.throwIfAborted();
    return input.comparisons.map((comparison, index) => {
      const content = contents[index];
      if (content === undefined) throw new IncompleteDiffReadError();
      return {
        selection: {
          scope: comparison.scope,
          oldPath: comparison.oldPath,
          newPath: comparison.newPath,
        },
        content,
      };
    });
  }
}
