import { Context, type Effect } from 'effect';
import { type GitActionReceiptView } from '@porcelain/git-actions/models';

export type ProjectChangedNotice = {
  projectId: string;
  change: 'preferences';
};

export type WorktreeChangedNotice = {
  worktreeId: string;
  change: 'review' | 'reviewed' | 'comments' | 'git';
};

export type FilesChangedNotice = {
  worktreeId: string;
  paths: readonly string[];
};

export interface EventPublisher {
  inventoryChanged(): Effect.Effect<void>;
  projectChanged(input: ProjectChangedNotice): Effect.Effect<void>;
  worktreeChanged(input: WorktreeChangedNotice): Effect.Effect<void>;
  filesChanged(input: FilesChangedNotice): Effect.Effect<void>;
  gitActionChanged(input: GitActionReceiptView): Effect.Effect<void>;
}

export const EventPublisher = Context.Service<
  '@porcelain/server/EventPublisher',
  EventPublisher
>('@porcelain/server/EventPublisher');
