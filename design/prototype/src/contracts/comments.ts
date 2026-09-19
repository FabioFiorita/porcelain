/** Mirror of packages/contracts/src/comments.ts, with the section 5 changes. */

export type CommentAnchor =
  /** PROPOSED: a general thread about the whole worktree, not tied to code. */
  | { kind: 'worktree' }
  | {
      kind: 'file';
      filePath: string;
      /** The commit oid a comment on History is about; absent for the worktree. */
      revision?: string;
      /** PROPOSED: on a merge commit, the parent (1-based) its diff was against; absent is the first. */
      parent?: number;
    }
  | {
      kind: 'codeRange';
      filePath: string;
      startLine: number;
      endLine: number;
      revision?: string;
      /** PROPOSED: on a merge commit, the parent (1-based) its diff was against. */
      parent?: number;
      /** PROPOSED: the side of a diff the range is on. Absent means the new file. */
      side?: 'additions' | 'deletions';
      /** PROPOSED: the function the lines belong to, when known; helps the server re-find them. */
      symbol?: string;
    };

/**
 * PROPOSED: where the server finds the commented code now, re-found on every read
 * with the same pointer as review steps. Absent for general threads and comments
 * on a commit.
 * - `current`: found; `startLine`/`endLine` say where it is now (it may have moved,
 *   or the file may have been renamed).
 * - `outdated`: the code is gone; `snapshot` shows it as it was.
 * - `committed`: the code is still there but no longer uncommitted.
 */
export type ThreadLocation =
  | { state: 'current'; filePath: string; startLine?: number; endLine?: number }
  | { state: 'outdated' }
  | {
      state: 'committed';
      filePath: string;
      startLine?: number;
      endLine?: number;
    };

export type CommentMessage = {
  id: string;
  /** Markdown; rendered without raw HTML. */
  body: string;
  /** Set by the server from the caller: the Porcelain client is `reviewer`, MCP is `agent`. */
  author: 'reviewer' | 'agent';
  createdAt: string;
};

export type CommentThread = {
  id: string;
  worktreeId: string;
  anchor: CommentAnchor;
  /** PROPOSED */
  location?: ThreadLocation;
  /** PROPOSED: the commented lines as they were when the thread was opened. */
  snapshot?: { startLine: number; text: string };
  resolved: boolean;
  messages: CommentMessage[];
  /**
   * PROPOSED: the last message the reviewer has seen, shared by all their devices.
   * An agent message after it turns the worktree's dot yellow.
   */
  seenUpTo: string | null;
};

/**
 * PROPOSED: the client picks the thread and message ids, so a retry after a dropped
 * response returns the existing thread instead of posting twice.
 */
export type NewComment = {
  threadId: string;
  messageId: string;
  anchor: CommentAnchor;
  body: string;
};
export type ReplyToComment = { messageId: string; body: string };
export type ResolveComment = { resolved: boolean };
/** PROPOSED: PUT .../comments/:threadId/seen */
export type MarkSeen = { messageId: string };
