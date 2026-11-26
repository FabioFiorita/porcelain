import type { DraftComment } from '@porcelain/client/comments/rules';
import type { RenderLine } from '../../../shared/rules/render-model';

const SNAPSHOT_CHARACTERS = 64_000;
const NOTE_CHARACTERS = 100;
const NOTE = 'comment:';

type Side = 'additions' | 'deletions';
type ReviewRange = {
  readonly startLine: number;
  readonly endLine: number;
  readonly side?: Side | undefined;
};

export type LineAnchor = {
  readonly kind: 'lines';
  readonly path: string;
  readonly side: Side;
  readonly start: number;
  readonly end: number;
  readonly text: string;
};

export function codeLines(source: string): RenderLine[] {
  return source
    .replaceAll('\r\n', '\n')
    .split('\n')
    .map((text, index) => ({
      id: String(index + 1),
      text,
      newLine: index + 1,
    }));
}

function lineOn(line: RenderLine, side: Side) {
  if (line.kind === 'gap') return undefined;
  if (side === 'deletions')
    return line.kind === 'added' ? undefined : line.oldLine;
  return line.kind === 'removed' ? undefined : line.newLine;
}

export function lineCommentAnchor(
  path: string,
  lines: readonly RenderLine[],
  range: ReviewRange,
): { anchor: LineAnchor } | { refused: string } {
  const side = range.side ?? 'additions';
  const start = Math.min(range.startLine, range.endLine);
  const end = Math.max(range.startLine, range.endLine);
  const text = lines
    .filter((line) => {
      const number = lineOn(line, side);
      return number !== undefined && number >= start && number <= end;
    })
    .map((line) => line.text)
    .join('\n');
  if (text.length > SNAPSHOT_CHARACTERS)
    return { refused: 'Select fewer lines to comment on them.' };
  return { anchor: { kind: 'lines', path, side, start, end, text } };
}

export function selectionLabel(range: ReviewRange) {
  const start = Math.min(range.startLine, range.endLine);
  const end = Math.max(range.startLine, range.endLine);
  const lines = start === end ? `line ${start}` : `lines ${start}–${end}`;
  return range.side === 'deletions'
    ? `Removed ${lines}`
    : `${lines.charAt(0).toUpperCase()}${lines.slice(1)}`;
}

function noteText(comment: DraftComment) {
  const where =
    comment.anchor.kind === 'lines'
      ? selectionLabel({
          startLine: comment.anchor.start,
          endLine: comment.anchor.end,
          side: comment.anchor.side,
        })
      : 'File';
  const body = comment.text.replace(/\s+/g, ' ').trim();
  const shown =
    body.length > NOTE_CHARACTERS
      ? `${body.slice(0, NOTE_CHARACTERS - 1)}…`
      : body;
  return `${where} · Draft: ${shown}`;
}

export function withDraftNotes(
  lines: readonly RenderLine[],
  drafts: readonly DraftComment[],
): readonly RenderLine[] {
  if (drafts.length === 0) return lines;
  const top: RenderLine[] = [];
  const after = new Map<number, RenderLine[]>();
  for (const draft of drafts) {
    const note: RenderLine = {
      id: `${NOTE}${draft.id}`,
      kind: 'gap',
      text: noteText(draft),
    };
    const anchor = draft.anchor;
    const index =
      anchor.kind === 'lines'
        ? lines.findLastIndex(
            (line) => lineOn(line, anchor.side) === anchor.end,
          )
        : -1;
    if (index < 0) top.push(note);
    else after.set(index, [...(after.get(index) ?? []), note]);
  }
  return [
    ...top,
    ...lines.flatMap((line, index) => [line, ...(after.get(index) ?? [])]),
  ];
}

export function noteComment(id: string) {
  return id.startsWith(NOTE) ? id.slice(NOTE.length) : undefined;
}
