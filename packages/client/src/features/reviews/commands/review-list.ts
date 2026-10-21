import { Atom } from 'effect/reactivity';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { refreshInventories } from '../../projects/commands/projects.ts';
import { readReviewList } from '../queries/review-list.ts';
import {
  readProjectReviews,
  readReview,
  readReviewMarks,
  readReviewPullRequest,
} from '../queries/project-reviews.ts';

export const refreshReviewList = Atom.family(
  (connections: readonly RuntimeConnection[]) =>
    Atom.fnSync((_: void, get) => {
      const list = get(readReviewList(connections));
      get.set(refreshInventories(connections), undefined);
      for (const { connection, project } of list.projects)
        get.refresh(readProjectReviews({ connection, projectId: project.id }));
      for (const entry of list.entries) {
        const connection = connections.find(
          (candidate) => candidate.environmentId === entry.environmentId,
        );
        if (!connection || !entry.reviewId) continue;
        const input = { connection, reviewId: entry.reviewId };
        get.refresh(readReview(input));
        get.refresh(readReviewMarks(input));
        get.refresh(readReviewPullRequest(input));
      }
    }),
);
