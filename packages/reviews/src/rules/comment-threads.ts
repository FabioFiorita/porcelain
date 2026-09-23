import type {
  CommentAnchor,
  CommentAuthor,
  CommentContent,
  CommentThread,
  CommentUsage,
  CommentWriter,
  PostedCommentMessage,
} from '../models/comment-thread.ts';

export const THREADS_PER_WORKTREE = 100;
export const MESSAGES_PER_THREAD = 100;
export const COMMENT_BYTES_PER_WORKTREE = 1024 * 1024;

export function commentAuthor(writer: CommentWriter): CommentAuthor {
  return writer.kind === 'agent' ? 'agent' : 'reviewer';
}

export function lastAgentRevision(
  author: CommentAuthor,
  revision: number,
): number | undefined {
  return author === 'agent' ? revision : undefined;
}

export function commentStorageSize(content: CommentContent): number {
  return new TextEncoder().encode(
    JSON.stringify({
      id: content.id,
      worktreeId: content.worktreeId,
      anchor: content.anchor,
      resolved: false,
      messages: content.messages,
    }),
  ).byteLength;
}

export function threadFits(usage: CommentUsage, sizeBytes: number): boolean {
  return (
    usage.threads < THREADS_PER_WORKTREE &&
    usage.bytes + sizeBytes <= COMMENT_BYTES_PER_WORKTREE
  );
}

export function replyFits(
  thread: CommentThread,
  usage: CommentUsage,
  sizeBytes: number,
): boolean {
  return (
    thread.messages.length < MESSAGES_PER_THREAD &&
    usage.bytes - commentStorageSize(thread) + sizeBytes <=
      COMMENT_BYTES_PER_WORKTREE
  );
}

function sameComparison(
  left: CommentAnchor['comparison'],
  right: CommentAnchor['comparison'],
): boolean {
  if (left === undefined || right === undefined) return left === right;
  if (left.kind === 'worktree')
    return right.kind === 'worktree' && left.scope === right.scope;
  if (left.kind === 'commit')
    return right.kind === 'commit' && left.parent === right.parent;
  return right.kind === 'file';
}

export function sameAnchor(left: CommentAnchor, right: CommentAnchor): boolean {
  const shared =
    left.filePath === right.filePath &&
    left.revision === right.revision &&
    left.contentFingerprint === right.contentFingerprint &&
    sameComparison(left.comparison, right.comparison);
  if (left.kind === 'file') return shared && right.kind === 'file';
  return (
    shared &&
    right.kind === 'codeRange' &&
    left.startLine === right.startLine &&
    left.endLine === right.endLine &&
    left.side === right.side
  );
}

export function repeatsCreation(
  thread: CommentThread,
  attempt: {
    worktreeId: string;
    anchor: CommentAnchor;
    messageId: string;
    body: string;
    author: CommentAuthor;
  },
): boolean {
  const first = thread.messages[0];
  return (
    thread.worktreeId === attempt.worktreeId &&
    sameAnchor(thread.anchor, attempt.anchor) &&
    first?.id === attempt.messageId &&
    first.body === attempt.body &&
    first.author === attempt.author
  );
}

export function repeatsReply(
  message: PostedCommentMessage,
  attempt: {
    worktreeId: string;
    threadId: string;
    body: string;
    author: CommentAuthor;
  },
): boolean {
  return (
    message.worktreeId === attempt.worktreeId &&
    message.threadId === attempt.threadId &&
    message.body === attempt.body &&
    message.author === attempt.author
  );
}

export function seenThrough(
  current: number,
  requested: number,
  latest: number,
): number {
  return Math.max(current, Math.min(requested, latest));
}
