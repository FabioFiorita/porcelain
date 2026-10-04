export type CommentAuthorRole = 'reviewer' | 'agent';

export type CommentWriter = {
  kind: 'owner' | 'device' | 'agent';
};

export type CommentThreadScope = 'all' | 'waiting';

type CommentComparison =
  | { kind: 'worktree'; scope: 'staged' | 'unstaged' | 'untracked' }
  | { kind: 'file' }
  | { kind: 'commit'; parent: number }
  | { kind: 'branch'; base: string };

export type CommentAnchor = {
  comparison?: CommentComparison | undefined;
  revision?: string | undefined;
  contentFingerprint?: string | undefined;
} & (
  | { kind: 'change' }
  | { kind: 'file'; filePath: string }
  | {
      kind: 'codeRange';
      filePath: string;
      startLine: number;
      endLine: number;
      side?: 'additions' | 'deletions' | undefined;
    }
);

export type CommentMessage = {
  id: string;
  body: string;
  author: CommentAuthorRole;
  createdAt?: string | undefined;
  editedAt?: string | undefined;
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

export type CommentEdit = {
  thread: CommentThread;
  messageId: string;
  body: string;
  editedAt: string;
  sizeBytes: number;
};

export type CommentRemoval = {
  thread: CommentThread;
  messageId: string;
  sizeBytes: number;
};

export type CommentResolution = {
  thread: CommentThread;
  resolved: boolean;
};

export type AgentReply = {
  worktreeId: string;
  threadId: string;
  revision: number;
  resolved: boolean;
};

export type CommentSeenMark = {
  worktreeId: string;
  seenThrough: number;
};

export type CommentAnchorProblem =
  | { kind: 'reversed-range' }
  | { kind: 'revision-mismatch' }
  | { kind: 'unsupported-comparison' };

export type CommentThreadKey = { threadId: string };

export type CommentMessageKey = { messageId: string };

export type CommentSeenUpdate = { worktreeId: string; seenThrough: number };
