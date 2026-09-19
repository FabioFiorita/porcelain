import type {
  CommentAnchor,
  CommentThread,
  ThreadLocation,
} from '../contracts/comments';

export type { CommentAnchor, CommentThread, ThreadLocation };
export type Side = 'additions' | 'deletions';
export type LineRange = {
  start: number;
  end: number;
  side?: Side;
  endSide?: Side;
};
export type CodeAnchor = Exclude<CommentAnchor, { kind: 'worktree' }>;

/**
 * Why a selection cannot be commented: it mixes the old file's lines with the new
 * file's, so it has no single numbering. In a split diff that is a drag across the
 * two columns; in a unified one, a drag from removed lines into added or unchanged
 * ones (Pierre numbers unchanged lines as the new file's).
 */
export const mixedSelectionMessage = (diffStyle: 'split' | 'unified') =>
  diffStyle === 'split'
    ? 'Select lines on one side of the comparison.'
    : 'Select only removed lines, or only added and unchanged ones.';

/**
 * Pierre reports a drag in the order it happened. A stored range always reads
 * top-down. A range across both sides is refused (null): its numbers would mix
 * the old file and the new one.
 */
export function anchorForRange(
  filePath: string,
  range: LineRange,
): CodeAnchor | null {
  if (
    range.side != null &&
    range.endSide != null &&
    range.side !== range.endSide
  )
    return null;
  const side = range.side ?? range.endSide ?? 'additions';
  return {
    kind: 'codeRange',
    filePath,
    startLine: Math.min(range.start, range.end),
    endLine: Math.max(range.start, range.end),
    side,
  };
}

export function anchorForFile(filePath: string): CodeAnchor {
  return { kind: 'file', filePath };
}

export const GENERAL_ANCHOR: CommentAnchor = { kind: 'worktree' };

export const isCodeAnchor = (anchor: CommentAnchor): anchor is CodeAnchor =>
  anchor.kind !== 'worktree';

/** The file a thread is about now: it follows renames through `location`. */
export function threadPath(thread: CommentThread): string | null {
  if (thread.location != null && thread.location.state !== 'outdated')
    return thread.location.filePath;
  return isCodeAnchor(thread.anchor) ? thread.anchor.filePath : null;
}

/**
 * Comments about history carry the commit's oid in `revision`; comments about
 * the worktree have none. A document only shows the comments for its own code.
 */
export function onRevision(
  anchor: CommentAnchor,
  revision: string | undefined,
): boolean {
  if (anchor.kind === 'worktree') return false;
  return (anchor.revision ?? undefined) === revision;
}

/** Lines where the code is now (it may have moved), else as anchored. */
export function currentLines(
  thread: CommentThread,
): { startLine: number; endLine: number } | null {
  const location = thread.location;
  if (
    location != null &&
    location.state !== 'outdated' &&
    location.startLine != null &&
    location.endLine != null
  ) {
    return { startLine: location.startLine, endLine: location.endLine };
  }
  return thread.anchor.kind === 'codeRange'
    ? { startLine: thread.anchor.startLine, endLine: thread.anchor.endLine }
    : null;
}

export function anchorLabel(anchor: CommentAnchor): string {
  if (anchor.kind === 'worktree') return 'Whole worktree';
  if (anchor.kind === 'file') return 'Whole file';
  const sign = anchor.side === 'deletions' ? '−' : '+';
  return anchor.startLine === anchor.endLine
    ? `${sign}${anchor.startLine}`
    : `${sign}${anchor.startLine} to ${sign}${anchor.endLine}`;
}

/** The label for where a thread is now: its current lines, "Outdated" or "Committed". */
export function locationLabel(thread: CommentThread): string {
  if (thread.anchor.kind === 'worktree') return 'Whole worktree';
  if (thread.location?.state === 'outdated') return 'Outdated';
  const lines = currentLines(thread);
  const where =
    thread.anchor.kind === 'file' || lines == null
      ? 'Whole file'
      : anchorLabel({
          ...thread.anchor,
          startLine: lines.startLine,
          endLine: lines.endLine,
        });
  return thread.location?.state === 'committed'
    ? `${where} · Committed`
    : where;
}

/** Where an anchor renders inside a diff: under the last line, or above the file. */
export function anchorPlacement(
  thread: CommentThread,
): { lineNumber: number; side: Side } | null {
  if (
    thread.anchor.kind === 'worktree' ||
    thread.location?.state === 'outdated'
  )
    return null;
  if (thread.anchor.kind === 'file')
    return { lineNumber: 0, side: 'additions' };
  const lines = currentLines(thread);
  return {
    lineNumber: lines?.endLine ?? thread.anchor.endLine,
    side: thread.anchor.side ?? 'additions',
  };
}

export type CommentAuthor = CommentThread['messages'][number]['author'];

/** Either side opens a thread: the agent to point at code, the reviewer to ask about it. */
export function threadStarter(thread: CommentThread): CommentAuthor {
  return thread.messages[0]?.author ?? 'reviewer';
}

/**
 * Whose turn it is. Nothing reaches the agent on its own: `awaiting-agent`
 * holds until the reviewer tells the agent to read its comments.
 */
export type ThreadState = 'agent-replied' | 'awaiting-agent' | 'resolved';

export function threadState(thread: CommentThread): ThreadState {
  if (thread.resolved) return 'resolved';
  return thread.messages.at(-1)?.author === 'agent'
    ? 'agent-replied'
    : 'awaiting-agent';
}

/** Agent messages after the seen marker: what turns the worktree's dot yellow. */
export function unseenAgentMessages(thread: CommentThread): number {
  if (thread.resolved) return 0;
  const seen = thread.messages.findIndex(
    (message) => message.id === thread.seenUpTo,
  );
  return thread.messages
    .slice(seen + 1)
    .filter((message) => message.author === 'agent').length;
}

export function sortThreads<T extends CommentThread>(
  threads: readonly T[],
): T[] {
  const path = (thread: T) => threadPath(thread) ?? '';
  const line = (thread: T) => currentLines(thread)?.startLine ?? 0;
  return [...threads].sort(
    (left, right) =>
      Number(isCodeAnchor(left.anchor)) - Number(isCodeAnchor(right.anchor)) ||
      path(left).localeCompare(path(right)) ||
      line(left) - line(right),
  );
}
