type CommentAnchor = {
  filePath: string;
  revision?: string | undefined;
  contentFingerprint?: string | undefined;
} & (
  | { kind: 'file' }
  | { kind: 'codeRange'; startLine: number; endLine: number }
);
export type CommentThread = {
  id: string;
  worktreeId: string;
  anchor: CommentAnchor;
  resolved: boolean;
  messages: { id: string; body: string }[];
};
export type CommentCommand =
  | { kind: 'list'; worktreeId: string }
  | { kind: 'create'; worktreeId: string; anchor: CommentAnchor; body: string }
  | { kind: 'reply'; worktreeId: string; threadId: string; body: string }
  | {
      kind: 'resolve';
      worktreeId: string;
      threadId: string;
      resolved: boolean;
    };
