import type { FileDiffMetadata, SelectedLineRange } from '@pierre/diffs';

type CommentSide = 'additions' | 'deletions';
export type LineRange = { side: CommentSide; start: number; end: number };

const clean = (line: string | undefined) => line?.replace(/\r?\n$/, '');

function diffLine(
  diff: FileDiffMetadata,
  side: CommentSide,
  line: number,
): string | undefined {
  const lines = side === 'additions' ? diff.additionLines : diff.deletionLines;
  if (!diff.isPartial) return clean(lines[line - 1]);
  for (const hunk of diff.hunks) {
    const start =
      side === 'additions' ? hunk.additionStart : hunk.deletionStart;
    const count =
      side === 'additions' ? hunk.additionCount : hunk.deletionCount;
    const index =
      side === 'additions' ? hunk.additionLineIndex : hunk.deletionLineIndex;
    if (line >= start && line < start + count)
      return clean(lines[index + line - start]);
  }
  return undefined;
}

export function diffLineText(diff: FileDiffMetadata, range: LineRange): string {
  const lines: string[] = [];
  for (let line = range.start; line <= range.end; line += 1)
    lines.push(diffLine(diff, range.side, line) ?? '');
  return lines.join('\n');
}

export function fileLineText(contents: string, range: LineRange): string {
  return contents
    .split(/\r?\n/)
    .slice(range.start - 1, range.end)
    .join('\n');
}

export function commentRange(range: SelectedLineRange): LineRange | undefined {
  const side = range.side ?? 'additions';
  if ((range.endSide ?? side) !== side) return undefined;
  return {
    side,
    start: Math.min(range.start, range.end),
    end: Math.max(range.start, range.end),
  };
}
