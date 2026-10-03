import { InvalidLineRangeError } from '@porcelain/kernel/errors';
import type { ChangeLines, LineRangeProblem } from '../models/change-lines.ts';
import type {
  ReadChangeLinesInput,
  ReadChangeLinesOptions,
} from '../models/read-change-lines.ts';
import {
  lineRangeProblem,
  sliceChangeLines,
} from '../rules/slice-change-lines.ts';

export class ReadChangeLinesService {
  private readonly options: ReadChangeLinesOptions;

  constructor(options: ReadChangeLinesOptions) {
    this.options = options;
  }

  execute(input: ReadChangeLinesInput): ChangeLines {
    const problem = lineRangeProblem(input);
    if (problem) throw this.failure(problem);
    return sliceChangeLines(input, this.options.maxLines);
  }

  private failure(problem: LineRangeProblem): Error {
    switch (problem.kind) {
      case 'reversed-range':
        return new InvalidLineRangeError();
    }
  }
}
