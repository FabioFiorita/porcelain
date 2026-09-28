import type {
  CreateCommentThreadRequest,
  CreateCommentThreadResponse,
  ReplyToCommentRequest,
  UpdateCommentThreadRequest,
} from '@porcelain/contracts/reviews';
export type CommentThread = CreateCommentThreadResponse;
export type CommentAnchor = CommentThread['anchor'];
export type CommentMessage = CommentThread['messages'][number];
export type CommentAuthor = CommentMessage['author'];
export type NewComment = CreateCommentThreadRequest;
type NewReply = ReplyToCommentRequest;
type CommentResolution = UpdateCommentThreadRequest;

export type ReplyCommentInput = { threadId: string } & NewReply;
export type ResolveCommentInput = { threadId: string } & CommentResolution;

type CommentRequest = {
  projectId: string;
  worktreeId: string;
  signal: AbortSignal;
};
export type CommentsPort = {
  list: (request: CommentRequest) => Promise<CommentThread[]>;
  create: (
    request: CommentRequest & { input: NewComment },
  ) => Promise<CommentThread[]>;
  reply: (
    request: CommentRequest & { threadId: string; input: NewReply },
  ) => Promise<CommentThread[]>;
  resolve: (
    request: CommentRequest & { threadId: string; input: CommentResolution },
  ) => Promise<CommentThread[]>;
  seen: (
    request: CommentRequest & { throughRevision: number },
  ) => Promise<{ worktreeId: string; seenThrough: number }>;
};

export type CommentsContext = {
  api: { comments: CommentsPort };
  connection: {
    environmentId: string;
    request: (signal?: AbortSignal) => { signal: AbortSignal };
  };
};

export type CommentTarget = Pick<
  CommentAnchor,
  'filePath' | 'revision' | 'comparison' | 'contentFingerprint'
>;
export type RevealComment = { anchor: CommentAnchor; nonce: number };
type LineRange = {
  start: number;
  end: number;
  side?: 'additions' | 'deletions';
  endSide?: 'additions' | 'deletions';
};

export function rangeAnchor(
  target: CommentTarget,
  range: LineRange,
): CommentAnchor | null {
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
  if (
    anchor.filePath !== target.filePath ||
    anchor.revision !== target.revision
  )
    return false;
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
    anchor.contentFingerprint != null &&
    anchor.contentFingerprint !== target.contentFingerprint
  );
}
