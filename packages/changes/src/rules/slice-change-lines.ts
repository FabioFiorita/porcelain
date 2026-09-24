import type { ChangeLines, LineRangeProblem } from '../models/change-lines.ts';
import type { ReadChangeLinesInput } from '../models/read-change-lines.ts';

export function lineRangeProblem(
  range: Pick<ReadChangeLinesInput, 'from' | 'to'>,
): LineRangeProblem | undefined {
  return range.from <= range.to ? undefined : { kind: 'reversed-range' };
}

export function sliceChangeLines(
  input: ReadChangeLinesInput,
  maxLines: number,
): ChangeLines {
  const { path, from, at } = input;
  const to = Math.min(input.to, from + maxLines - 1);
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
