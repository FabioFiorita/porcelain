import {
  anchorPlacement,
  type CodeAnchor,
  type CommentThread,
  type Side,
} from '../../domain/comments';

/** What renders under a line of code: a thread, or the composer opening a new one. */
export type Note =
  | { kind: 'thread'; thread: CommentThread }
  | { kind: 'composer'; anchor: CodeAnchor };

/** Where a composer opens: under the last line of its range, or above the file. */
export function composerPlacement(anchor: CodeAnchor): {
  lineNumber: number;
  side: Side;
} {
  if (anchor.kind === 'file') return { lineNumber: 0, side: 'additions' };
  return { lineNumber: anchor.endLine, side: anchor.side ?? 'additions' };
}

/** Where a note renders, or null for a thread with no place in code (general, outdated). */
export function notePlacement(
  note: Note,
): { lineNumber: number; side: Side } | null {
  return note.kind === 'thread'
    ? anchorPlacement(note.thread)
    : composerPlacement(note.anchor);
}
