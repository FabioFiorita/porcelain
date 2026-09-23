export type CommentAuthor = 'reviewer' | 'agent';

export type CommentWriter = {
  kind: 'owner' | 'agent' | 'viewer' | 'anonymous';
};

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

export type CommentStorage = {
  sizeBytes: number;
  lastAgentRevision: number | undefined;
};

export type CommentAppend = CommentStorage & {
  revision: number;
};

export type CommentResolution = {
  resolved: boolean;
  revision: number;
  sizeBytes: number;
};
