import { Schema } from 'effect';
const commentComparisonSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.mutableKey(Schema.Literal('worktree')),
    scope: Schema.mutableKey(
      Schema.Union([
        Schema.Literal('staged'),
        Schema.Literal('unstaged'),
        Schema.Literal('untracked'),
      ]),
    ),
  }),
  Schema.Struct({ kind: Schema.mutableKey(Schema.Literal('file')) }),
  Schema.Struct({
    kind: Schema.mutableKey(Schema.Literal('commit')),
    parent: Schema.mutableKey(Schema.Number),
  }),
  Schema.Struct({
    kind: Schema.mutableKey(Schema.Literal('branch')),
    base: Schema.mutableKey(Schema.String),
  }),
]);
export const commentAnchorSchema = Schema.Union([
  Schema.Struct({
    comparison: Schema.mutableKey(
      Schema.optional(
        Schema.Union([commentComparisonSchema, Schema.Undefined]),
      ),
    ),
    revision: Schema.mutableKey(
      Schema.optional(Schema.Union([Schema.String, Schema.Undefined])),
    ),
    contentFingerprint: Schema.mutableKey(
      Schema.optional(Schema.Union([Schema.String, Schema.Undefined])),
    ),
    kind: Schema.mutableKey(Schema.Literal('change')),
  }),
  Schema.Struct({
    comparison: Schema.mutableKey(
      Schema.optional(
        Schema.Union([commentComparisonSchema, Schema.Undefined]),
      ),
    ),
    revision: Schema.mutableKey(
      Schema.optional(Schema.Union([Schema.String, Schema.Undefined])),
    ),
    contentFingerprint: Schema.mutableKey(
      Schema.optional(Schema.Union([Schema.String, Schema.Undefined])),
    ),
    kind: Schema.mutableKey(Schema.Literal('file')),
    filePath: Schema.mutableKey(Schema.String),
  }),
  Schema.Struct({
    comparison: Schema.mutableKey(
      Schema.optional(
        Schema.Union([commentComparisonSchema, Schema.Undefined]),
      ),
    ),
    revision: Schema.mutableKey(
      Schema.optional(Schema.Union([Schema.String, Schema.Undefined])),
    ),
    contentFingerprint: Schema.mutableKey(
      Schema.optional(Schema.Union([Schema.String, Schema.Undefined])),
    ),
    kind: Schema.mutableKey(Schema.Literal('codeRange')),
    filePath: Schema.mutableKey(Schema.String),
    startLine: Schema.mutableKey(Schema.Number),
    endLine: Schema.mutableKey(Schema.Number),
    side: Schema.mutableKey(
      Schema.optional(
        Schema.Union([
          Schema.Literal('additions'),
          Schema.Literal('deletions'),
          Schema.Undefined,
        ]),
      ),
    ),
  }),
]);
export const commentAuthorRoleSchema = Schema.Union([
  Schema.Literal('reviewer'),
  Schema.Literal('agent'),
]);

export type CommentAuthorRole = typeof commentAuthorRoleSchema.Type;

export type CommentWriter = {
  kind: 'owner' | 'device' | 'agent';
};

export type CommentThreadScope = 'all' | 'waiting';

export type CommentAnchor = typeof commentAnchorSchema.Type;

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
  messages: readonly CommentMessage[];
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
