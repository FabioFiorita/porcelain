import { COMMENT_BODY_LENGTH } from '@porcelain/contracts/shared';
import type {
  CreateCommentThreadResponse,
  DeleteResolvedCommentsRequest,
} from '@porcelain/contracts/reviews';
export type CommentThread = CreateCommentThreadResponse;
export type CommentAnchor = CommentThread['anchor'];
export type CommentMessage = CommentThread['messages'][number];
export type CommentMessageAuthor = CommentMessage['author'];
export type ConfirmedThreads = DeleteResolvedCommentsRequest['threads'];

export type FileCommentAnchor = Exclude<CommentAnchor, { kind: 'change' }>;
export type CommentTarget = Pick<
  FileCommentAnchor,
  'filePath' | 'revision' | 'comparison' | 'contentFingerprint'
>;
export type RevealComment = {
  anchor: CommentAnchor;
  nonce: number;
  compose?: boolean;
};
type LineRange = {
  start: number;
  end: number;
  side?: 'additions' | 'deletions';
  endSide?: 'additions' | 'deletions';
};

export function rangeAnchor(
  target: CommentTarget,
  range: LineRange,
): FileCommentAnchor | null {
  if (range.endSide && range.side && range.endSide !== range.side) return null;
  return {
    ...target,
    kind: 'codeRange',
    startLine: Math.min(range.start, range.end),
    endLine: Math.max(range.start, range.end),
    ...(target.comparison?.kind === 'file' ||
    (target.comparison?.kind === 'worktree' &&
      target.comparison.scope === 'untracked')
      ? {}
      : { side: range.side ?? 'additions' }),
  };
}

export function matchesCommentTarget(
  anchor: CommentAnchor,
  target: CommentTarget,
) {
  if (anchor.kind === 'change' || anchor.filePath !== target.filePath)
    return false;
  if (anchor.comparison?.kind === 'branch')
    return target.comparison?.kind === 'branch';
  if (anchor.revision !== target.revision) return false;
  if (!anchor.comparison) {
    return (
      anchor.kind === 'file' ||
      (target.comparison?.kind === 'file' && anchor.side === undefined)
    );
  }
  const comparison = target.comparison;
  if (anchor.comparison.kind !== comparison?.kind) return false;
  if (anchor.comparison.kind === 'worktree' && comparison.kind === 'worktree')
    return anchor.comparison.scope === comparison.scope;
  if (anchor.comparison.kind === 'commit' && comparison.kind === 'commit')
    return anchor.comparison.parent === comparison.parent;
  return true;
}

export function commentIsStale(anchor: CommentAnchor, target: CommentTarget) {
  return (
    anchor.contentFingerprint !== null &&
    anchor.contentFingerprint !== undefined &&
    anchor.contentFingerprint !== target.contentFingerprint
  );
}

export function anchorBase(anchor: CommentAnchor): string | undefined {
  return anchor.comparison?.kind === 'branch'
    ? anchor.comparison.base
    : undefined;
}

export function anchorPath(anchor: CommentAnchor): string | undefined {
  return anchor.kind === 'change' ? undefined : anchor.filePath;
}

export function changeAnchor(
  branch: { base: string; tip: string } | undefined,
): CommentAnchor {
  return branch
    ? {
        kind: 'change',
        comparison: { kind: 'branch', base: branch.base },
        revision: branch.tip,
      }
    : { kind: 'change' };
}

export function anchorLabel(anchor: CommentAnchor): string {
  if (anchor.kind === 'change')
    return anchor.comparison?.kind === 'branch'
      ? 'Whole branch'
      : 'Whole change';
  if (anchor.kind === 'file') return 'Whole file';
  const sign = anchor.side === 'deletions' ? '−' : '+';
  return anchor.startLine === anchor.endLine
    ? `${sign}${anchor.startLine}`
    : `${sign}${anchor.startLine} to ${sign}${anchor.endLine}`;
}

export function threadWriteTarget(
  thread: Pick<CommentThread, 'id' | 'review'>,
) {
  return thread.review
    ? { threadId: thread.id, reviewId: thread.review.reviewId }
    : { threadId: thread.id };
}

export function threadStarter(thread: CommentThread): CommentMessageAuthor {
  return thread.messages[0]?.author ?? 'reviewer';
}

export function resolvedCleanup(threads: readonly CommentThread[]) {
  const resolved = threads.filter((thread) => thread.resolved);
  const confirmed = resolved
    .filter((thread) => threadStarter(thread) === 'reviewer')
    .map((thread) => ({ threadId: thread.id, revision: thread.revision }));
  return { confirmed, kept: resolved.length - confirmed.length };
}

export function threadState(
  thread: CommentThread,
): 'agent-replied' | 'awaiting-agent' | 'resolved' {
  if (thread.resolved) return 'resolved';
  return thread.messages.at(-1)?.author === 'agent'
    ? 'agent-replied'
    : 'awaiting-agent';
}

export function threadStateLabel(thread: CommentThread): string {
  switch (threadState(thread)) {
    case 'resolved':
      return 'Resolved';
    case 'awaiting-agent':
      return 'Waiting for the agent';
    case 'agent-replied':
      return threadStarter(thread) === 'agent' && thread.messages.length === 1
        ? 'From the agent'
        : 'Agent replied';
  }
}

export function questionAnswer(question: string, answer: string): string {
  return `${question
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n')}\n\n${answer}`;
}

export function commentBodyValid(body: string) {
  return (
    body.trim().length > 0 &&
    !body.includes('\0') &&
    body.length <= COMMENT_BODY_LENGTH
  );
}

export function retainIntent<T extends { body: string }>(
  previous: T | undefined,
  body: string,
  fresh: () => T,
): T {
  return previous?.body === body ? previous : fresh();
}

export function commentsSeenThrough(
  counts: { highest: number; open: number; resolved: number },
  viewed: ReadonlySet<string>,
): number | null {
  const needed = (
    [
      ['open', counts.open],
      ['resolved', counts.resolved],
    ] as const
  ).filter(([, count]) => count > 0);
  return counts.highest === 0 || !needed.every(([filter]) => viewed.has(filter))
    ? null
    : counts.highest;
}

export function mergeCommentThreads(
  current: readonly CommentThread[],
  updated: readonly CommentThread[],
  removed: readonly string[] = [],
): readonly CommentThread[] {
  const byId = new Map(current.map((thread) => [thread.id, thread]));
  for (const thread of updated) byId.set(thread.id, thread);
  for (const threadId of removed) byId.delete(threadId);
  return [...byId.values()];
}

export type CommentSegment =
  | { kind: 'text'; text: string }
  | { kind: 'decision'; text: string; decision: number };

export function decisionMentions(
  body: string,
  decisions: number,
): CommentSegment[] {
  const segments: CommentSegment[] = [];
  let rest = 0;
  for (const match of body.matchAll(/\b(?:stop|decision)\s+(\d+)\b/gi)) {
    const decision = Number(match[1]);
    if (decision < 1 || decision > decisions) continue;
    if (match.index > rest)
      segments.push({ kind: 'text', text: body.slice(rest, match.index) });
    segments.push({ kind: 'decision', text: match[0], decision });
    rest = match.index + match[0].length;
  }
  if (rest < body.length)
    segments.push({ kind: 'text', text: body.slice(rest) });
  return segments;
}

export function messageRevision(
  message: Pick<CommentMessage, 'createdAt'>,
  revisions: readonly { revision: number; publishedAt: string }[],
): number | undefined {
  if (!message.createdAt) return undefined;
  const written = Date.parse(message.createdAt);
  let found: { revision: number; at: number } | undefined;
  for (const entry of revisions) {
    const at = Date.parse(entry.publishedAt);
    if (at <= written && (!found || at >= found.at))
      found = { revision: entry.revision, at };
  }
  return found?.revision;
}
