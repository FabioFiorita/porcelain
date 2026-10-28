export function retainedReviewRoute(group: string | undefined) {
  switch (group) {
    case '(files)':
      return '/(files)/retained-review/[reviewId]' as const;
    case '(history)':
      return '/(history)/retained-review/[reviewId]' as const;
    default:
      return '/(review)/reviews/[reviewId]' as const;
  }
}
