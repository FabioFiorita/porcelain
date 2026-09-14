export type CommentAuthor = 'reviewer' | 'agent';

export type CommentAnchor = {
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
export type CommentCommand =
  | { kind: 'list'; worktreeId: string }
  | {
      kind: 'create';
      worktreeId: string;
      anchor: CommentAnchor;
      body: string;
      author: CommentAuthor;
    }
  | {
      kind: 'reply';
      worktreeId: string;
      threadId: string;
      body: string;
      author: CommentAuthor;
    }
  | {
      kind: 'resolve';
      worktreeId: string;
      threadId: string;
      resolved: boolean;
    };
