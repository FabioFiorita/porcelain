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
type CommentMessage = {
  id: string;
  body: string;
  author: CommentAuthor;
  /** Optional only for rows written before comment timestamps were introduced. */
  createdAt?: string | undefined;
};
export type CommentThread = {
  id: string;
  worktreeId: string;
  anchor: CommentAnchor;
  resolved: boolean;
  messages: CommentMessage[];
};
/** A thread as it is stored, with the revision its last write was given. */
export type StoredCommentThread = CommentThread & { revision: number };

export type CommentCommand =
  | { kind: 'list'; worktreeId: string }
  | {
      kind: 'create';
      worktreeId: string;
      anchor: CommentAnchor;
      body: string;
    }
  | {
      kind: 'reply';
      worktreeId: string;
      threadId: string;
      body: string;
    }
  | {
      kind: 'resolve';
      worktreeId: string;
      threadId: string;
      resolved: boolean;
    };
