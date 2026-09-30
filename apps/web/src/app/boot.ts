import {
  createCommentsLive,
  createReviewsLive,
  type CommentsPort,
  type ReviewsPort,
} from '@/features/reviews/api';
import {
  createGitActionsLive,
  type GitActionsPort,
} from '@/features/git-actions/api';
import type { Connection } from '@/features/access/index';
import type { LiveUpdatePort } from '@/shared/live/port';

export type WorkspaceContext = {
  api: {
    comments: CommentsPort;
    reviews: ReviewsPort;
    gitActions: GitActionsPort;
    liveUpdates: LiveUpdatePort;
  };
  connection: Connection;
};

const contexts = new WeakMap<Connection, WorkspaceContext>();

export function workspaceContext(connection: Connection): WorkspaceContext {
  const known = contexts.get(connection);
  if (known) return known;
  const context = {
    api: {
      comments: createCommentsLive(connection.transport),
      reviews: createReviewsLive(connection.transport),
      gitActions: createGitActionsLive(connection.transport),
      liveUpdates: connection.liveUpdates,
    },
    connection,
  };
  contexts.set(connection, context);
  return context;
}
