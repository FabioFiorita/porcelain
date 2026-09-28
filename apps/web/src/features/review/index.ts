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
