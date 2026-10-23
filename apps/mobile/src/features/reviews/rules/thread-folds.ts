import type { DiffLine } from '@porcelain/client/changes/rules';
import {
  threadStateLabel,
  type CommentThread,
} from '@porcelain/client/reviews/rules';

const prefix = 'thread:';

export function threadSummary(thread: CommentThread): string {
  const count = thread.messages.length;
  return `${count} ${count === 1 ? 'comment' : 'comments'} · ${threadStateLabel(thread)}`;
}

export function foldThreads(
  lines: readonly DiffLine[],
  threads: readonly CommentThread[],
): { lines: DiffLine[]; unplaced: CommentThread[] } {
  const below = new Map<string, CommentThread[]>();
  const unplaced: CommentThread[] = [];
  for (const thread of threads) {
    const anchor = thread.anchor;
    const line =
      anchor.kind === 'codeRange'
        ? lines.findLast((entry) =>
            anchor.side === 'deletions'
              ? entry.kind === 'removed' && entry.oldLine === anchor.endLine
              : entry.kind !== 'removed' &&
                entry.kind !== 'gap' &&
                entry.newLine === anchor.endLine,
          )
        : undefined;
    if (line) below.set(line.id, [...(below.get(line.id) ?? []), thread]);
    else unplaced.push(thread);
  }
  return {
    lines: lines.flatMap((line) => [
      line,
      ...(below.get(line.id) ?? []).map((thread) => ({
        id: `${prefix}${thread.id}`,
        kind: 'gap' as const,
        text: threadSummary(thread),
      })),
    ]),
    unplaced,
  };
}

export function foldedThread(lineId: string): string | undefined {
  return lineId.startsWith(prefix) ? lineId.slice(prefix.length) : undefined;
}
