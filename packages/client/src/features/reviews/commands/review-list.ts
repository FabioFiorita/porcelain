import { Option } from 'effect';
import { AsyncResult, Atom } from 'effect/reactivity';
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
      for (const { connection, project } of list.projects) {
        const projectRead = readProjectReviews({
          connection,
          projectId: project.id,
        });
        const records = Option.getOrUndefined(
          AsyncResult.value(get(projectRead)),
        );
        get.refresh(projectRead);
        for (const { reviewId } of records ?? []) {
          const input = { connection, reviewId };
          get.refresh(readReview(input));
          get.refresh(readReviewMarks(input));
          get.refresh(readReviewPullRequest(input));
        }
      }
    }),
);
