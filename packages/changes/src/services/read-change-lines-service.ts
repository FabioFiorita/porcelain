import type { ChangeLineRange, ChangeLines } from '../models/change-lines.ts';
import type { ChangeLinesReader } from '../ports/change-lines-reader.ts';

const MAX_LINES = 2000;

export class ReadChangeLinesService {
  private readonly reader: ChangeLinesReader;

  constructor(reader: ChangeLinesReader) {
    this.reader = reader;
  }

  async execute(
    environmentId: string,
    worktreeId: string,
    range: ChangeLineRange,
    signal?: AbortSignal,
  ): Promise<ChangeLines> {
    signal?.throwIfAborted();
    const from = Math.max(1, Math.trunc(range.from));
    const to = Math.min(Math.trunc(range.to), from + MAX_LINES - 1);
    const all =
      range.at === 'head'
        ? await this.reader.readHeadLines(range.path, from, to, signal)
        : (await this.reader.readWorktreeText(range.path, signal)).split('\n');
    signal?.throwIfAborted();
    await this.reader.confirmReachable(worktreeId, signal);
    if (all.length > 1 && all.at(-1) === '') all.pop();
    const last = Math.min(all.length, to);
    return {
      environmentId,
      worktreeId,
      at: range.at,
      path: range.path,
      from,
      to: Math.max(from - 1, last),
      lines: last < from ? [] : all.slice(from - 1, last),
    };
  }
}
