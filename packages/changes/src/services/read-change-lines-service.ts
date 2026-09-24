import { InvalidLineRangeError } from '@porcelain/kernel/errors';
import type {
  ReadChangeLinesInput,
  ReadChangeLinesOptions,
  ReadChangeLinesResult,
} from '../models/read-change-lines.ts';

export class ReadChangeLinesService {
  private readonly options: ReadChangeLinesOptions;

  constructor(options: ReadChangeLinesOptions) {
    this.options = options;
  }

  execute(input: ReadChangeLinesInput): ReadChangeLinesResult {
    const { path, from, at } = input;
    if (input.to < from) throw new InvalidLineRangeError();
    const to = Math.min(input.to, from + this.options.maxLines - 1);
    const lines = input.text.split('\n');
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
