export type CommentAuthor = 'reviewer' | 'agent';

export type CommentWriter = {
  kind: 'owner' | 'device' | 'agent';
};

export type CommentThreadScope = 'all' | 'waiting';

export type CommentComparison =
  | { kind: 'worktree'; scope: 'staged' | 'unstaged' | 'untracked' }
  | { kind: 'file' }
  | { kind: 'commit'; parent: number };

export type CommentAnchor = {
  comparison?: CommentComparison | undefined;
  filePath: string;
  revision?: string | undefined;
  contentFingerprint?: string | undefined;
} & (
  | { kind: 'file' }
  | {
      kind: 'codeRange';
      startLine: number;
      endLine: number;
      side?: 'additions' | 'deletions' | undefined;
    }
);

export type CommentMessage = {
  id: string;
  body: string;
  author: CommentAuthor;
  createdAt?: string | undefined;
};

export type CommentThread = {
  id: string;
  worktreeId: string;
  anchor: CommentAnchor;
  resolved: boolean;
  messages: CommentMessage[];
  revision: number;
};

export type CommentContent = Pick<
  CommentThread,
  'id' | 'worktreeId' | 'anchor' | 'messages'
>;

export type PostedCommentMessage = CommentMessage & {
  threadId: string;
  worktreeId: string;
};

export type CommentUsage = {
  threads: number;
  bytes: number;
};

export type CommentLimits = {
  threadsPerWorktree: number;
  messagesPerThread: number;
  bytesPerWorktree: number;
};

export type NewCommentThread = {
  content: CommentContent;
  sizeBytes: number;
  writtenByAgent: boolean;
};

export type CommentReply = {
  thread: CommentThread;
  message: CommentMessage;
  sizeBytes: number;
  writtenByAgent: boolean;
};

export type CommentResolution = {
  thread: CommentThread;
  resolved: boolean;
};

export type AgentReply = {
  worktreeId: string;
  threadId: string;
  revision: number;
};

export type CommentSeenMark = {
  worktreeId: string;
  seenThrough: number;
};

export type CommentAnchorProblem =
  | { kind: 'reversed-range' }
  | { kind: 'revision-mismatch' };

export type CommentThreadKey = { threadId: string };

export type CommentMessageKey = { messageId: string };

export type CommentSeenUpdate = { worktreeId: string; seenThrough: number };
