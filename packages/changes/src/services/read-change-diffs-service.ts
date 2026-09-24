import { IncompleteDiffReadError } from '../errors/incomplete-diff-read-error.ts';
import type {
  ReadChangeDiffsInput,
  ReadChangeDiffsResult,
} from '../models/read-change-diffs.ts';
import type { ChangeDiffReader } from '../ports/change-diff-reader.ts';

export class ReadChangeDiffsService {
  private readonly changeDiffReader: ChangeDiffReader;

  constructor(changeDiffReader: ChangeDiffReader) {
    this.changeDiffReader = changeDiffReader;
  }

  async execute(
    input: ReadChangeDiffsInput,
    signal?: AbortSignal,
  ): Promise<ReadChangeDiffsResult> {
    const contents = await this.changeDiffReader.readDiffs(input, signal);
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
