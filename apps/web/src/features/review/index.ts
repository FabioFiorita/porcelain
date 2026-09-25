import { lazy } from 'react';

export const ReviewShell = lazy(() =>
  import('./views/review-shell').then(({ ReviewShell }) => ({
    default: ReviewShell,
  })),
);

export const ReviewWorkspace = lazy(() =>
  import('./views/review-workspace').then(({ ReviewWorkspace }) => ({
    default: ReviewWorkspace,
  })),
);
export { createCommentsLive } from './api/comments-live';
export type { CommentsPort } from './api/comments-port';
export { createGitActionsLive } from './api/git-actions-live';
export type { GitActionsPort } from './api/git-actions-port';
export { createReviewLive } from './api/review-live';
export type { ReviewPort } from './api/review-port';
export { groupedCommitModels, resolveCommitModel } from './model/commit-model';
export type { FileDraft } from './model/file-draft';
export { parseRetainedOperation } from './model/git-action';
export type { Operation, Receipt } from './model/git-action';
export { isSurface } from './model/review';
export type { ReviewScope, Surface } from './model/review';
export { useCommitModels } from './queries/git-actions';
