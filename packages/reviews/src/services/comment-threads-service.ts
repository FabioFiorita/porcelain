import { CommentTargetNotFoundError } from '../errors/comment-target-not-found-error.ts';
import { InvalidCommentError } from '../errors/invalid-comment-error.ts';
import type {
  CommentAuthor,
  CommentCommand,
  CommentPrincipal,
  CommentThread,
  StoredCommentThread,
} from '../models/comment-thread.ts';
import type { CommentStore } from '../ports/comment-store.ts';
import type { CommentWorktreeAccess } from '../ports/comment-worktree-access.ts';

export class CommentThreadsService {
  private readonly store: CommentStore;
  private readonly worktrees: CommentWorktreeAccess;
  private readonly newId: () => string;
  private readonly now: () => string;

  constructor(
    store: CommentStore,
    worktrees: CommentWorktreeAccess,
    newId: () => string,
    now: () => string = () => new Date().toISOString(),
  ) {
    this.store = store;
    this.worktrees = worktrees;
    this.newId = newId;
    this.now = now;
  }

  async execute(
    command: CommentCommand,
    principal: CommentPrincipal,
    signal?: AbortSignal,
  ): Promise<StoredCommentThread[]> {
    validateCommentCommand(command);
    if (command.kind === 'list') {
      await this.worktrees.known(command.worktreeId, signal);
      return this.store.list(command.worktreeId);
    }
    await this.worktrees.forWriting(command.worktreeId, signal);
    if (command.kind === 'create') {
      const thread: CommentThread = {
        id: command.threadId ?? this.newId(),
        worktreeId: command.worktreeId,
        anchor: structuredClone(command.anchor),
        resolved: false,
        messages: [
          {
            id: command.messageId ?? this.newId(),
            body: command.body,
            author: authorFor(principal),
            createdAt: this.now(),
          },
        ],
      };
      return [this.store.create(thread)];
    }
    const updated =
      command.kind === 'reply'
        ? this.store.reply(command.worktreeId, command.threadId, {
            id: command.messageId ?? this.newId(),
            body: command.body,
            author: authorFor(principal),
            createdAt: this.now(),
          })
        : this.store.resolve(
            command.worktreeId,
            command.threadId,
            command.resolved,
          );
    if (!updated) throw new CommentTargetNotFoundError();
    return [updated];
  }
}

function authorFor(principal: CommentPrincipal): CommentAuthor {
  switch (principal.kind) {
    case 'agent':
      return 'agent';
    case 'owner':
    case 'viewer':
      return 'reviewer';
  }
}

function validAnchor(anchor: CommentThread['anchor']): boolean {
  const path = anchor.filePath;
  const validPath =
    path.length > 0 &&
    path.length <= 4096 &&
    !/^[a-z]:/i.test(path) &&
    !path.includes('\\') &&
    !path.includes('\0') &&
    path
      .split('/')
      .every(
        (part) =>
          part !== '' &&
          part !== '.' &&
          part !== '..' &&
          part.toLowerCase() !== '.git',
      );
  const validEvidence = [anchor.revision, anchor.contentFingerprint].every(
    (value) => value === undefined || (value.length > 0 && value.length <= 256),
  );
  const validSide =
    anchor.kind === 'file' ||
    anchor.side === undefined ||
    anchor.side === 'additions' ||
    anchor.side === 'deletions';
  const comparison = anchor.comparison;
  const validComparison =
    comparison === undefined ||
    (comparison.kind === 'commit'
      ? Number.isInteger(comparison.parent) &&
        comparison.parent >= 1 &&
        comparison.parent <= 1000 &&
        /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(anchor.revision ?? '')
      : anchor.revision === undefined &&
        (comparison.kind === 'file' ||
          (comparison.kind === 'worktree' &&
            (comparison.scope === 'staged' ||
              comparison.scope === 'unstaged' ||
              comparison.scope === 'untracked'))));
  return (
    validComparison &&
    validPath &&
    validEvidence &&
    validSide &&
    (anchor.kind === 'file' ||
      (Number.isInteger(anchor.startLine) &&
        Number.isInteger(anchor.endLine) &&
        anchor.startLine >= 1 &&
        anchor.endLine >= anchor.startLine &&
        anchor.endLine <= 2147483647))
  );
}

function validateCommentCommand(command: CommentCommand): void {
  if (command.kind === 'create' || command.kind === 'reply') {
    if (
      command.body.length > 16000 ||
      command.body.trim().length === 0 ||
      command.body.includes('\0')
    )
      throw new InvalidCommentError();
  }
  if (command.kind === 'create' && !validAnchor(command.anchor))
    throw new InvalidCommentError();
}
