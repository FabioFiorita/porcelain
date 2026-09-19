import type {
  CommentThread,
  MarkSeen,
  NewComment,
  ReplyToComment,
  ResolveComment,
} from '../contracts/comments';
import type {
  CommitDiffResponse,
  CommitFilesResponse,
  CommitPageResponse,
} from '../contracts/commit-history';
import type { PairRequest, SessionResponse } from '../contracts/connection';
import type {
  FilePreferencesResponse,
  SetFilePreferenceRequest,
} from '../contracts/file-preferences';
import type {
  CreateEntryRequest,
  DirectoryListing,
  FileEditResponse,
  FileSearchResponse,
  MoveEntryRequest,
  PreviewLinkResponse,
  RemoveEntryRequest,
  TextResponse,
  WriteFileRequest,
} from '../contracts/files';
import type {
  BranchesResponse,
  CommitGroupsRequest,
  CommitGroupsResponse,
  CommitMessageRequest,
  CommitMessageResponse,
  CommitModelsResponse,
  Receipt,
  RunGitActionRequest,
} from '../contracts/git-actions';
import type {
  GitDiffRequest,
  GitDiffResponse,
  GitStatusResponse,
  TextRangeRequest,
  TextRangeResponse,
} from '../contracts/git-status';
import type {
  DirectoryBrowseResponse,
  DiscoveredRepository,
  InventoryResponse,
  ProjectResponse,
} from '../contracts/inventory';
import type { LiveNotice, LiveState } from '../contracts/live';
import type { MarksResponse, SetMarksRequest } from '../contracts/marks';
import type { ReviewResponse } from '../contracts/review';
import type { ReviewScope } from '../domain/review';

export type { ReviewScope };

/** The device token travels in an HttpOnly cookie, so requests carry nothing else. */
export type ReviewRequest = ReviewScope & { signal?: AbortSignal };

/**
 * One port per resource, as in apps/web/src/api. After the server review
 * (2026-09-18) most methods are PROPOSED: see PROTOTYPE.md → Contracts.
 */
export type Api = {
  /** Pairing and this device (section 1). */
  connection: {
    /** Fails with `NOT_PAIRED` or `DEVICE_REVOKED` when this browser is not a device. */
    session(input: { signal?: AbortSignal }): Promise<SessionResponse>;
    /** Redeems a pairing link once. */
    pair(input: PairRequest): Promise<SessionResponse>;
    /** Forgets this browser: its token stops working. Pairing again needs a new link. */
    forget(): Promise<void>;
  };
  inventory: {
    read(input: { signal?: AbortSignal }): Promise<InventoryResponse>;
    register(input: { path: string }): Promise<ProjectResponse>;
    /** Nothing on disk is touched. */
    remove(input: { projectId: string }): Promise<{ deleted: boolean }>;
    rename(input: {
      projectId: string;
      name: string;
    }): Promise<ProjectResponse>;
    discover(): Promise<DiscoveredRepository[]>;
    /** Browse the server's filesystem. `null` starts at its home directory. */
    browse(input: {
      path: string | null;
      signal?: AbortSignal;
    }): Promise<DirectoryBrowseResponse>;
  };
  review: {
    /** The list of changes, with fingerprints and branch tracking. */
    changes(request: ReviewRequest): Promise<GitStatusResponse>;
    /** One file's diff. */
    diff(
      request: ReviewRequest & { input: GitDiffRequest },
    ): Promise<GitDiffResponse>;
    /** A line range at the last commit or on disk. */
    range(
      request: ReviewRequest & { input: TextRangeRequest },
    ): Promise<TextRangeResponse>;
    /** The agent's review, or null when there is none (or nothing it describes is uncommitted). */
    review(request: ReviewRequest): Promise<ReviewResponse | null>;
    /** Commits of the checked-out branch, newest first; `before` continues after that commit. */
    history(
      request: ReviewRequest & { before?: string; limit?: number },
    ): Promise<CommitPageResponse>;
    commitFiles(
      request: ReviewRequest & { oid: string; parent?: number },
    ): Promise<CommitFilesResponse>;
    commitDiff(
      request: ReviewRequest & { oid: string; path: string; parent?: number },
    ): Promise<CommitDiffResponse>;
  };
  files: {
    text(request: ReviewRequest & { path: string }): Promise<TextResponse>;
    directory(
      request: ReviewRequest & { path: string },
    ): Promise<DirectoryListing>;
    search(
      request: ReviewRequest & { query: string },
    ): Promise<FileSearchResponse>;
    /** `revision` reads the file at a commit (`HEAD` is the last one) instead of on disk. */
    previewLink(
      request: ReviewRequest & { path: string; revision?: string },
    ): Promise<PreviewLinkResponse>;
    write(
      request: ReviewRequest & { input: WriteFileRequest },
    ): Promise<TextResponse>;
    create(
      request: ReviewRequest & { input: CreateEntryRequest },
    ): Promise<FileEditResponse>;
    move(
      request: ReviewRequest & { input: MoveEntryRequest },
    ): Promise<FileEditResponse>;
    remove(
      request: ReviewRequest & { input: RemoveEntryRequest },
    ): Promise<FileEditResponse>;
  };
  marks: {
    list(request: ReviewRequest): Promise<MarksResponse>;
    set(
      request: ReviewRequest & { input: SetMarksRequest },
    ): Promise<MarksResponse>;
  };
  filePreferences: {
    list(input: {
      projectId: string;
      signal?: AbortSignal;
    }): Promise<FilePreferencesResponse>;
    set(input: {
      projectId: string;
      input: SetFilePreferenceRequest;
    }): Promise<FilePreferencesResponse>;
  };
  comments: {
    list(request: ReviewRequest): Promise<CommentThread[]>;
    create(
      request: ReviewRequest & { input: NewComment },
    ): Promise<CommentThread>;
    reply(
      request: ReviewRequest & { threadId: string; input: ReplyToComment },
    ): Promise<CommentThread>;
    resolve(
      request: ReviewRequest & { threadId: string; input: ResolveComment },
    ): Promise<CommentThread>;
    seen(
      request: ReviewRequest & { threadId: string; input: MarkSeen },
    ): Promise<CommentThread>;
  };
  gitActions: {
    run(
      request: ReviewRequest & { input: RunGitActionRequest },
    ): Promise<Receipt>;
    receipt(request: ReviewRequest & { requestId: string }): Promise<Receipt>;
    /** Acknowledges an interrupted action so it is not shown again. */
    dismissInterrupted(
      request: ReviewRequest & { requestId: string },
    ): Promise<void>;
    branches(request: ReviewRequest): Promise<BranchesResponse>;
    /** The models the server's agent CLIs can run, for drafts. Empty when none is installed or signed in. */
    commitModels(input: {
      signal?: AbortSignal;
    }): Promise<CommitModelsResponse>;
    commitMessage(
      request: ReviewRequest & { input: CommitMessageRequest },
    ): Promise<CommitMessageResponse>;
    commitGroups(
      request: ReviewRequest & { input: CommitGroupsRequest },
    ): Promise<CommitGroupsResponse>;
  };
  /** The live channel: one WebSocket per server. Returns a function that closes it. */
  live: {
    connect(handlers: {
      onNotice: (notice: LiveNotice) => void;
      onState: (state: LiveState) => void;
    }): () => void;
  };
};

export class ApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}
