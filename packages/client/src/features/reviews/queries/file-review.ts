import type {
  WorktreeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import type { ReviewRange } from '../ports/reviews.ts';
import { reviewedQueryOptions } from './reviewed.ts';
import { fileReviewStatus } from '../rules/files.ts';

export function reviewFilesQueryOptions(
  scope: WorktreeScope,
  connection: WorktreeConnection,
  range: ReviewRange,
  files: readonly {
    path: string;
    fingerprint: string | undefined;
    note: string;
  }[],
) {
  return {
    ...reviewedQueryOptions(scope, connection, range),
    select: (
      marks: Awaited<
        ReturnType<ReturnType<typeof reviewedQueryOptions>['queryFn']>
      >,
    ) =>
      files.map((file) => ({
        ...file,
        reviewed: fileReviewStatus(file, marks),
      })),
  };
}
