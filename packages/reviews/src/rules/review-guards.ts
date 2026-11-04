import type { Review } from '../models/review.ts';
export function reviewGuards(files: Review['files']) {
  return files
    .filter(
      (file) =>
        file.status === 'added' &&
        /(?:^|\/)(?:architecture\/|[^/]*oxlint[^/]*|[^/]*eslint[^/]*|[^/]*lint-rules?\/)/.test(
          file.path,
        ),
    )
    .map((file) => file.path);
}
