import { utf8ByteLength } from '@porcelain/kernel/rules';
import type {
  CommentAnchor,
  CommentAnchorProblem,
  CommentAuthor,
  CommentContent,
  CommentLimits,
  CommentThread,
  CommentUsage,
  CommentWriter,
  PostedCommentMessage,
} from '../models/comment-thread.ts';

const COMMIT_REVISION = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;

export function commentAnchorProblem(
  anchor: CommentAnchor,
): CommentAnchorProblem | undefined {
  if (anchor.kind === 'codeRange' && anchor.endLine < anchor.startLine)
    return { kind: 'reversed-range' };
  if (anchor.comparison === undefined) return undefined;
  const fits =
    anchor.comparison.kind === 'commit'
      ? COMMIT_REVISION.test(anchor.revision ?? '')
      : anchor.revision === undefined;
  return fits ? undefined : { kind: 'revision-mismatch' };
}

export function commentAuthor(writer: CommentWriter): CommentAuthor {
  return writer.kind === 'agent' ? 'agent' : 'reviewer';
}

export function commentStorageSize(content: CommentContent): number {
  return utf8ByteLength(
    JSON.stringify({
      id: content.id,
      worktreeId: content.worktreeId,
      anchor: content.anchor,
      resolved: false,
      messages: content.messages,
    }),
  );
}

export function threadFits(
  usage: CommentUsage,
  sizeBytes: number,
  limits: CommentLimits,
): boolean {
  return (
    usage.threads < limits.threadsPerWorktree &&
    usage.bytes + sizeBytes <= limits.bytesPerWorktree
  );
}

export function replyFits(
  thread: CommentThread,
  usage: CommentUsage,
  sizeBytes: number,
  limits: CommentLimits,
): boolean {
  return (
    thread.messages.length < limits.messagesPerThread &&
    usage.bytes - commentStorageSize(thread) + sizeBytes <=
      limits.bytesPerWorktree
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

function sameAnchor(left: CommentAnchor, right: CommentAnchor): boolean {
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

export function waitsForAgent(thread: CommentThread): boolean {
  return !thread.resolved && thread.messages.at(-1)?.author !== 'agent';
}

export function seenThrough(
  current: number,
  requested: number,
  latest: number,
): number {
  return Math.max(current, Math.min(requested, latest));
}
