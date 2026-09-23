import type { ChangeLines } from '../models/change-lines.ts';
import type { ReadChangeLinesInput } from '../models/operation-inputs.ts';
import type { ChangeLinesReader } from '../ports/change-lines-reader.ts';

const MAX_LINES = 2000;

export class ReadChangeLinesService {
  private readonly changeLinesReader: ChangeLinesReader;

  constructor(changeLinesReader: ChangeLinesReader) {
    this.changeLinesReader = changeLinesReader;
  }

  async execute(
    input: ReadChangeLinesInput,
    signal?: AbortSignal,
  ): Promise<ChangeLines> {
    const { worktreeId, path, from, at } = input;
    const to = Math.min(input.to, from + MAX_LINES - 1);
    const text =
      at === 'head'
        ? await this.changeLinesReader.readHeadText(worktreeId, path, signal)
        : await this.changeLinesReader.readWorktreeText(
            worktreeId,
            path,
            signal,
          );
    signal?.throwIfAborted();
    const lines = text.split('\n');
    const count =
      lines.length > 1 && lines.at(-1) === '' ? lines.length - 1 : lines.length;
    const last = Math.min(count, to);
    return {
      at,
      path,
      from,
      to: Math.max(from - 1, last),
      lines: last < from ? [] : lines.slice(from - 1, last),
    };
  }
}
