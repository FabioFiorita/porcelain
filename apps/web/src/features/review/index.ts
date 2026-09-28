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
export { createReviewLive } from './api/review-live';
export type { ReviewPort } from './api/review-port';
export { isSurface } from '@/features/reviews/index';
export type { ReviewScope, Surface } from '@/features/reviews/index';
