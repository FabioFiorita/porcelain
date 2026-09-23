export type CommentAuthor = 'reviewer' | 'agent';

type CommentComparison =
  | { kind: 'worktree'; scope: 'staged' | 'unstaged' | 'untracked' }
  | { kind: 'file' }
  | { kind: 'commit'; parent: number };

type CommentAnchor = {
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
};
export type StoredCommentThread = CommentThread & { revision: number };

export type CommentCommand =
  | { kind: 'list'; worktreeId: string }
  | {
      kind: 'create';
      worktreeId: string;
      threadId?: string | undefined;
      messageId?: string | undefined;
      anchor: CommentAnchor;
      body: string;
    }
  | {
      kind: 'reply';
      worktreeId: string;
      threadId: string;
      messageId?: string | undefined;
      body: string;
    }
  | {
      kind: 'resolve';
      worktreeId: string;
      threadId: string;
      resolved: boolean;
    };
